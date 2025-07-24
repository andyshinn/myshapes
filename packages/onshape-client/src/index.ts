import axios, { type AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import crypto from 'crypto';
import FormData from 'form-data';

export enum DocumentFilter {
  MY_DOCUMENTS = 0,
  CREATED = 1,
  SHARED = 2,
  TRASH = 3,
  PUBLIC = 4,
  RECENT = 5,
  BY_OWNER = 6,
  BY_COMPANY = 7,
  BY_TEAM = 9
}

export enum OwnerType {
  USER = 0,
  COMPANY = 1,
  ONSHAPE = 2
}

export enum SortColumn {
  NAME = 'name',
  MODIFIED_AT = 'modifiedAt',
  CREATED_AT = 'createdAt',
  EMAIL = 'email',
  MODIFIED_BY = 'modifiedBy',
  PROMOTED_AT = 'promotedAt'
}

export interface DocumentsOptions {
  filter?: DocumentFilter;
  q?: string;
  label?: string;
  owner?: string;
  ownerType?: OwnerType;
  project?: string;
  parentId?: string;
  offset?: number;
  limit?: number;
  sortColumn?: SortColumn;
  sortOrder?: 'desc' | 'asc';
}

export class OnshapeClient {
  private api: AxiosInstance;
  private basicAuth: string;
  private debug: boolean;

  constructor(
    private accessKey: string,
    private secretKey: string,
    private baseUrl = 'https://cad.onshape.com',
    debug = false
  ) {
    this.debug = debug;
    // Create Basic Auth header for endpoints that require it
    this.basicAuth = `Basic ${Buffer.from(`${accessKey}:${secretKey}`).toString('base64')}`;

    this.api = axios.create({
      baseURL: `${baseUrl}/api/v12`,
      timeout: 30000
    });

    // Configure automatic retries for 502, 503, 504 errors and network errors
    axiosRetry(this.api, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               error.response?.status === 502 ||
               error.response?.status === 503 ||
               error.response?.status === 504;
      },
      onRetry: (retryCount, error, requestConfig) => {
        if (this.debug) {
          console.log(`⚠️  Retry attempt ${retryCount}/3 for ${error.response?.status || 'network'} error`);
        }
      }
    });

    this.api.interceptors.request.use(config => {
      // Use Basic Auth by default - more endpoints support it
      config.headers['Authorization'] = this.basicAuth;
      // Only set default accept header if none is provided
      if (!config.headers['Accept']) {
        config.headers['accept'] = 'application/json;charset=UTF-8; qs=0.09';
      }

      if (this.debug) {
        console.log('\n🔍 DEBUG: HTTP Request');
        console.log(`${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        console.log('Headers:', JSON.stringify(config.headers, null, 2));
        if (config.data && !(config.data instanceof FormData)) {
          console.log('Body:', JSON.stringify(config.data, null, 2));
        } else if (config.data instanceof FormData) {
          console.log('Body: FormData (multipart/form-data)');
          // Log form fields if possible
          try {
            const fields: any = {};
            config.data.forEach((value: any, key: string) => {
              if (typeof value === 'string') {
                fields[key] = value;
              } else if (value && typeof value === 'object' && value.constructor.name === 'File') {
                fields[key] = `[File: ${value.name || 'unnamed'}]`;
              } else {
                fields[key] = '[Binary Data]';
              }
            });
            console.log('Form Fields:', JSON.stringify(fields, null, 2));
          } catch (e) {
            console.log('Form Fields: [Unable to inspect]');
          }
        }
        if (config.params) {
          console.log('Query Params:', JSON.stringify(config.params, null, 2));
        }
        console.log('');
      }

      return config;
    });

    // Add response interceptor for debug logging
    this.api.interceptors.response.use(
      response => {
        if (this.debug) {
          console.log('\n✅ DEBUG: HTTP Response');
          console.log(`Status: ${response.status} ${response.statusText}`);
          console.log('Headers:', JSON.stringify(response.headers, null, 2));
          if (response.data) {
            if (typeof response.data === 'string' && response.data.length > 500) {
              console.log(`Body: [String data, ${response.data.length} characters]`);
            } else if (typeof response.data === 'object') {
              console.log('Body:', JSON.stringify(response.data, null, 2));
            } else {
              console.log('Body:', response.data);
            }
          }
          console.log('');
        }
        return response;
      },
      error => {
        if (this.debug) {
          console.log('\n❌ DEBUG: HTTP Error');
          if (error.response) {
            console.log(`Status: ${error.response.status} ${error.response.statusText}`);
            console.log('Headers:', JSON.stringify(error.response.headers, null, 2));
            if (error.response.data) {
              console.log('Error Body:', JSON.stringify(error.response.data, null, 2));
            }
          } else if (error.request) {
            console.log('No response received');
            console.log('Request:', error.request);
          } else {
            console.log('Error:', error.message);
          }
          console.log('');
        }
        throw error;
      }
    );
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
    const response = await this.api.get(`/documents/${documentId}`);
    return response.data;
  }

  async getDocumentVersions(documentId: string) {
    const response = await this.api.get(`/documents/d/${documentId}/versions`);
    return response.data;
  }

  async getWorkspaces(documentId: string) {
    const response = await this.api.get(`/documents/d/${documentId}/workspaces`);
    return response.data;
  }

  async getElements(documentId: string, workspaceId: string) {
    const response = await this.api.get(`/documents/d/${documentId}/w/${workspaceId}/elements`);
    return response.data;
  }

  async getDocuments(options: DocumentsOptions = {}) {
    const {
      filter = DocumentFilter.CREATED,
      q,
      label,
      owner,
      ownerType,
      project,
      parentId,
      offset = 0,
      limit = 20,
      sortColumn,
      sortOrder
    } = options;

    const params: any = { filter, offset, limit };
    if (q) params.q = q;
    if (label) params.label = label;
    if (owner) params.owner = owner;
    if (ownerType !== undefined) params.ownerType = ownerType;
    if (project) params.project = project;
    if (parentId) params.parentId = parentId;
    if (sortColumn) params.sortColumn = sortColumn;
    if (sortOrder) params.sortOrder = sortOrder;

    const response = await this.api.get('/documents', { params });
    return response.data;
  }

  async getAllDocuments(options: Omit<DocumentsOptions, 'offset' | 'limit'> = {}) {
    const allDocuments = [];

    // Start with the first page using our standard getDocuments method
    let response = await this.getDocuments({ ...options, limit: 20 });

    while (response.items && response.items.length > 0) {
      allDocuments.push(...response.items);

      // Check if there's a next page
      if (!response.next) {
        break;
      }

      // Extract query parameters from the next URL and use our documents endpoint
      const nextUrlObj = new URL(response.next);
      const searchParams = nextUrlObj.searchParams;

      // Use our standard getDocuments method but with the parameters from next URL
      const nextOptions: any = { ...options };
      if (searchParams.has('offset')) nextOptions.offset = parseInt(searchParams.get('offset')!);
      if (searchParams.has('limit')) nextOptions.limit = parseInt(searchParams.get('limit')!);

      response = await this.getDocuments(nextOptions);
    }

    return allDocuments;
  }

  async getDocumentsByLabel(label: string, filter = DocumentFilter.CREATED) {
    console.log(`🔍 Searching for documents with label: ${label}`);

    // NOTE: The Onshape API's 'label' parameter doesn't work reliably for filtering,
    // so we'll get all documents and filter client-side using the documentLabels
    // property that's already included in the /documents response
    const allDocuments = await this.getAllDocuments({ filter });
    console.log(`Found ${allDocuments.length} total documents to check`);

    // Filter documents that have the specified label using the documentLabels property
    // that's already included in the response - no need for additional API calls!
    // documentLabels is an array of objects with structure: { name: string, id: string, path: string, ... }
    const matchingDocs = allDocuments.filter(doc => {
      // Handle cases where documentLabels might not exist or be empty
      if (!doc.documentLabels || !Array.isArray(doc.documentLabels) || doc.documentLabels.length === 0) {
        return false;
      }

      // Look for a label object with the matching name property
      return doc.documentLabels.some((docLabel: any) =>
        docLabel && typeof docLabel === 'object' && docLabel.name === label
      );
    });

    console.log(`✅ Found ${matchingDocs.length} documents with label "${label}"`);
    return matchingDocs;
  }

  async getDocumentThumbnails(documentId: string, workspaceId?: string) {
    const endpoint = workspaceId
      ? `/thumbnails/d/${documentId}/w/${workspaceId}`
      : `/thumbnails/d/${documentId}`;

    const response = await this.api.get(endpoint);

    // Return thumbnail info as flat list with proper structure
    if (!response.data || !response.data.sizes) {
      return [];
    }

    return response.data.sizes.map((sizeInfo: any) => ({
      size: sizeInfo.size,
      url: sizeInfo.href,
      width: parseInt(sizeInfo.size.split('x')[0]) || undefined,
      height: parseInt(sizeInfo.size.split('x')[1]) || undefined,
      mediaType: sizeInfo.mediaType
    }));
  }

  async getElementThumbnails(documentId: string, workspaceId: string, elementId: string) {
    const endpoint = `/thumbnails/d/${documentId}/w/${workspaceId}/e/${elementId}`;

    const response = await this.api.get(endpoint);

    // Return thumbnail info as list
    return response.data.sizes?.map((size: string) => ({
      size,
      url: `${this.baseUrl}/api/v12${endpoint}/s/${size}`,
      width: undefined, // Could be extracted from API response if available
      height: undefined
    })) || [];
  }

  async uploadPDF(
    documentId: string,
    workspaceId: string,
    pdfBuffer: Buffer,
    filename: string,
    displayName?: string
  ) {
    const form = new FormData();
    form.append('file', pdfBuffer, filename);
    form.append('storeInDocument', 'true');
    form.append('translate', 'false');
    
    // Use display name without extension if provided
    if (displayName) {
      // Remove .pdf extension if it exists in the display name
      const nameWithoutExt = displayName.replace(/\.pdf$/i, '');
      form.append('encodedFilename', `${nameWithoutExt}.pdf`);
    }

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

  async updatePDF(
    documentId: string,
    workspaceId: string,
    elementId: string,
    pdfBuffer: Buffer,
    filename: string,
    displayName?: string
  ) {
    const form = new FormData();
    
    // For updates, use the display name without extension if provided
    if (displayName) {
      const nameWithoutExt = displayName.replace(/\.pdf$/i, '');
      form.append('file', pdfBuffer, `${nameWithoutExt}.pdf`);
      form.append('encodedFilename', `${nameWithoutExt}.pdf`);
    } else {
      form.append('file', pdfBuffer, filename);
    }
    form.append('storeInDocument', 'true');
    form.append('translate', 'false');

    const response = await this.api.post(
      `/blobelements/d/${documentId}/w/${workspaceId}/e/${elementId}`,
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

  async getElementsInDocument(documentId: string, workspaceId: string) {
    const response = await this.api.get(`/documents/d/${documentId}/w/${workspaceId}/elements`);
    return response.data;
  }

  async downloadThumbnail(url: string): Promise<Buffer> {
    // Extract the path from the full URL to make a relative API call
    const urlObj = new URL(url);
    // Remove '/api' from the path since the client base URL already includes '/api/v12'
    const apiPath = urlObj.pathname.replace('/api', '') + urlObj.search;
    
    const response = await this.api.get(apiPath, {
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'image/png, image/jpeg, image/*'
      }
    });
    
    return Buffer.from(response.data);
  }

}
