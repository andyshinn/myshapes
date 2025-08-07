import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, readdirSync } from 'fs';

// Get current file directory for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generate a safe filename from a document title
 */
export function generateFilenameFromTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Find document data by document ID by scanning all JSON files
 */
export function findDocumentById(documentId: string): { data: any; jsonPath: string; filename: string } | null {
  const documentsDir = resolve(__dirname, '../../../src/content/documents');
  
  if (!existsSync(documentsDir)) {
    return null;
  }
  
  const jsonFiles = readdirSync(documentsDir).filter(file => file.endsWith('.json'));
  
  for (const jsonFile of jsonFiles) {
    const filePath = resolve(documentsDir, jsonFile);
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (data.documentId === documentId) {
        const filename = generateFilenameFromTitle(data.title);
        return {
          data,
          jsonPath: filePath,
          filename
        };
      }
    } catch (error) {
      // Skip invalid JSON files
      continue;
    }
  }
  
  return null;
}

/**
 * Get the path to the PDF file for a given filename
 */
export function getPdfPath(filename: string): string {
  return resolve(__dirname, '../../../public/pdf', `${filename}.pdf`);
}

/**
 * Get the path to the documents directory
 */
export function getDocumentsDir(): string {
  return resolve(__dirname, '../../../src/content/documents');
}

/**
 * Get the path to the PDF directory
 */
export function getPdfDir(): string {
  return resolve(__dirname, '../../../public/pdf');
}