import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { OnshapeClient } from '../../../packages/onshape-client/src/index.js';
import type { SyncOptions } from '../../../packages/shared-types/src/index.js';

// Get current file directory for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function downloadThumbnail(url: string, outputPath: string, client: OnshapeClient, debug = false): Promise<void> {
  try {
    if (debug) {
      console.log('\n🔍 DEBUG: Thumbnail Download Request');
      console.log(`GET ${url}`);
      console.log('');
    }

    // Use the OnshapeClient's authenticated request method
    const response = await client.downloadThumbnail(url);

    if (debug) {
      console.log('\n✅ DEBUG: Thumbnail Download Response');
      console.log(`Status: 200 OK (via OnshapeClient)`);
      console.log(`Content-Length: ${response.length} bytes`);
      console.log('');
    }

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, response);
    console.log(`✅ Downloaded thumbnail: ${outputPath}`);
  } catch (error) {
    if (debug) {
      console.log('\n❌ DEBUG: Thumbnail Download Error');
      console.log('Error:', error instanceof Error ? error.message : 'Unknown error');
      console.log('');
    }
    console.log(`⚠️  Failed to download thumbnail from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function syncDocuments(options: SyncOptions) {
  try {
    console.log(`Syncing document ${options.document}...`);

    // Initialize Onshape client
    const client = new OnshapeClient(
      process.env.ONSHAPE_ACCESS_KEY!,
      process.env.ONSHAPE_SECRET_KEY!,
      'https://cad.onshape.com',
      options.debug || false
    );

    // Fetch document metadata
    console.log('Fetching document metadata...');
    const document = await client.getDocument(options.document);
    console.log(`Found document: ${document.name}`);

    // Fetch main workspace
    console.log('Fetching workspaces...');
    let mainWorkspaceId: string | undefined;
    try {
      const workspaces = await client.getWorkspaces(options.document);
      // Find main workspace - it's typically named "Main" and has type "workspace"
      const mainWorkspace = workspaces.find((w: any) =>
        (w.name === "Main" || w.isMain) && w.type === "workspace"
      );
      if (mainWorkspace) {
        mainWorkspaceId = mainWorkspace.id;
        console.log(`✅ Found main workspace: ${mainWorkspace.name || 'Main'} (${mainWorkspaceId})`);
      } else {
        console.log('⚠️  No main workspace found');
      }
    } catch (error) {
      console.log('⚠️  Workspace fetching failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Fetch document versions (these endpoints may require different API permissions)
    console.log('Fetching document versions...');
    let versions: any[] = [];
    try {
      const versionsResponse = await client.getDocumentVersions(options.document);
      versions = versionsResponse
        .map((v: any) => ({
          id: v.id,
          name: v.name || `Version ${v.id}`,
          description: v.description || '',
          createdAt: new Date(v.createdAt || v.created_at),
          microversion: v.microversion || ''
        }))
        .filter((v: any) => v.name !== 'Start'); // Filter out "Start" versions
      console.log(`✅ Found ${versions.length} versions (filtered out "Start" versions)`);
    } catch (error) {
      console.log('⚠️  Versions processing failed:', error instanceof Error ? error.message : 'Unknown error');
      console.log('Full error:', error);
    }

    // Fetch document thumbnails (these endpoints may require different API permissions)
    console.log('Fetching document thumbnails...');
    let thumbnails: any[] = [];
    try {
      thumbnails = await client.getDocumentThumbnails(options.document);
      console.log(`✅ Found ${thumbnails.length} thumbnail sizes`);

      // Download the 600x340 thumbnail for use in PDF templates
      const largeThumbnail = thumbnails.find(t => t.size === '600x340');
      if (largeThumbnail) {
        console.log('Downloading 600x340 thumbnail for PDF templates...');
        const filename = document.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const thumbnailPath = resolve(__dirname, '../../../src/images', `${options.document}-600x340.png`);
        await downloadThumbnail(largeThumbnail.url, thumbnailPath, client, options.debug);
      } else {
        console.log('⚠️  600x340 thumbnail not found - PDF template may not display model image');
      }
    } catch (error) {
      console.log('⚠️  Thumbnails processing failed:', error instanceof Error ? error.message : 'Unknown error');
      console.log('Full error:', error);
    }

    // Determine output path and check for existing file
    const filename = document.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const outputPath = resolve(options.outputDir, `${filename}.json`);
    mkdirSync(dirname(outputPath), { recursive: true });

    // Load existing data if file exists to preserve user changes
    let existingData: any = {};
    if (existsSync(outputPath)) {
      try {
        const existingContent = readFileSync(outputPath, 'utf-8');
        existingData = JSON.parse(existingContent);
        console.log('📄 Found existing file, merging changes...');
      } catch (error) {
        console.log('⚠️  Could not parse existing file, creating new one');
      }
    }

    // Extract label names from API (simplified to strings)
    const apiLabelNames = document.documentLabels?.map((label: any) => label.name).filter(Boolean) || [];

    // User labels from userData (if any) - convert objects to strings if needed
    const userLabels = (existingData.userData?.labels || []).map((label: any) =>
      typeof label === 'string' ? label : label.name || label
    ).filter(Boolean);

    // Merge API labels with user labels (remove duplicates, user labels preserved)
    const allLabels = [...new Set([...apiLabelNames, ...userLabels])];

    // Create API-synced data (fields that should always be updated from API)
    const apiData = {
      documentId: options.document,
      title: document.name,
      description: document.description || '',
      onshapeUrl: `https://cad.onshape.com/documents/${options.document}`,
      mainWorkspaceId,
      createdAt: new Date(document.createdAt),
      versions,
      thumbnails,
      labels: allLabels
    };

    // User-editable fields under userData key (preserve existing values or use defaults)
    const userData = {
      workspaceId: existingData.userData?.workspaceId || existingData.workspaceId || undefined,
      elementId: existingData.userData?.elementId || existingData.elementId || undefined,
      // Preserve PDF element ID if it exists (used for updating existing PDFs)
      pdfElementId: existingData.userData?.pdfElementId || undefined,
      author: existingData.userData?.author || existingData.author || {
        name: process.env.AUTHOR_NAME || 'Unknown',
        email: process.env.AUTHOR_EMAIL || '',
        website: process.env.AUTHOR_WEBSITE || ''
      },
      // Keep user labels for merging (simplified to strings)
      labels: userLabels,
      // Preserve any custom user fields from userData or root level (for migration)
      ...Object.fromEntries(
        Object.entries(existingData.userData || {}).filter(([key]) =>
          !['workspaceId', 'elementId', 'pdfElementId', 'author', 'labels', 'description', 'changelog'].includes(key)
        )
      ),
      // Migrate any custom fields from root level to userData
      ...Object.fromEntries(
        Object.entries(existingData).filter(([key]) =>
          !['documentId', 'title', 'description', 'createdAt', 'versions', 'thumbnails', 'labels', 'workspaceId', 'elementId', 'changelog', 'author', 'userData'].includes(key)
        )
      )
    };

    // Merge API data with user-editable data
    const documentData = {
      ...apiData,
      userData
    };

    writeFileSync(outputPath, JSON.stringify(documentData, null, 2));

    console.log(`✅ Document synced to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error syncing document:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
