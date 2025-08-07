# Technical Plan for Onshape CAD Document Website and PDF Generator

## Executive Summary

This technical plan outlines the implementation of two integrated components: an Astro static website for displaying Onshape CAD documents with rich metadata, and a PDF generation tool using Typst that uploads documents to Onshape. The recommended approach uses a **monorepo architecture** with shared TypeScript utilities and a **custom Onshape API wrapper** due to maintenance issues with existing TypeScript clients.

## Architecture Overview

### Recommended Structure: Simple Monorepo Layout

```
onshape-cad-toolkit/
├── src/                        # Astro website source
│   ├── content/
│   │   ├── config.ts          # Zod schemas
│   │   └── documents/         # JSON collections
│   ├── pages/
│   ├── components/
│   └── layouts/
├── generator/                  # CLI PDF generator
│   ├── src/
│   │   ├── commands/
│   │   ├── templates/
│   │   └── index.ts
│   ├── bin/
│   │   └── cli.js
│   └── package.json
├── packages/
│   ├── onshape-client/        # Custom API wrapper
│   └── shared-types/          # TypeScript interfaces
├── public/
├── astro.config.mjs
├── package.json               # Root workspace
└── .github/workflows/
```

## Core Component Specifications

### 1. Custom Onshape API Client

Since the official TypeScript client is archived and the example repository isn't production-ready, implement a lightweight custom wrapper:

```typescript
// packages/onshape-client/src/index.ts
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import FormData from 'form-data';

export class OnshapeClient {
  private api: AxiosInstance;

  constructor(
    private accessKey: string,
    private secretKey: string,
    private baseUrl = 'https://cad.onshape.com'
  ) {
    this.api = axios.create({
      baseURL: `${baseUrl}/api`,
      timeout: 30000
    });

    this.api.interceptors.request.use(config => {
      // Add request signature authentication
      const { headers, method, url } = config;
      const date = new Date().toUTCString();
      const nonce = crypto.randomBytes(16).toString('hex');

      const signature = this.createSignature(
        method!, url!, date, nonce
      );

      headers['Date'] = date;
      headers['On-Nonce'] = nonce;
      headers['Authorization'] = signature;

      return config;
    });
  }

  private createSignature(
    method: string,
    path: string,
    date: string,
    nonce: string
  ): string {
    const toSign = [method, nonce, date, 'application/json', path]
      .join('\n');

    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(toSign);
    const signature = hmac.digest('base64');

    return `On ${this.accessKey}:HmacSHA256:${signature}`;
  }

  async getDocument(documentId: string) {
    const response = await this.api.get(`/v10/documents/${documentId}`);
    return response.data;
  }

  async getThumbnails(documentId: string, elementId: string) {
    // First get available sizes
    const sizes = await this.api.get(
      `/thumbnails/d/${documentId}/e/${elementId}`
    );

    // Then fetch specific sizes
    const thumbnails = await Promise.all(
      sizes.data.sizes.map(size =>
        this.api.get(
          `/thumbnails/d/${documentId}/e/${elementId}?sz=${size}`,
          { responseType: 'arraybuffer' }
        )
      )
    );

    return thumbnails;
  }

  async uploadPDF(
    documentId: string,
    workspaceId: string,
    pdfBuffer: Buffer,
    filename: string
  ) {
    const form = new FormData();
    form.append('file', pdfBuffer, filename);
    form.append('storeInDocument', 'true');
    form.append('translate', 'false');

    const response = await this.api.post(
      `/blobelements/d/${documentId}/w/${workspaceId}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    return response.data;
  }
}
```

### 2. Astro Website Implementation

#### Content Collection with Zod Schemas

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const documentsCollection = defineCollection({
  type: 'data',
  schema: ({ image }) => z.object({
    // Onshape metadata
    onshapeId: z.string(),
    workspaceId: z.string(),
    elementId: z.string(),

    // Display metadata
    title: z.string(),
    description: z.string(),
    createdAt: z.coerce.date(),

    // Multiple thumbnails
    thumbnails: z.object({
      small: z.string(), // URLs from Onshape
      medium: z.string(),
      large: z.string()
    }),

    // User-created changelog
    changelog: z.array(z.object({
      version: z.string(),
      date: z.coerce.date(),
      changes: z.array(z.string()),
      author: z.string()
    })).default([]),

    // 3D printing info (user-provided)
    printingInfo: z.object({
      printTime: z.number().optional(),
      filamentUsage: z.number().optional(),
      layerHeight: z.number().optional(),
      infillPercentage: z.number().optional(),
      supportRequired: z.boolean().default(false),
      materials: z.array(z.string()).default([])
    }).optional(),

    // Personal information
    author: z.object({
      name: z.string(),
      email: z.string().email(),
      website: z.string().url().optional(),
      photo: image().optional()
    })
  })
});

export const collections = {
  documents: documentsCollection
};
```

#### Environment Configuration

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://yourusername.github.io',
  base: '/your-repo-name',

  vite: {
    envPrefix: 'PUBLIC_',
  },

  env: {
    schema: {
      ONSHAPE_ACCESS_KEY: envField.string({
        context: 'server',
        access: 'secret'
      }),
      ONSHAPE_SECRET_KEY: envField.string({
        context: 'server',
        access: 'secret'
      })
    }
  }
});
```

### 3. CLI PDF Generator Implementation

#### CLI Application Structure

```typescript
// generator/src/index.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { generatePDF } from './commands/generate.js';
import { uploadPDF } from './commands/upload.js';
import { syncDocuments } from './commands/sync.js';

const program = new Command();

program
  .name('onshape-pdf-generator')
  .description('CLI for generating and uploading PDFs to Onshape documents')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate PDF from Typst template')
  .requiredOption('-d, --document <id>', 'Onshape document ID')
  .requiredOption('-t, --template <type>', 'Template type (assembly|part|drawing)')
  .option('-o, --output <path>', 'Output file path', './output.pdf')
  .action(generatePDF);

program
  .command('upload')
  .description('Upload PDF to Onshape document')
  .requiredOption('-d, --document <id>', 'Onshape document ID')
  .requiredOption('-w, --workspace <id>', 'Workspace ID')
  .requiredOption('-f, --file <path>', 'PDF file path')
  .action(uploadPDF);

program
  .command('sync')
  .description('Sync document metadata from Onshape')
  .requiredOption('-d, --document <id>', 'Onshape document ID')
  .option('--output-dir <path>', 'Output directory for JSON files', './src/content/documents')
  .action(syncDocuments);

program.parse();
```

#### Generate Command Implementation

```typescript
// generator/src/commands/generate.ts
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { OnshapeClient } from '../../packages/onshape-client/src/index.js';
import * as typst from 'typst';

interface GenerateOptions {
  document: string;
  template: 'assembly' | 'part' | 'drawing';
  output: string;
}

export async function generatePDF(options: GenerateOptions) {
  try {
    console.log(`Generating PDF for document ${options.document}...`);

    // Initialize Onshape client
    const client = new OnshapeClient(
      process.env.ONSHAPE_ACCESS_KEY!,
      process.env.ONSHAPE_SECRET_KEY!
    );

    // Fetch document metadata
    const document = await client.getDocument(options.document);
    console.log(`Found document: ${document.name}`);

    // Prepare template data
    const templateData = {
      title: document.name,
      description: document.description || '',
      createdAt: new Date(document.createdAt),
      modifiedAt: new Date(document.modifiedAt),
      author: {
        name: process.env.AUTHOR_NAME || 'Unknown',
        email: process.env.AUTHOR_EMAIL || '',
        website: process.env.AUTHOR_WEBSITE || ''
      }
    };

    // Read template file
    const templatePath = resolve(`./templates/${options.template}.typ`);
    const template = readFileSync(templatePath, 'utf-8');

    // Generate PDF
    const pdfBuffer = await typst.compile(template, {
      sys_inputs: {
        data: JSON.stringify(templateData)
      },
      format: 'pdf'
    });

    // Save to file
    writeFileSync(options.output, pdfBuffer);
    console.log(`✅ PDF generated successfully: ${options.output}`);

  } catch (error) {
    console.error('❌ Error generating PDF:', error.message);
    process.exit(1);
  }
}
```

#### Upload Command Implementation

```typescript
// generator/src/commands/upload.ts
import { readFileSync } from 'fs';
import { OnshapeClient } from '../../packages/onshape-client/src/index.js';

interface UploadOptions {
  document: string;
  workspace: string;
  file: string;
}

export async function uploadPDF(options: UploadOptions) {
  try {
    console.log(`Uploading ${options.file} to document ${options.document}...`);

    // Initialize Onshape client
    const client = new OnshapeClient(
      process.env.ONSHAPE_ACCESS_KEY!,
      process.env.ONSHAPE_SECRET_KEY!
    );

    // Read PDF file
    const pdfBuffer = readFileSync(options.file);
    const filename = options.file.split('/').pop() || 'document.pdf';

    // Upload to Onshape
    const result = await client.uploadPDF(
      options.document,
      options.workspace,
      pdfBuffer,
      filename
    );

    console.log(`✅ PDF uploaded successfully with element ID: ${result.id}`);

  } catch (error) {
    console.error('❌ Error uploading PDF:', error.message);
    process.exit(1);
  }
}
```

#### Sync Command Implementation

```typescript
// generator/src/commands/sync.ts
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { OnshapeClient } from '../../packages/onshape-client/src/index.js';

interface SyncOptions {
  document: string;
  outputDir: string;
}

export async function syncDocuments(options: SyncOptions) {
  try {
    console.log(`Syncing document ${options.document}...`);

    // Initialize Onshape client
    const client = new OnshapeClient(
      process.env.ONSHAPE_ACCESS_KEY!,
      process.env.ONSHAPE_SECRET_KEY!
    );

    // Fetch document metadata
    const document = await client.getDocument(options.document);

    // Get thumbnails for the first part studio
    const workspaces = await client.getWorkspaces(options.document);
    const elements = await client.getElements(options.document, workspaces[0].id);
    const partStudio = elements.find(e => e.type === 'PARTSTUDIO');

    let thumbnails = { small: '', medium: '', large: '' };
    if (partStudio) {
      const thumbs = await client.getThumbnails(options.document, partStudio.id);
      thumbnails = {
        small: thumbs.small || '',
        medium: thumbs.medium || '',
        large: thumbs.large || ''
      };
    }

    // Create content collection entry
    const documentData = {
      onshapeId: options.document,
      workspaceId: workspaces[0]?.id || '',
      elementId: partStudio?.id || '',
      title: document.name,
      description: document.description || '',
      createdAt: new Date(document.createdAt),
      thumbnails,
      changelog: [],
      author: {
        name: process.env.AUTHOR_NAME || 'Unknown',
        email: process.env.AUTHOR_EMAIL || '',
        website: process.env.AUTHOR_WEBSITE || ''
      }
    };

    // Write to content directory
    const outputPath = resolve(options.outputDir, `${document.name.toLowerCase().replace(/\s+/g, '-')}.json`);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(documentData, null, 2));

    console.log(`✅ Document synced to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error syncing document:', error.message);
    process.exit(1);
  }
}
```

#### CLI Package Configuration

```json
// generator/package.json
{
  "name": "onshape-pdf-generator",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "onshape-pdf-gen": "./bin/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "typst": "^0.11.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0"
  }
}
```

```javascript
// generator/bin/cli.js
#!/usr/bin/env node
import '../dist/index.js';
```

#### Typst Templates

```typst
// generator/templates/assembly.typ
#let data = json(bytes(sys.inputs.data))

#set document(
  title: data.title,
  author: data.author.name
)

#set page(
  paper: "letter",
  margin: (x: 1in, y: 1in),
  header: [
    #data.title #h(1fr) Assembly Documentation
  ]
)

= #data.title

#data.description

== Document Information

- *Created:* #data.createdAt
- *Modified:* #data.modifiedAt
- *Author:* #data.author.name

#if data.author.website != "" [
  - *Website:* #link(data.author.website)
]

#align(bottom)[
  Generated on #datetime.today().display()

  #if data.author.name != "" [
    Prepared by: #data.author.name
  ]
]
```

## Implementation Steps

### Phase 1: Project Setup (Day 1)

1. **Initialize Astro project**
   ```bash
   npm create astro@latest onshape-cad-toolkit
   cd onshape-cad-toolkit
   ```

2. **Setup workspace structure**
   ```bash
   mkdir packages packages/onshape-client packages/shared-types generator
   ```

3. **Configure root package.json for workspaces**
   ```json
   {
     "name": "onshape-cad-toolkit",
     "workspaces": [
       "packages/*",
       "generator"
     ]
   }
   ```

### Phase 2: Shared Packages (Day 2)

1. **Implement Onshape client package**
   ```bash
   cd packages/onshape-client
   npm init -y
   npm install axios form-data
   npm install -D typescript @types/node
   ```

2. **Create shared types package**
   ```bash
   cd packages/shared-types
   npm init -y
   npm install -D typescript
   ```

### Phase 3: Astro Website (Day 3-4)

1. **Configure content collections**
   - Setup Zod schemas in `src/content/config.ts`
   - Create example JSON documents

2. **Build UI components**
   - Document cards
   - Gallery views
   - Changelog display

3. **Implement pages**
   - Homepage with document grid
   - Individual document pages

### Phase 4: CLI PDF Generator (Day 5-6)

1. **Setup CLI structure**
   ```bash
   cd generator
   npm init -y
   npm install commander typst dotenv
   npm install -D typescript tsx @types/node
   ```

2. **Implement commands**
   - Generate command
   - Upload command
   - Sync command

3. **Create Typst templates**
   - Assembly reports
   - Part specifications

### Phase 5: CI/CD Pipeline (Day 7)

1. **GitHub Actions workflow for website deployment**
2. **Environment secrets configuration**

## Configuration Requirements

### Environment Variables

```bash
# Development (.env.local)
ONSHAPE_ACCESS_KEY=your_access_key
ONSHAPE_SECRET_KEY=your_secret_key
ONSHAPE_BASE_URL=https://cad.onshape.com

# Production (GitHub Secrets)
PROD_ONSHAPE_ACCESS_KEY=production_key
PROD_ONSHAPE_SECRET_KEY=production_secret
```

### Dependencies

```json
// Root package.json
{
  "name": "onshape-cad-toolkit",
  "workspaces": [
    "packages/*",
    "generator"
  ],
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  }
}

// Onshape client package.json
{
  "name": "@repo/onshape-client",
  "dependencies": {
    "axios": "^1.6.0",
    "form-data": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  }
}

// Main Astro package.json
{
  "dependencies": {
    "astro": "^4.0.0",
    "zod": "^3.22.0",
    "@repo/onshape-client": "workspace:*"
  }
}

// CLI generator package.json
{
  "name": "onshape-pdf-generator",
  "dependencies": {
    "commander": "^11.0.0",
    "typst": "^0.11.0",
    "dotenv": "^16.3.0",
    "@repo/onshape-client": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0"
  }
}
```

## Best Practices and Considerations

### CLI Usage Examples

```bash
# Generate PDF from Onshape document
npx onshape-pdf-gen generate -d "your-document-id" -t assembly -o "./output.pdf"

# Upload generated PDF back to Onshape
npx onshape-pdf-gen upload -d "your-document-id" -w "workspace-id" -f "./output.pdf"

# Sync document metadata to Astro content
npx onshape-pdf-gen sync -d "your-document-id" --output-dir "./src/content/documents"

# Combined workflow
npx onshape-pdf-gen generate -d "abc123" -t assembly && \
npx onshape-pdf-gen upload -d "abc123" -w "def456" -f "./output.pdf"
```

### Security
- Store API keys as environment variables
- Use request signing for Onshape API
- Validate all CLI inputs
- Handle file permissions properly

### Performance
- Cache Onshape API responses when possible
- Use Astro's image optimization for thumbnails
- Implement request retries with exponential backoff
- Stream large file uploads

### Maintainability
- Use TypeScript for type safety across all packages
- Implement comprehensive error handling in CLI
- Add logging for debugging API issues
- Structure templates for easy customization

This simplified technical plan provides a more focused approach using standard npm workspaces and a CLI-based PDF generator, making it easier to implement and maintain while still achieving all the project goals.
