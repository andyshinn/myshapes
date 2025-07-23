# MyShapes

A CAD model gallery website built with Astro that showcases 3D models synchronized from Onshape. The site displays model thumbnails, version history, and metadata in a clean, responsive interface.

## Claude

This is a personal project that I put together using Claude Code to create a gallery of my CAD models. While the Astro site and Onshape generator CLI should be mostly portable there is likely a lot of hardcoded stuff that is specific to my models and Onshape account. I also assume there is a lot of room for improvement in the code quality and structure since I am not a TypeScript or Astro expert.

## Overview

MyShapes consists of two main components:

1. **Astro Website** - Static site generator that creates a gallery of CAD models with individual detail pages
2. **CLI Generator** - Command-line tool that synchronizes documents from Onshape API and generates content

## Project Structure

```text
/
├── generator/           # CLI tool for syncing Onshape documents
│   ├── src/
│   │   └── commands/    # CLI commands (sync, etc.)
│   └── package.json
├── packages/
│   └── onshape-client/  # Onshape API client library
├── src/
│   ├── content/
│   │   └── documents/   # Generated JSON files from CLI
│   ├── images/          # Downloaded thumbnails from Onshape
│   ├── layouts/         # Astro layout components
│   └── pages/           # Astro pages (index, document detail)
├── public/
│   └── pdf/            # Generated PDF documentation
└── package.json
```

## Technology Stack

- **Frontend**: Astro 5.x with DaisyUI and Tailwind CSS
- **Content**: Astro Content Collections with Zod validation
- **Icons**: astro-icon with Simple Icons and Material Design Icons
- **API**: Onshape REST API integration
- **CLI**: Node.js with Commander.js

## Development

### Prerequisites

- Node.js 18+
- Onshape API credentials (access key and secret key)

### Environment Setup

Create a `.env` file with your Onshape API credentials:

```env
ONSHAPE_ACCESS_KEY=your_access_key
ONSHAPE_SECRET_KEY=your_secret_key
ONSHAPE_BASE_URL=https://cad.onshape.com
SITE_NAME=Your Site Name
```

### Commands

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run dev` | Start development server at `localhost:4321` |
| `npm run build` | Build production site |
| `npm run preview` | Preview production build |
| `npx tsx generator/src/index.ts sync` | Sync documents from Onshape |

### CLI Generator

The CLI tool synchronizes Onshape documents and generates:

- JSON content files in `src/content/documents/`
- Thumbnail images in `src/images/`
- PDF documentation in `public/pdf/`

The generator uses the Onshape API to fetch document metadata, version history, thumbnails, and labels, then processes them into static content for the Astro site.
