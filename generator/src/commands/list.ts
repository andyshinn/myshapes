import { OnshapeClient, DocumentFilter, SortColumn } from '../../../packages/onshape-client/src/index.js';

interface ListOptions {
  label?: string;
  filter?: string;
  query?: string;
  allPages?: boolean;
  limit?: string;
  sort?: string;
  order?: string;
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

// Helper function to convert string sort column to enum
function parseSortColumn(sortStr?: string): SortColumn {
  if (!sortStr) return SortColumn.CREATED_AT;
  
  switch (sortStr.toLowerCase()) {
    case 'name': return SortColumn.NAME;
    case 'modifiedat': case 'modified': return SortColumn.MODIFIED_AT;
    case 'createdat': case 'created': return SortColumn.CREATED_AT;
    case 'email': return SortColumn.EMAIL;
    case 'modifiedby': return SortColumn.MODIFIED_BY;
    case 'promotedat': case 'promoted': return SortColumn.PROMOTED_AT;
    default: return SortColumn.CREATED_AT;
  }
}

export async function listDocuments(options: ListOptions) {
  try {
    const filter = parseDocumentFilter(options.filter);
    const sortColumn = parseSortColumn(options.sort);
    const limit = Math.min(20, Math.max(1, parseInt(options.limit || '20')));
    
    const searchCriteria = [];
    if (options.label) searchCriteria.push(`label: "${options.label}"`);
    if (options.query) searchCriteria.push(`query: "${options.query}"`);
    if (options.filter) searchCriteria.push(`filter: ${options.filter}`);
    searchCriteria.push(`sort: ${options.sort || 'createdAt'} ${options.order || 'desc'}`);
    
    console.log(`🔍 Listing documents with ${searchCriteria.join(', ')}`);
    if (options.allPages) {
      console.log('📄 Fetching all pages...');
    } else {
      console.log(`📄 Limit: ${limit} results`);
    }
    
    // Initialize Onshape client
    const client = new OnshapeClient(
      process.env.ONSHAPE_ACCESS_KEY!,
      process.env.ONSHAPE_SECRET_KEY!,
      'https://cad.onshape.com',
      (options as any).debug || false
    );
    
    let documents;
    let totalFound = 0;
    
    if (options.allPages) {
      // Use getAllDocuments for complete results
      documents = await client.getAllDocuments({
        filter,
        q: options.query,
        label: options.label,
        sortColumn,
        sortOrder: (options.order as 'asc' | 'desc') || 'desc'
      });
      totalFound = documents.length;
    } else {
      // Use paginated results
      const response = await client.getDocuments({
        filter,
        q: options.query,
        label: options.label,
        limit,
        sortColumn,
        sortOrder: (options.order as 'asc' | 'desc') || 'desc'
      });
      documents = response.items || [];
      totalFound = documents.length;
      
      // Show pagination info if available
      if (response.next) {
        console.log('📄 More results available (use --all-pages to fetch all)');
      }
    }
    
    if (documents.length === 0) {
      console.log('⚠️  No documents found matching the criteria');
      return;
    }
    
    console.log(`\n📋 Found ${totalFound} documents:\n`);
    
    // Display documents in a table-like format
    const maxNameLength = Math.min(50, Math.max(20, ...documents.map((d: any) => d.name.length)));
    
    console.log(`${'Name'.padEnd(maxNameLength)} | ${'ID'.padEnd(23)} | ${'Modified'.padEnd(19)} | Labels`);
    console.log('─'.repeat(maxNameLength + 50));
    
    documents.forEach((doc: any) => {
      const name = doc.name.length > maxNameLength ? 
        doc.name.substring(0, maxNameLength - 3) + '...' : 
        doc.name.padEnd(maxNameLength);
      
      const id = doc.id.substring(0, 23);
      const modified = new Date(doc.modifiedAt || doc.modified_at).toLocaleDateString();
      const labels = (doc.documentLabels || []).map((l: any) => l.name || l).join(', ') || 'None';
      
      console.log(`${name} | ${id} | ${modified.padEnd(19)} | ${labels}`);
    });
    
    console.log(`\n✅ Listed ${documents.length} documents`);
    
    if (options.allPages && documents.length >= 20) {
      console.log('💡 Use filters to narrow down results for better performance');
    }
    
  } catch (error) {
    console.error('❌ Error listing documents:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && 'response' in error && (error as any).response?.status === 401) {
      console.error('Check your ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY environment variables');
    }
    
    process.exit(1);
  }
}