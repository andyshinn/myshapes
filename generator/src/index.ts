#!/usr/bin/env node
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

// Load .env from project root (handle both running from generator dir and project root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try different possible locations for .env file
const envPaths = [
  resolve('../.env'),           // Running from generator directory  
  resolve('../../.env'),        // Running from generator/src directory
  resolve('.env'),              // Running from project root
  resolve(__dirname, '../../../.env'), // Absolute path from this file location
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  Warning: Could not find .env file. Make sure ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY are set.');
}
import { Command } from 'commander';
import { generatePDF } from './commands/generate.js';
import { uploadPDF } from './commands/upload.js';
import { syncDocuments } from './commands/sync.js';
import { bulkSync, bulkGenerate, bulkUpload } from './commands/bulk.js';
import { listDocuments } from './commands/list.js';

const program = new Command();

program
  .name('myshapes-gen')
  .description('CLI for generating and uploading PDFs to Onshape documents')
  .version('1.0.0')
  .option('--debug', 'Enable debug logging for HTTP requests and responses');

program
  .command('sync')
  .description('Sync document metadata from Onshape to Astro content')
  .requiredOption('-d, --document <id>', 'Onshape document ID')
  .option('--output-dir <path>', 'Output directory for JSON files', './src/content/documents')
  .action((options, command) => {
    const globalOptions = command.parent?.opts() || {};
    syncDocuments({ ...options, debug: globalOptions.debug });
  });

program
  .command('generate')
  .description('Generate PDF from Typst template')
  .requiredOption('-d, --document <id>', 'Onshape document ID')
  .option('-t, --template <path>', 'Template file path (default: technical-documentation.typ)', 'technical-documentation')
  .option('-o, --output <path>', 'Output file path (default: public/pdf/{document-name}.pdf)')
  .action(generatePDF);

program
  .command('upload')
  .description('Upload PDF to Onshape document')
  .requiredOption('-d, --document <id>', 'Onshape document ID')
  .option('-w, --workspace <id>', 'Workspace ID (optional, will use main workspace from synced data)')
  .requiredOption('-f, --file <path>', 'PDF file path')
  .action((options, command) => {
    const globalOptions = command.parent?.opts() || {};
    uploadPDF({ ...options, debug: globalOptions.debug });
  });

// Bulk command with subcommands
const bulk = program
  .command('bulk')
  .description('Bulk operations on multiple documents');

bulk
  .command('sync')
  .description('Sync multiple documents by label')
  .option('-l, --label <name>', 'Document label to search for', 'indexed')
  .option('-f, --filter <type>', 'Document filter type (my-documents|created|shared|recent)', 'created')
  .option('-q, --query <text>', 'Search query for document names')
  .option('--no-generate-pdf', 'Skip PDF generation')
  .option('-t, --template <path>', 'Template file path (default: technical-documentation.typ)', 'technical-documentation')
  .action((options, command) => {
    // Get global options from the root program
    const rootCommand = command.parent?.parent || command.parent || command;
    const globalOptions = rootCommand.opts();
    bulkSync({ 
      label: options.label, 
      filter: options.filter,
      query: options.query,
      generatePdf: options.generatePdf !== false,
      template: options.template,
      debug: globalOptions.debug
    });
  });

bulk
  .command('generate')
  .description('Generate PDFs for multiple documents by label')
  .option('-l, --label <name>', 'Document label to search for', 'indexed')
  .option('-f, --filter <type>', 'Document filter type (my-documents|created|shared|recent)', 'created')
  .option('-q, --query <text>', 'Search query for document names')
  .option('-t, --template <path>', 'Template file path (default: technical-documentation.typ)', 'technical-documentation')
  .action((options, command) => {
    // Get global options from the root program
    const rootCommand = command.parent?.parent || command.parent || command;
    const globalOptions = rootCommand.opts();
    bulkGenerate({ 
      label: options.label,
      filter: options.filter,
      query: options.query,
      template: options.template,
      debug: globalOptions.debug
    });
  });

bulk
  .command('upload')
  .description('Upload PDFs for multiple documents by label')
  .option('-l, --label <name>', 'Document label to search for', 'indexed')
  .option('-f, --filter <type>', 'Document filter type (my-documents|created|shared|recent)', 'created')
  .option('-q, --query <text>', 'Search query for document names')
  .option('-w, --workspace <id>', 'Workspace ID (optional, will use main workspace if not provided)')
  .action((options, command) => {
    // Get global options from the root program
    const rootCommand = command.parent?.parent || command.parent || command;
    const globalOptions = rootCommand.opts();
    bulkUpload({ 
      label: options.label,
      filter: options.filter,
      query: options.query,
      workspace: options.workspace,
      debug: globalOptions.debug
    });
  });

program
  .command('list')
  .description('List documents with various filters and options')
  .option('-l, --label <name>', 'Document label to search for')
  .option('-f, --filter <type>', 'Document filter type (my-documents|created|shared|recent)', 'created')
  .option('-q, --query <text>', 'Search query for document names')
  .option('--all-pages', 'Fetch all pages (not just first 20 results)')
  .option('--limit <number>', 'Maximum results per page (1-20)', '20')
  .option('--sort <column>', 'Sort column (name|modifiedAt|createdAt)', 'createdAt')
  .option('--order <direction>', 'Sort order (asc|desc)', 'desc')
  .action((options, command) => {
    const globalOptions = command.parent?.opts() || {};
    listDocuments({ ...options, debug: globalOptions.debug });
  });

program.parse();