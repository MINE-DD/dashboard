# MINE-DD Dashboard

## Project Overview

This project is the dashboard component for MINE-DD, an initiative by the Netherlands eScience Center. Its primary purpose is to serve and visualize data on an interactive map for mining-related data analysis.

## Problem Solved

The dashboard provides an interactive interface for visualizing geographical data relevant to the MINE-DD project, including pathogen distribution, risk factors, and demographic analysis through both point data and raster overlays.

## Tech Stack

![](./tech.excalidraw.png)

The application is built using the following technologies:

*   **Frontend:**
    *   SvelteKit (using Svelte 5 runes API) 
    *   TypeScript (strict mode)
    *   Tailwind CSS + DaisyUI (custom "ctw" theme)
    *   MapLibre GL JS (for the interactive map)
    *   GeoTIFF.js (client-side COG processing directly from R2)
*   **Runtime:**
    *   Bun.js (primary package manager and runtime)
*   **Storage:**
    *   Cloudflare R2 (S3-compatible object storage for COGs)
    *   Direct browser access via HTTP range requests
    *   No database or backend processing required
*   **Deployment & Infrastructure:**
    *   Docker & Docker Compose (development only)
    *   GitHub Pages (production deployment with static site generation)
    *   100% client-side COG processing (no server-side dependencies)

## Key Features & Functionalities

*   **Interactive Map:**
    *   Powered by MapLibre GL JS for displaying geographical data
    *   Ensures stable and efficient visualization type switching, preventing excessive re-initializations
    *   Multiple visualization modes: dots, pie charts, 3D bars, heatmap, hexbin
*   **Direct COG Processing (Client-Side):**
    *   Reads Cloud-Optimized GeoTIFF (COG) files directly from Cloudflare R2 storage
    *   Uses GeoTIFF.js library for browser-based raster processing
    *   HTTP range requests enable efficient partial file loading
    *   No server-side processing or database required
    *   Displays COG data using canvas-based rendering with customizable colormaps
    *   Allows users to toggle visibility and adjust opacity of raster layers
    *   Supports loading remote COG layers directly via URL input
    *   Automatically displays relevant raster layers based on filter selections (pathogen, age group, syndrome)
    *   Provides global opacity slider to adjust all visible raster layers simultaneously
    *   Ensures point data (dots) always appear on top of raster layers for better visibility

## Development Setup

### Prerequisites

- **Docker Desktop** must be installed and running on your system
  - Download from [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
  - Ensure Docker is running before proceeding

### Quick Start

```bash
# Clone the repository
git clone https://github.com/escience/mine-dd.git
cd mine-dd/dashboard

# Start all services (frontend + chat backend)
docker compose up -d
```

**🚀 Open your browser and visit [http://localhost:4000](http://localhost:4000)**

### Services Overview

The development environment includes:

- **Frontend Dashboard**: Available at [http://localhost:4000](http://localhost:4000)
- **AI Chat Backend**: Available at [http://localhost:4040](http://localhost:4040)
  - API documentation: [http://localhost:4040/docs](http://localhost:4040/docs)

### Useful Commands

```bash
# View service logs
docker compose logs -f

# View logs for specific service
docker compose logs -f frontend
docker compose logs -f chat-backend

# Stop all services
docker compose down

# Rebuild and restart services
docker compose up -d --build

# Stop and remove all containers, networks, and volumes
docker compose down -v
```

## Architecture Overview

### Directory Structure
```
app/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Map/              # Map system (modular components)
│   │   │   │   ├── components/   # Sub-components
│   │   │   │   ├── store/        # Map-specific state
│   │   │   │   └── utils/        # Map utilities
│   │   │   └── ui/               # Reusable UI components
│   │   ├── stores/               # Global state management (.store.svelte.ts)
│   │   └── utils/                # General utilities
│   └── routes/                   # SvelteKit pages and layouts
├── static/
│   └── data/                     # Static data files
│       ├── 01_Points/            # CSV point data
│       └── cogs/                 # Cloud Optimized GeoTIFFs
└── migrations/                   # Database migrations
```

### Map Component Architecture

The Map system is highly modular:
- `Map.svelte` - Main container orchestrating all map functionality
- `MapCore.svelte` - MapLibre instance management
- `MapControls.svelte` - Zoom, rotation, and 3D controls
- `MapSidebar.svelte` - Filter and layer controls
- `MapLegend.svelte` - Data visualization legend
- `RasterLayerManager.svelte` - COG layer management
- `VisualizationTypeSelector.svelte` - Visualization mode switcher

### Map Visualization Types
The system supports multiple visualization modes:
- `dots` - Simple point markers
- `pie` - Pie charts at locations
- `3d-bars` - 3D extruded bars
- `heatmap` - Heat map visualization
- `hexbin` - Hexagonal binning

## Development Commands

### Local Development
```bash
# Navigate to app directory
cd app

# Install dependencies
bun install

# Start development server
bun run dev          # Runs at localhost:5173

# Type checking
bun run check        # Svelte-kit sync + type check

# Linting and formatting
bun run lint         # ESLint + Prettier check
bun run format       # Auto-format code

# Building for production
bun run build        # Generate static site
```

## Processing Raster Maps

The repository includes a script for processing raster maps into Cloud Optimized GeoTIFFs (COGs) suitable for web visualization.

### Prerequisites

- GDAL must be installed on your system
  ```bash
  # Install GDAL on macOS using Homebrew
  brew install gdal

  # Install GDAL on Ubuntu/Debian
  sudo apt-get install gdal-bin python3-gdal
  ```

### Using the Script

1. Place your raster files (.tif) in the `data/02_Rasters` directory. You can organize them in subdirectories if desired.

2. Run the conversion script:
   ```bash
   bash process_rasters.sh
   ```

3. The script will:
   - Reproject all rasters to EPSG:4326 (WGS 84) using bilinear resampling
   - Convert them to Cloud Optimized GeoTIFFs with Google Maps Compatible tiling
   - Apply DEFLATE compression to reduce file size
   - Preserve the original directory structure in the output
   - Copy any associated metadata files

4. Processed files will be available in the `data/cogs` directory, maintaining the same subdirectory structure as the input.

### Customization

The script can be modified to adjust:
- Input/output directories by changing the `INPUT_DIR` and `OUTPUT_DIR` variables
- Coordinate reference system by changing the `-t_srs` parameter in the `gdalwarp` command
- Resampling method by changing the `-r` parameter (options include: nearest, bilinear, cubic, cubicspline)
- Compression settings in the `gdal_translate` command

## Code Style Guidelines

### TypeScript
- **Strict mode** enabled - no implicit any
- Explicit type annotations for props and function parameters
- Interface definitions for all component props
- Avoid `any` type - use `unknown` or specific types

### Formatting
- **Tabs** for indentation
- **Single quotes** for strings
- **No trailing commas**
- **100 character** line width
- Run `bun run format` before committing

### CSS/Styling
- **Tailwind-first** approach - use utilities over custom CSS
- **DaisyUI components** for complex UI patterns
- **Responsive design** with Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`)
- **CSS Grid** for complex layouts: `grid-rows-[auto_auto_1fr]`
- **Custom theme** "ctw" with specific brand colors

## Svelte 5 Development Patterns

### State Management with Runes

All shared state uses Svelte 5 runes in `.store.svelte.ts` files:

```typescript
// stores/example.store.svelte.ts
let state = $state({ data: null, loading: false });
let derived = $derived(state.data?.length > 0);

export const exampleStore = {
  get state() { return state; },
  get derived() { return derived; },
  async fetchData() { 
    state.loading = true;
    // API call logic
    state.loading = false;
  }
};
```

### Component Props Pattern

```svelte
<script lang="ts">
  interface Props {
    children?: import('svelte').Snippet;
    data: DataType;
    optional?: string;
  }
  
  let { children, data, optional = 'default' }: Props = $props();
  let localState = $state(false);
  let computed = $derived(data.length > 0);
  
  $effect(() => {
    // React to changes
    console.log('Data changed:', data);
  });
</script>

<!-- Conditional rendering with snippets -->
{#if children}
  {@render children()}
{/if}
```

### Raster Data (COG) Processing

COG files are processed client-side directly from Cloudflare R2:

```typescript
// Load COG from R2
const tiff = await GeoTIFF.fromUrl(cogUrl);
const image = await tiff.getImage();
const data = await image.readRasters();

// Process and render to canvas
const canvas = document.createElement('canvas');
// Apply colormap...

// Add to map as image source
map.addSource(sourceId, {
  type: 'image',
  url: canvas.toDataURL('image/png'),
  coordinates: bounds
});
```

### Filter-to-Raster Mapping
Filters automatically trigger relevant raster layers based on:
- **Pathogen selection** (e.g., SHIG → Shigella rasters)
- **Age group selection** (0011, 1223, 2459)
- **Syndrome type** (Asym, Comm, Medi)

## Performance Considerations

### COG Processing
- **50MP pixel limit** for raster processing
- **Progressive loading** with overviews
- **Browser caching** of processed data URLs
- **HTTP range requests** for partial file access

### Map Rendering
- **Stable visualization switching** without re-initialization
- **Layer ordering** ensures points above rasters
- **Efficient filter application** without full reloads
- **Debounced updates** for smoother interactions

### Memory Management
- **Clean up map sources/layers** when components unmount
- **Limit concurrent raster loads** to prevent memory issues
- **Use Web Workers** for heavy processing when possible

## Environment Configuration

### Required Environment Variables
```bash
# MapTiler API key for map styles
VITE_MAPTILER_KEY=your_maptiler_key

# Cloudflare R2 bucket URL for COG storage
VITE_R2_BUCKET_URL=https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev

# Optional base path for deployment
BASE_PATH=/optional-path
```

## Next Steps

* Implement thorough testing of the filter-to-raster mapping functionality to ensure it works correctly in all scenarios.
* Optimize performance when dealing with many raster layers simultaneously.
* Add visual feedback when raster layers are loading or when filters are applied.
* Expand the filter-to-raster mapping to include additional pathogens and data categories.
* Improve documentation of the raster layer system for future developers.

## Known Issues

* Performance may degrade when many raster layers are visible simultaneously.
* Some naming inconsistencies exist between CSV data and raster layer IDs, requiring manual mapping.
* Duplicate age group options may appear in filter dropdowns in certain scenarios.
