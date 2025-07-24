import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OnshapeClient } from '../../../packages/onshape-client/src/index.js';
import type { UploadOptions } from '../../../packages/shared-types/src/index.js';

// Get current file directory for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function uploadPDF(options: UploadOptions) {
  try {
    console.log(`Uploading ${options.file} to document ${options.document}...`);
    
    if (options.debug) {
      console.log('\n🔍 DEBUG: uploadPDF options:', {
        document: options.document,
        workspace: options.workspace,
        file: options.file,
        debug: options.debug
      });
    }
    
    // Check if file exists
    if (!existsSync(options.file)) {
      throw new Error(`PDF file not found: ${options.file}`);
    }
    
    // Try to load document data for workspace ID and existing PDF element ID
    let workspaceId = options.workspace;
    let documentData: any = null;
    let jsonPath: string | null = null;
    
    // Try to find document filename from the PDF path
    const pdfName = options.file.split('/').pop()?.replace('.pdf', '') || '';
    const possibleJsonPath = resolve(__dirname, '../../../src/content/documents', `${pdfName}.json`);
    
    if (existsSync(possibleJsonPath)) {
      try {
        documentData = JSON.parse(readFileSync(possibleJsonPath, 'utf-8'));
        jsonPath = possibleJsonPath;
        
        if (!workspaceId && documentData.mainWorkspaceId) {
          workspaceId = documentData.mainWorkspaceId;
          console.log(`✅ Using main workspace from synced data: ${workspaceId}`);
        }
      } catch (error) {
        console.log('⚠️  Could not load document data:', error instanceof Error ? error.message : 'Unknown error');
      }
    } else {
      console.log('⚠️  No synced document data found');
    }
    
    if (!workspaceId) {
      throw new Error('Workspace ID is required. Provide via -w option or sync the document first to store the main workspace.');
    }
    
    // Initialize Onshape client
    const client = new OnshapeClient(
      process.env.ONSHAPE_ACCESS_KEY!,
      process.env.ONSHAPE_SECRET_KEY!,
      'https://cad.onshape.com',
      options.debug || false
    );
    
    // Read PDF file
    console.log('Reading PDF file...');
    const pdfBuffer = readFileSync(options.file);
    const filename = options.file.split('/').pop() || 'document.pdf';
    
    console.log(`File size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // Check if we have an existing PDF element to update
    const existingElementId = documentData?.userData?.pdfElementId;
    const displayName = documentData?.title; // Use document title as the tab name
    let result: any;
    
    if (existingElementId) {
      console.log(`Updating existing PDF element: ${existingElementId}`);
      if (displayName) {
        console.log(`Setting tab name to: ${displayName}`);
      }
      result = await client.updatePDF(
        options.document,
        workspaceId,
        existingElementId,
        pdfBuffer,
        filename,
        displayName
      );
      console.log(`✅ PDF updated successfully!`);
    } else {
      console.log('Creating new PDF element...');
      if (displayName) {
        console.log(`Setting tab name to: ${displayName}`);
      }
      result = await client.uploadPDF(
        options.document,
        workspaceId,
        pdfBuffer,
        filename,
        displayName
      );
      console.log(`✅ PDF uploaded successfully!`);
      
      // Store the new element ID for future updates
      if (result.id && jsonPath && documentData) {
        try {
          documentData.userData = documentData.userData || {};
          documentData.userData.pdfElementId = result.id;
          writeFileSync(jsonPath, JSON.stringify(documentData, null, 2));
          console.log(`📝 Stored PDF element ID for future updates: ${result.id}`);
        } catch (error) {
          console.log(`⚠️  Could not store PDF element ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    console.log(`   Element ID: ${result.id}`);
    console.log(`   Name: ${result.name || filename}`);
    
    if (result.href) {
      console.log(`   View: ${result.href}`);
    }
    
  } catch (error) {
    console.error('❌ Error uploading PDF:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && 'response' in error) {
      const response = (error as any).response;
      if (response?.status === 401) {
        console.error('Check your ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY environment variables');
      } else if (response?.status === 404) {
        console.error('Document or workspace not found. Check your document ID and workspace ID');
      } else if (response?.status === 413) {
        console.error('File too large. Onshape has file size limits for uploads');
      }
    }
    
    process.exit(1);
  }
}