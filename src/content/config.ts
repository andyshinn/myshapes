import { defineCollection, z } from 'astro:content';

const documentsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    // API-synced data from Onshape (automatically updated)
    documentId: z.string(),
    title: z.string(),
    description: z.string().default(''),
    createdAt: z.coerce.date(),

    // Document versions from Onshape API (use these instead of changelog)
    versions: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      createdAt: z.coerce.date(),
      microversion: z.string()
    })).default([]),

    // Thumbnails from Onshape API
    thumbnails: z.array(z.object({
      size: z.string(),
      url: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
      mediaType: z.string().optional()
    })).default([]),

    // Labels from Onshape API merged with user labels (simplified to strings)
    labels: z.array(z.string()).default([]),

    // User-editable data (preserved during sync)
    userData: z.object({
      // Onshape metadata
      workspaceId: z.string().optional(),
      elementId: z.string().optional(),

      // User-only labels (these get merged with API labels)
      labels: z.array(z.string()).default([]),

      // 3D printing info (user-provided)
      printingInfo: z.object({
        printTime: z.number().optional(),
        filamentUsage: z.number().optional(),
        layerHeight: z.number().optional(),
        infillPercentage: z.number().optional(),
        supportRequired: z.boolean().default(false),
        materials: z.array(z.string()).default([])
      }).optional(),

      // Personal information
      author: z.object({
        name: z.string(),
        email: z.string().optional(),
        website: z.string().optional()
      })
    }).passthrough() // Allow additional custom fields
  })
});

export const collections = {
  documents: documentsCollection
};
