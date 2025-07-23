## Project Overview
MyShapes is a CAD model gallery website built with Astro and DaisyUI that showcases 3D models synced from Onshape. The site features individual document pages with version history, thumbnails, and metadata.

## API References
- fetch https://cad.onshape.com/api/openapi
- The Onshape API is availabe at `docs/openapi.json`

## Development Notes
- When you need to run our TypeScript make sure to use `npx tsx`
- Always create our test debug files in the `testing/` folder
- Dev server runs at http://localhost:4321/
- Uses Playwright browser testing available via MCP

## Project Architecture

### Frontend (Astro + DaisyUI)
- **Framework**: Astro 5.12.1 with Tailwind CSS 4.1.11 and DaisyUI 5.0.46
- **Icons**: astro-icon with @iconify-json/simple-icons and @iconify-json/mdi
- **Theme**: Custom DaisyUI theme called "myshapes" (currently commented out, using default)
- **Layout**: Shared BaseLayout.astro component for consistent header/footer
- **Pages**: 
  - `/` - Homepage with model gallery grid
  - `/[documentId]/` - Individual document detail pages

### Content Management
- **Data Source**: JSON files in `src/content/documents/` synced from Onshape API
- **Content Schema**: Defined in `src/content/config.ts` with Zod validation
- **Document Structure**: Each document has metadata, versions, thumbnails, labels, and user data

### Key Features
- **Document Gallery**: Grid layout showing model cards with thumbnails, version badges, and labels
- **Version History**: Timeline component showing chronological version progression
- **Labels**: Badge system (filters out "indexed" meta label, shows "meshtastic" etc.)
- **Thumbnails**: Main image display (removed additional views section)
- **Social Footer**: Links to GitHub, Discord, YouTube, and personal website

### Data Filtering
- **Labels**: "indexed" label is filtered out on both pages (meta label for sync)
- **Versions**: "Start" versions should be filtered out at CLI level (not yet implemented)

## Content Structure
```
src/content/documents/[documentId].json
{
  "documentId": "string",
  "title": "string", 
  "description": "string",
  "createdAt": "date",
  "updatedAt": "date",
  "versions": [...], // Should exclude "Start" versions
  "thumbnails": [...], // Various sizes from Onshape
  "labels": [...], // Auto + user labels
  "userData": {
    "author": { "name", "email", "website" },
    "pdfElementId": "string"
  }
}
```

## Author Information
- **Name**: Andy Shinn
- **Email**: andys@andyshinn.as  
- **Website**: https://andyshinn.as
- **Social**: GitHub (andyshinn), Discord (andyshinn), YouTube (@andyshinn)

## CLI Integration
- Document sync generates JSON files in `src/content/documents/`
- PDF generation uses same data source
- **TODO**: Filter "Start" versions at CLI level instead of runtime filtering

## Project Workflow
- Read and write our planning to `/docs/progress.md`

## Tech Stack
- **Frontend**: Astro, DaisyUI, Tailwind CSS
- **Icons**: astro-icon with Simple Icons and Material Design Icons  
- **Content**: Astro Content Collections with Zod schemas
- **Testing**: Playwright (via MCP)
- **API**: Onshape REST API
- **Deployment**: Static site generation