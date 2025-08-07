import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { OnshapeClient, DocumentFilter } from '../../../packages/onshape-client/src/index.js';
import { syncDocuments } from './sync.js';
import { generatePDF } from './generate.js';
import { uploadPDF } from './upload.js';
import { generateFilenameFromTitle, getPdfDir, getDocumentsDir } from '../utils/document-utils.js';

// Get current file directory for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// axios-retry is now configured in OnshapeClient, so we don't need custom retry logic

interface BulkSyncOptions {
  label?: string;
  filter?: string;
  query?: string;
  generatePdf: boolean;
  template?: string;
  debug?: boolean;
}

interface BulkGenerateOptions {
  label?: string;
  filter?: string;
  query?: string;
  template?: string;
  debug?: boolean;
}

interface BulkUploadOptions {
  label?: string;
  filter?: string;
  query?: string;
  workspace?: string;
  debug?: boolean;
}

// Helper function to convert string filter to enum
function parseDocumentFilter(filterStr?: string): DocumentFilter {
  if (!filterStr) return DocumentFilter.CREATED;

  switch (filterStr.toLowerCase()) {
    case 'my-documents': return DocumentFilter.MY_DOCUMENTS;
    case 'created': return DocumentFilter.CREATED;
    case 'shared': return DocumentFilter.SHARED;
    case 'recent': return DocumentFilter.RECENT;
    case 'public': return DocumentFilter.PUBLIC;
    case 'trash': return DocumentFilter.TRASH;
    default: return DocumentFilter.CREATED;
  }
}

export async function bulkSync(options: BulkSyncOptions) {
  try {
    const filter = parseDocumentFilter(options.filter);
    const searchCriteria = [];
    if (options.label) searchCriteria.push(`label: "${options.label}"`);
    if (options.query) searchCriteria.push(`query: "${options.query}"`);
    if (options.filter) searchCriteria.push(`filter: ${options.filter}`);

    console.log(`🚀 Starting bulk sync for documents with ${searchCriteria.join(', ')}`);
    console.log(`📄 PDF generation: ${options.generatePdf ? 'enabled' : 'disabled'}`);

    // Initialize Onshape client
    const client = new OnshapeClient(
      process.env.ONSHAPE_ACCESS_KEY!,
      process.env.ONSHAPE_SECRET_KEY!,
      'https://cad.onshape.com',
      (options as any).debug || false
    );

    // Find documents using the enhanced API
    let documents;
    if (options.label) {
      // Use the optimized label search
      documents = await client.getDocumentsByLabel(options.label, filter);
    } else {
      // Use the general documents API with search options
      const response = await client.getDocuments({
        filter,
        q: options.query
      });
      documents = response.items || [];
    }

    if (documents.length === 0) {
      console.log(`⚠️  No documents found matching the criteria`);
      console.log('Make sure your search criteria match existing documents in Onshape.');
      return;
    }

    console.log(`\n📋 Processing ${documents.length} documents...`);

    for (const [index, doc] of documents.entries()) {
      console.log(`\n[${index + 1}/${documents.length}] Processing: ${doc.name}`);

      try {
        // Sync document metadata
        await syncDocuments({
          document: doc.id,
          outputDir: './src/content/documents'
        });

        // Generate PDF if enabled
        if (options.generatePdf) {
          console.log('Generating PDF...');

          const safeFileName = generateFilenameFromTitle(doc.name);
          const outputPath = resolve(__dirname, '../../../public/pdf', `${safeFileName}.pdf`);

          // Use template from options or default
          const template = options.template || 'technical-documentation';

          await generatePDF({
            document: doc.id,
            template,
            output: outputPath
          });
        }

        console.log(`✅ Completed: ${doc.name}`);

      } catch (error) {
        console.error(`❌ Error processing ${doc.name}:`, error instanceof Error ? error.message : 'Unknown error');
        // Continue with next document instead of failing completely
      }
    }

    console.log('\n🎉 Bulk processing complete!');

  } catch (error) {
    console.error('❌ Error in bulk processing:', error instanceof Error ? error.message : 'Unknown error');

    if (error instanceof Error && 'response' in error && (error as any).response?.status === 401) {
      console.error('Check your ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY environment variables');
    }

    process.exit(1);
  }
}


export async function bulkGenerate(options: BulkGenerateOptions) {
  try {
    const filter = parseDocumentFilter(options.filter);
    const searchCriteria = [];
    if (options.label) searchCriteria.push(`label: "${options.label}"`);
    if (options.query) searchCriteria.push(`query: "${options.query}"`);
    if (options.filter) searchCriteria.push(`filter: ${options.filter}`);

    console.log(`🚀 Generating PDFs for documents with ${searchCriteria.join(', ')}`);

    // Initialize Onshape client
    const client = new OnshapeClient(
      process.env.ONSHAPE_ACCESS_KEY!,
      process.env.ONSHAPE_SECRET_KEY!,
      'https://cad.onshape.com',
      (options as any).debug || false
    );

    // Find documents using the enhanced API
    let documents;
    if (options.label) {
      // Use the optimized label search
      documents = await client.getDocumentsByLabel(options.label, filter);
    } else {
      // Use the general documents API with search options
      const response = await client.getDocuments({
        filter,
        q: options.query
      });
      documents = response.items || [];
    }

    if (documents.length === 0) {
      console.log(`⚠️  No documents found matching the criteria`);
      console.log('Make sure your search criteria match existing documents in Onshape.');
      return;
    }

    console.log(`\n📄 Generating PDFs for ${documents.length} documents...`);

    for (const [index, doc] of documents.entries()) {
      console.log(`\n[${index + 1}/${documents.length}] Generating PDF for: ${doc.name}`);

      try {
        const safeFileName = generateFilenameFromTitle(doc.name);
        const outputPath = resolve(__dirname, '../../../public/pdf', `${safeFileName}.pdf`);

        // Use template from options or default
        const template = options.template || 'technical-documentation';
        console.log(`Using template: ${template}`);

        await generatePDF({
          document: doc.id,
          template,
          output: outputPath
        });

      } catch (error) {
        console.error(`❌ Error generating PDF for ${doc.name}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    console.log('\n🎉 Bulk PDF generation complete!');

  } catch (error) {
    console.error('❌ Error in bulk PDF generation:', error instanceof Error ? error.message : 'Unknown error');

    if (error instanceof Error && 'response' in error && (error as any).response?.status === 401) {
      console.error('Check your ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY environment variables');
    }

    process.exit(1);
  }
}

export async function bulkUpload(options: BulkUploadOptions) {
  try {
    const searchCriteria = [];
    if (options.label) searchCriteria.push(`label: "${options.label}"`);
    if (options.query) searchCriteria.push(`query: "${options.query}"`);
    if (options.filter) searchCriteria.push(`filter: ${options.filter}`);

    if (options.debug) {
      console.log('🔍 DEBUG: Bulk upload options:', JSON.stringify(options, null, 2));
    }

    console.log(`🚀 Uploading PDFs for documents with ${searchCriteria.join(', ')}`);

    // Get list of JSON files in content directory to find documents
    const contentDir = getDocumentsDir();
    const pdfDir = getPdfDir();
    
    if (!existsSync(contentDir)) {
      console.error('❌ Content directory not found. Run sync first.');
      process.exit(1);
    }
    
    if (!existsSync(pdfDir)) {
      console.error('❌ PDF directory not found. Run generate first.');
      process.exit(1);
    }

    // Read all JSON files
    const jsonFiles = readdirSync(contentDir).filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.log('⚠️  No document JSON files found. Run sync first.');
      return;
    }

    console.log(`\n📁 Found ${jsonFiles.length} document files, checking for matching PDFs...`);

    let uploadCount = 0;
    let skippedCount = 0;
    let processedCount = 0; // Track total documents processed for numbering

    for (const jsonFile of jsonFiles) {
      try {
        // Load document data
        const documentData = JSON.parse(readFileSync(resolve(contentDir, jsonFile), 'utf-8'));
        
        // Skip if label filter doesn't match
        if (options.label && !documentData.labels?.includes(options.label)) {
          continue;
        }

        // Check if corresponding PDF exists
        const pdfFileName = jsonFile.replace('.json', '.pdf');
        const pdfPath = resolve(pdfDir, pdfFileName);

        processedCount++; // Increment for each document we process (regardless of skip reason)

        if (!existsSync(pdfPath)) {
          console.log(`\n[${processedCount}] Skipping ${documentData.title}: PDF not found (${pdfFileName})`);
          skippedCount++;
          continue;
        }

        console.log(`\n[${processedCount}] Uploading PDF for: ${documentData.title}`);

        // Check if PDF upload should be skipped for this document
        if (documentData.userData?.skipPdfUpload === true) {
          console.log(`⏭️  Skipping ${documentData.title}: PDF upload disabled (skipPdfUpload: true)`);
          skippedCount++;
          continue;
        }

        // WORKAROUND: Shell out to single upload command since it works reliably
        try {
          const cliPath = resolve(__dirname, '../index.ts');
          let uploadCmd = `npx tsx "${cliPath}"`;
          
          if (options.debug) {
            uploadCmd += ' --debug';
          }
          
          uploadCmd += ` upload -d ${documentData.documentId}`;
          
          if (options.workspace) {
            uploadCmd += ` -w ${options.workspace}`;
          }

          if (options.debug) {
            console.log(`🔧 Running single upload command: ${uploadCmd}`);
          }

          execSync(uploadCmd, { 
            stdio: 'inherit', // Show output in real-time
            cwd: resolve(__dirname, '../../..') // Run from project root
          });

          uploadCount++;

          // Add delay between uploads to prevent rate limiting
          if (processedCount < jsonFiles.length) {
            const delay = 2000; // 2 second delay between uploads
            if (options.debug) {
              console.log(`⏱️  Waiting ${delay}ms before next upload...`);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (uploadError) {
          console.error(`❌ Failed to upload PDF for ${documentData.title}:`, uploadError instanceof Error ? uploadError.message : 'Unknown error');
          skippedCount++;
        }

      } catch (error) {
        console.error(`❌ Error processing ${jsonFile}:`, error instanceof Error ? error.message : 'Unknown error');
        skippedCount++;
      }
    }

    console.log(`\n🎉 Bulk upload complete!`);
    console.log(`   Uploaded: ${uploadCount} PDFs`);
    console.log(`   Skipped: ${skippedCount} documents`);

  } catch (error) {
    console.error('❌ Error in bulk upload:', error instanceof Error ? error.message : 'Unknown error');

    if (error instanceof Error && 'response' in error && (error as any).response?.status === 401) {
      console.error('Check your ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY environment variables');
    }

    process.exit(1);
  }
}
