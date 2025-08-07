import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { generateFilenameFromTitle } from '../utils/document-utils.js';

// Get current file directory for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { OnshapeClient } from '../../../packages/onshape-client/src/index.js';
import type { GenerateOptions, TemplateData } from '../../../packages/shared-types/src/index.js';

export async function generatePDF(options: GenerateOptions) {
  try {
    console.log(`Generating PDF for document ${options.document} with template ${options.template}...`);

    // First, try to load from synced document JSON file
    let documentData: any = null;
    const client = new OnshapeClient(
      process.env.ONSHAPE_ACCESS_KEY!,
      process.env.ONSHAPE_SECRET_KEY!
    );

    // Get document info first to determine filename
    const document = await client.getDocument(options.document);
    const filename = generateFilenameFromTitle(document.name);

    // Set default output path if not provided
    if (!options.output) {
      const outputDir = resolve(__dirname, '../../../public/pdf');
      mkdirSync(outputDir, { recursive: true });
      options.output = resolve(outputDir, `${filename}.pdf`);
    }

    let jsonPath: string;
    try {
      // Try to find the synced JSON file first using the filename we already calculated
      jsonPath = resolve(__dirname, `../../../src/content/documents/${filename}.json`);

      console.log('Loading synced document data...');
      const jsonContent = readFileSync(jsonPath, 'utf-8');
      documentData = JSON.parse(jsonContent);
      console.log(`Found synced document: ${documentData.title}`);

    } catch (jsonError) {
      console.log('Synced document not found, fetching from API...');
      // Fallback to fetching fresh data using the document we already fetched
      documentData = {
        documentId: options.document,
        title: document.name,
        description: document.description || '',
        createdAt: document.createdAt,
        versions: [],
        thumbnails: [],
        labels: [],
        userData: {
          author: {
            name: process.env.AUTHOR_NAME || 'Unknown',
            email: process.env.AUTHOR_EMAIL || '',
            website: process.env.AUTHOR_WEBSITE || ''
          }
        }
      };
    }

    // Read template file (use __dirname to get absolute path to templates)
    const templatePath = resolve(__dirname, `../../templates/${options.template}.typ`);
    console.log(`Reading template: ${templatePath}`);

    try {
      const template = readFileSync(templatePath, 'utf-8');

      // No need to create temp JSON file - Typst will read the synced JSON directly

      // Ensure output directory exists
      mkdirSync(dirname(options.output), { recursive: true });

      // Compile with Typst
      console.log('Compiling PDF with Typst...');
      const absoluteOutput = resolve(options.output);
      const templateFilename = `${options.template}.typ`;

      try {
        const templatesDir = resolve(__dirname, '../../templates');
        const projectRoot = resolve(__dirname, '../../../');

        // Run Typst from project root, passing document filename to template
        execSync(`typst compile "generator/templates/${templateFilename}" "${absoluteOutput}" --root "${projectRoot}" --input document_name="${filename}"`, {
          stdio: 'inherit',
          cwd: projectRoot
        });
        console.log(`✅ PDF generated: ${options.output}`);

      } catch (typstError) {
        console.error('❌ Typst compilation failed. Make sure Typst is installed:');
        console.log('Install: https://typst.app/docs/installation/');
        console.log('Or try: cargo install --git https://github.com/typst/typst --locked typst-cli');
        throw typstError;
      }

    } catch (templateError) {
      if (templateError instanceof Error && 'code' in templateError && templateError.code === 'ENOENT') {
        console.error(`❌ Template file not found: ${templatePath}`);
        console.log('Available templates should be in ./generator/templates/ directory');
        console.log('Expected file: assembly.typ, part.typ, or drawing.typ');
      } else {
        throw templateError;
      }
    }

  } catch (error) {
    console.error('❌ Error generating PDF:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
