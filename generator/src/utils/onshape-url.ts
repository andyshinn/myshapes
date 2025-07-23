import type { ParsedOnshapeURL, DocumentConfig } from '../../../packages/shared-types/src/index.js';

/**
 * Parse an Onshape URL to extract document, workspace, element, and version IDs
 * 
 * Expected URL formats:
 * - https://cad.onshape.com/documents/{documentId}/w/{workspaceId}/e/{elementId}
 * - https://cad.onshape.com/documents/{documentId}/v/{versionId}/e/{elementId}
 * - https://cad.onshape.com/documents/{documentId}/m/{microversionId}/e/{elementId}
 */
export function parseOnshapeURL(url: string): ParsedOnshapeURL {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    if (pathParts[0] !== 'documents' || pathParts.length < 2) {
      throw new Error('Invalid Onshape URL format');
    }
    
    const documentId = pathParts[1];
    const result: ParsedOnshapeURL = { documentId };
    
    // Parse the remaining path segments
    for (let i = 2; i < pathParts.length; i += 2) {
      const type = pathParts[i];
      const id = pathParts[i + 1];
      
      if (!id) continue;
      
      switch (type) {
        case 'w':
          result.workspaceId = id;
          break;
        case 'v':
          result.versionId = id;
          break;
        case 'm':
          result.microversionId = id;
          break;
        case 'e':
          result.elementId = id;
          break;
      }
    }
    
    return result;
  } catch (error) {
    throw new Error(`Failed to parse Onshape URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Resolve document configuration to get document ID and workspace ID
 */
export function resolveDocumentConfig(config: DocumentConfig): {
  documentId: string;
  workspaceId?: string;
  elementId?: string;
} {
  if (config.url) {
    const parsed = parseOnshapeURL(config.url);
    return {
      documentId: parsed.documentId,
      workspaceId: parsed.workspaceId || config.workspaceId,
      elementId: parsed.elementId || config.elementId
    };
  } else if (config.documentId) {
    return {
      documentId: config.documentId,
      workspaceId: config.workspaceId,
      elementId: config.elementId
    };
  } else {
    throw new Error('Document configuration must have either url or documentId');
  }
}

/**
 * Validate an Onshape URL format
 */
export function isValidOnshapeURL(url: string): boolean {
  try {
    parseOnshapeURL(url);
    return true;
  } catch {
    return false;
  }
}