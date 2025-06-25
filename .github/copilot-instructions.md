# MINE-DD Dashboard - Copilot Instructions

## Project Overview

The **MINE-DD Dashboard** is a geospatial data visualization platform developed by the Netherlands eScience Center. It serves and visualizes geographical data on an interactive map interface for mining-related data analysis.

## Quick Reference

### Core Architecture

- **Frontend**: SvelteKit + Svelte 5 + TypeScript
- **Raster Data**: Direct COG access from Cloudflare R2 (client-side processing)
- **Maps**: MapLibre GL JS with multiple style sources
- **Database**: PostgreSQL with Auth.js authentication
- **Deployment**: Static site generation with Vercel

### Key Principles

- **State Management**: All shared state in `.store.svelte.ts` files using Svelte 5 runes
- **COG-First**: Prioritize Cloud Optimized GeoTIFF with direct R2 access
- **Client-Side Processing**: Use geotiff.js for browser-based raster processing
- **Modular Components**: Break complex functionality into focused sub-components

## Technology Stack

### Frontend

- **SvelteKit + Svelte 5** (runes API) + **TypeScript**
- **Tailwind CSS + DaisyUI** (custom "ctw" theme)
- **MapLibre GL JS** for interactive maps
- **GeoTIFF library** for client-side COG processing

### Backend & Data

- **PostgreSQL** with **@auth/sveltekit** (Google, Credentials, Resend)
- **Cloudflare R2** for COG storage
- **Chart.js** for visualization, **Papa Parse** for CSV processing

### Development

- **Vite** build tool, **ESLint + Prettier**, **vitest** for testing

## Architecture & Patterns

### File Structure

```
src/
├── lib/
│   ├── components/        # Reusable components
│   │   ├── Map/          # Map-related components (modular)
│   │   └── ui/           # UI components
│   ├── stores/           # Svelte stores (.store.svelte.ts)
│   ├── models/           # Data models and types
│   └── utils/            # Utility functions
├── routes/               # SvelteKit pages and layouts
└── app.html             # HTML template
```

### State Management (Svelte 5 Runes)

**ALL shared state must live in `.store.svelte.ts` files:**

```typescript
// stores/example.store.svelte.ts
let state = $state({ data: null, loading: false });
let derived = $derived(state.data?.length > 0);

export const exampleStore = {
  get state() {
    return state;
  },
  get derived() {
    return derived;
  },
  async fetchData() {
    state.loading = true;
    // API call logic
    state.loading = false;
  },
};
```

**Components consume stores:**

```svelte
<script lang="ts">
  import { exampleStore } from '$lib/stores/example.store.svelte.ts';

  let { someData }: { someData: DataType } = $props();
  let localState = $state(false);
</script>
```

## Code Style Guidelines

### Formatting

- **Tabs** for indentation, **single quotes**, **100 char width**
- **No trailing commas**, **TypeScript strict mode**

### Svelte 5 Patterns

- Use `$props()`, `$state()`, `$derived()`, `$effect()`
- Snippet-based composition with `{@render children()}`
- Interface definitions for all props

### CSS/Styling

- **Tailwind-first** approach, use DaisyUI components
- **Responsive design** with Tailwind prefixes (`sm:`, `md:`, etc.)
- **CSS Grid** for complex layouts

## Environment & Configuration

### Environment Variables

```bash
VITE_MAPTILER_KEY=your_maptiler_key
AUTH_SECRET=your_auth_secret
VITE_R2_BUCKET_URL=https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev
BASE_PATH=/optional-path
```

### Deployment

- **Vercel** (primary), **GitHub Pages** (alternative)
- Static site generation with `@sveltejs/adapter-static`

## Raster Data & COG Integration

### Core Principles

**Always prioritize Cloud Optimized GeoTIFF (COG) files served directly from Cloudflare R2.**

### Architecture

- **Cloudflare R2**: Primary storage for COG files (S3-compatible)
- **Direct browser access**: Client-side COG reading using HTTP range requests
- **geotiff.js library**: Handles all COG processing in the browser
- **No server intermediary**: Reduces latency and server load

### COG File Organization

```
data/cogs/
├── 01_Pathogens/          # Pathogen-related raster data
│   └── SHIG_*.tif        # Shigella data by demographics
└── 02_Risk_factors/       # Environmental risk factors
    ├── Flr_*.tif         # Fluoride data
    └── Rfs_*.tif         # Risk factor data
```

### Processing Workflow

```typescript
// 1. Load COG from R2
const tiff = await GeoTIFF.fromUrl(cogUrl);
const image = await tiff.getImage();

// 2. Read raster data
const data = await image.readRasters();

// 3. Apply colormap and render to canvas
const canvas = document.createElement("canvas");
// ... colormap processing ...

// 4. Add to map as image source
map.addSource(sourceId, {
  type: "image",
  url: canvas.toDataURL("image/png"),
  coordinates: fixedCoordinates,
});
```

### Key Files

- `src/lib/components/Map/utils/geoTiffProcessor.ts`: Core COG processing
- `src/lib/stores/raster.store.ts`: Raster layer state management
- `app.html`: Global GeoTIFF library via CDN

### R2 Configuration

- Base URL: `https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/`
- CORS enabled for range requests
- Direct client access (no authentication)

## Common Patterns & Best Practices

### Error Handling

```typescript
// COG loading with retry
const loadCOGWithRetry = async (url: string, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await GeoTIFF.fromUrl(url);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
      );
    }
  }
};
```

### TypeScript Interfaces

```typescript
interface RasterLayer {
  id: string;
  name: string;
  sourceUrl: string;
  isVisible: boolean;
  opacity: number;
  bounds?: [number, number, number, number];
  metadata?: GeoTIFFMetadata;
  colormap?: "viridis" | "plasma" | "inferno";
  isLoading?: boolean;
  error?: string | null;
}
```

### Performance Optimization

- **Progressive loading**: Load overviews first, then full resolution
- **Browser caching**: Cache processed data URLs in localStorage
- **Memory management**: Validate COG size before processing (50MP limit)
- **Range requests**: Leverage HTTP range requests for partial file access

## Development & Testing

### Dependencies

```json
{
  "dependencies": {
    "geotiff": "^2.1.1",
    "maplibre-gl": "^5.2.0"
  }
}
```

### Local Development

```typescript
const baseUrl = import.meta.env.DEV
  ? "http://localhost:5173/data/cogs/"
  : "https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/";
```

### Testing COG Access

```bash
curl -I "https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif"
# Should return 200 OK with Accept-Ranges: bytes header
```

## Migration Notes (TiTiler → Direct COG)

### What Was Removed

- Docker services, FastAPI, TiTiler dependencies
- Server-side tile endpoints (`/cog/` API routes)
- `VITE_TITILER_ENDPOINT` environment variables

### What Was Added

- Client-side COG processing with geotiff.js
- Direct R2 access with HTTP range requests
- Browser-based colormap rendering

### Key Benefits

- **Reduced infrastructure**: No server-side processing
- **Better performance**: Direct CDN access with edge caching
- **Lower latency**: Eliminated server round-trips
- **Cost efficiency**: No compute costs for raster processing

---

**Always prioritize the direct COG + R2 approach for optimal performance, scalability, and cost-effectiveness.**
