// Onshape API Response Types
export interface OnshapeDocument {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  modifiedAt: string;
  owner: OnshapeUser;
  public: boolean;
}

export interface OnshapeUser {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export interface OnshapeWorkspace {
  id: string;
  name: string;
  isMain: boolean;
  description?: string;
  microversion: string;
}

export interface OnshapeElement {
  id: string;
  name: string;
  type: 'PARTSTUDIO' | 'ASSEMBLY' | 'DRAWING' | 'BLOB';
  microversionId: string;
  elementType: string;
}

export interface OnshapeThumbnail {
  size: string;
  data: ArrayBuffer;
  url: string;
}

export interface OnshapeThumbnails {
  small: string;
  medium: string;
  large: string;
}

// New thumbnail structure for lists
export interface ThumbnailInfo {
  size: string;
  url: string;
  width?: number;
  height?: number;
}

// Document versions
export interface DocumentVersion {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  microversion: string;
}

// Document Collection Types
export interface DocumentMetadata {
  documentId: string;
  workspaceId?: string;
  elementId?: string;
  title: string;
  description: string;
  createdAt: Date;
  versions: DocumentVersion[];
  thumbnails: ThumbnailInfo[];
  changelog: ChangelogEntry[];
  printingInfo?: PrintingInfo;
  author: AuthorInfo;
}

export interface ChangelogEntry {
  version: string;
  date: Date;
  changes: string[];
  author: string;
}

export interface PrintingInfo {
  printTime?: number;
  filamentUsage?: number;
  layerHeight?: number;
  infillPercentage?: number;
  supportRequired: boolean;
  materials: string[];
}

export interface AuthorInfo {
  name: string;
  email: string;
  website?: string;
}

// CLI Generator Types
export interface GenerateOptions {
  document: string;
  template: string;
  output: string;
}

export interface UploadOptions {
  document: string;
  workspace?: string;
  file: string;
  debug?: boolean;
}

export interface SyncOptions {
  document: string;
  outputDir: string;
  debug?: boolean;
}

export interface TemplateData {
  title: string;
  description: string;
  createdAt: Date;
  modifiedAt: Date;
  author: AuthorInfo;
}

// Document Configuration Types
export interface DocumentConfig {
  description?: string;
  tags?: string[];
  generatePDF?: boolean;
  template?: string;
  // Either URL or individual IDs
  url?: string;
  documentId?: string;
  workspaceId?: string;
  elementId?: string;
}

export interface DocumentsConfig {
  documents: DocumentConfig[];
}

export interface ParsedOnshapeURL {
  documentId: string;
  workspaceId?: string;
  elementId?: string;
  versionId?: string;
  microversionId?: string;
}
