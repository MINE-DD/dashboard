# Architecture

Technical reference for the Plan-EO Dashboard. Covers code structure, data flow, development setup, and conventions.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Map Component Architecture](#map-component-architecture)
3. [Data Flow](#data-flow)
4. [Raster System](#raster-system)
5. [Development Setup](#development-setup)
6. [Testing](#testing)
7. [Code Style](#code-style)
8. [Svelte 5 Patterns](#svelte-5-patterns)
9. [Processing Raster Maps](#processing-raster-maps)
10. [Performance Considerations](#performance-considerations)
11. [Known Issues](#known-issues)

---

## Architecture Overview

The dashboard is a fully static SvelteKit application. There is no backend server or database -- all data processing (CSV parsing, GeoTIFF rendering) happens client-side in the browser. The production build is served by nginx inside a Docker container.

### Directory Structure

```
app/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Map/                    # Map system (modular components)
│   │   │   │   ├── Map.svelte          # Main container
│   │   │   │   ├── components/         # Sub-components (MapCore, MapSidebar, etc.)
│   │   │   │   ├── store/              # Map-specific state and filter-raster mapping
│   │   │   │   └── utils/              # Map utilities (CSV processing, GeoTIFF, etc.)
│   │   │   └── ui/                     # Reusable UI components
│   │   ├── services/                   # Service modules (rasterConfig, rasterMetadata)
│   │   ├── stores/                     # Global state management (.store.svelte.ts)
│   │   ├── types/                      # TypeScript type definitions
│   │   └── utils/                      # General utilities
│   └── routes/                         # SvelteKit pages and layouts
├── static/
│   └── data/
│       └── 01_Points/                  # CSV point data (baked into Docker image)
├── tests/
│   ├── unit/                           # Unit tests (utils, stores)
│   ├── integration/                    # End-to-end workflow tests
│   ├── fixtures/                       # Sample data files
│   ├── helpers/                        # Test utilities and mocks
│   └── setup/                          # Test environment configuration
└── migrations/                         # Database migrations (legacy)
```

### Component Architecture

The application is a single-page dashboard with the map as its primary interface. The top-level route (`+page.svelte`) renders `Map.svelte`, which orchestrates all sub-components.

Key architectural decisions:

- **Static site generation**: SvelteKit adapter-static produces pure HTML/JS/CSS. No SSR at runtime.
- **Client-side data processing**: CSV parsing (PapaParse) and GeoTIFF rendering (GeoTIFF.js) run entirely in the browser.
- **Config-driven raster layers**: The `raster-layers.json` file controls which layers appear, decoupling data management from code.
- **Svelte 5 runes**: All state management uses the runes API (`$state`, `$derived`, `$effect`) in `.store.svelte.ts` files.

---

## Map Component Architecture

The map system is modular, with each component responsible for a specific concern:

| Component | Responsibility |
|-----------|---------------|
| `Map.svelte` | Main container, orchestrates all map functionality |
| `MapCore.svelte` | MapLibre GL JS instance lifecycle management |
| `MapControls.svelte` | Zoom, rotation, 3D tilt controls |
| `MapSidebar.svelte` | Filter dropdowns, layer controls, settings panel |
| `MapLegend.svelte` | Data visualization legend |
| `RasterLayerManager.svelte` | COG layer loading, visibility, and opacity management |
| `VisualizationTypeSelector.svelte` | Visualization mode switcher |
| `MapPopover.svelte` | Point detail popups with prevalence and confidence intervals |
| `FilterDropdown.svelte` | Individual filter UI component |

### Visualization Types

The map supports multiple visualization modes, each implemented in dedicated utility modules:

| Mode | Module | Description |
|------|--------|-------------|
| `dots` | (built-in MapLibre) | Simple point markers, color-coded by study design |
| `pie` | `pieChartUtils.ts` | Pie charts at locations, size indicates sample size |
| `3d-bars` | `barExtrusionUtils.ts` | 3D extruded bars, height represents prevalence |
| `heatmap` | `heatmapUtils.ts` | Density-based heat map visualization |
| `hexbin` | (built-in) | Hexagonal binning |

Visualization switching is stable -- the system prevents excessive re-initializations when switching between modes.

---

## Data Flow

### Point Data (CSV)

```
app/static/data/01_Points/*.csv
    |
    v
csvDataProcessor.ts         Parses CSV (semicolon-delimited), validates columns
    |
    v
geoJsonConverter.ts         Converts rows to GeoJSON FeatureCollection
    |
    v
filter.store.ts             Populates filter options (pathogens, age groups, syndromes)
    |
    v
MapCore.svelte              Renders GeoJSON as map source/layers
```

The dashboard loads all CSV files from the `01_Points/` directory. At runtime, it picks the most recent file by the date prefix in the filename.

### Raster Layer Configuration

```
raster-layers.json          JSON config file listing all available layers
    |
    v
rasterConfig.ts             Fetches and caches config; provides helper functions
    |                       (loadRasterConfig, getLayerSourceUrl, getLayerId)
    v
raster.store.ts             Populates rasterLayers store with layer metadata
    |                       (loadRasterLayersFromConfig)
    v
filterRasterMapping.ts      Builds pathogen/age/syndrome -> layer ID mappings
    |                       (autoVisibleRasterLayers derived store)
    v
MapSidebar.svelte           Displays layer controls; marks filter options
                            that have associated raster layers
```

### Filter-to-Raster Mapping

When a user selects filters (pathogen + age group + syndrome), the system automatically shows matching raster layers:

1. `filterRasterMapping.ts` maintains a derived store (`autoVisibleRasterLayers`) that reacts to filter changes.
2. It compares the selected pathogen, age group, and syndrome against the `pathogen`, `ageGroup`, and `syndrome` fields in `raster-layers.json`.
3. Matching layers are automatically made visible; previously auto-shown layers are hidden when filters change.
4. The sidebar marks filter options that have associated raster layers with an indicator icon.

### Raster Rendering Pipeline

```
User toggles layer (or filter triggers auto-show)
    |
    v
geoTiffProcessor.ts         Fetches COG via HTTP range requests (GeoTIFF.js)
    |                       Reads raster data into typed arrays
    v
Canvas rendering            Applies colormap (viridis), renders to canvas element
    |
    v
MapLibre image source       canvas.toDataURL() added as map image source with bounds
```

---

## Raster System

### Cloud Optimized GeoTIFFs (COGs)

The dashboard processes COG files entirely client-side using GeoTIFF.js:

- **HTTP range requests** allow loading only the needed portions of large files.
- **Overview levels** enable progressive loading at different zoom levels.
- **Canvas-based rendering** applies colormaps and produces image overlays for MapLibre.

### Confidence Intervals

For raster data, confidence intervals are computed on click:

- **Prevalence raster**: `*_Pr.tif` (values in percentage points, 0-100)
- **Standard error raster**: `*_SE.tif` (inferred by replacing `_Pr.tif` with `_SE.tif`)
- **Formula**: `CI = Pr +/- 1.96 * SE`, clamped to [0, 100]
- **Display**: formatted as `XX.XX (LL.LL-UU.UU)` in the popover
- SE rasters are loaded on demand and cached in memory.

### Layer Ordering

The system guarantees that point data layers always render above raster layers. This is enforced by:

1. Moving the points layer to top when initially added
2. Re-ordering on `sourcedata` events (when new raster sources load)
3. Re-ordering on `styledata` events (when map style changes)

---

## Development Setup

### Prerequisites

- **Docker Desktop** for containerized development, OR
- **Bun** (latest version) for local development

### Commands

```bash
# Docker development (runs at localhost:4000)
docker compose up -d
docker compose logs -f           # View logs
docker compose down              # Stop

# Local development (runs at localhost:5173)
cd app
bun install                      # Install dependencies
bun run dev                      # Start dev server
bun run check                    # Svelte-kit sync + type check
bun run lint                     # ESLint + Prettier check
bun run format                   # Auto-format code
bun run build                    # Generate static site
```

### Environment Variables

```bash
# MapTiler API key for map styles (required for satellite/terrain)
VITE_MAPTILER_KEY=your_maptiler_key

# Base URL for raster data (defaults to /data/cogs/ in production)
VITE_RASTER_BASE_URL=/data/cogs/

# Base URL for point data (defaults to /data/01_Points in production)
VITE_R2_POINTS_BASE_URL=/data/01_Points

# Optional base path for deployment under a subpath
BASE_PATH=/optional-path
```

In the Docker production deployment, these are set at build time via GitHub Actions secrets.

---

## Testing

All tests use Bun's built-in test runner. No additional testing frameworks are required.

### Running Tests

```bash
cd app

bun test                     # Run all tests
bun test --watch             # Watch mode
bun test --coverage          # Coverage report
bun test --coverage && bun run tests/helpers/check-coverage.ts   # Verify thresholds
```

### Test Organization

```
tests/
├── unit/
│   ├── utils/               # Utility function tests
│   │   ├── textFormatter.test.ts
│   │   ├── barExtrusionUtils.test.ts
│   │   ├── heatmapUtils.test.ts
│   │   ├── urlParams.test.ts
│   │   ├── overlapDetection.test.ts
│   │   ├── utils.test.ts
│   │   ├── rasterDataProcessor.test.ts
│   │   ├── colorManager.test.ts
│   │   ├── pieChartUtils.test.ts
│   │   ├── csvDataProcessor.test.ts
│   │   ├── geoTiffProcessor.test.ts
│   │   └── geoJsonConverter.test.ts
│   └── stores/              # Store and state management tests
├── integration/
│   └── data-processing/     # Full data pipeline tests
├── fixtures/                # Sample data files
├── helpers/                 # Test utilities, mocks, coverage checker
└── setup/                   # Test environment configuration
```

### Coverage Goals

| Metric | Threshold |
|--------|-----------|
| Statements | 85% |
| Branches | 80% |
| Lines | 85% |
| Functions | 85% |

### Writing Tests

Tests use Bun's native test framework:

```typescript
import { describe, test, expect } from 'bun:test';
import { myFunction } from '$lib/utils/myModule';

describe('myModule', () => {
  describe('myFunction', () => {
    test('does something expected', () => {
      const result = myFunction('input');
      expect(result).toBe('expected output');
    });

    test('handles edge cases', () => {
      expect(myFunction('')).toBe('');
      expect(myFunction(null)).toBeNull();
    });
  });
});
```

---

## Code Style

### TypeScript

- **Strict mode** enabled -- no implicit any
- Explicit type annotations for props and function parameters
- Interface definitions for all component props
- Avoid `any` type -- use `unknown` or specific types

### Formatting

- **Tabs** for indentation
- **Single quotes** for strings
- **No trailing commas**
- **100 character** line width
- Run `bun run format` before committing

### CSS and Styling

- **Tailwind-first** approach -- use utilities over custom CSS
- **DaisyUI components** for complex UI patterns
- **Responsive design** with Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`)
- **CSS Grid** for complex layouts: `grid-rows-[auto_auto_1fr]`
- **Custom theme** "ctw" with specific brand colors

---

## Svelte 5 Patterns

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

Note: Some stores still use Svelte 4 writable/derived stores (e.g., `raster.store.ts`, `filter.store.ts`). These are functional but may be migrated to runes over time.

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

{#if children}
  {@render children()}
{/if}
```

---

## Processing Raster Maps

The repository includes a GDAL script (`process_rasters.sh`) for converting raster files into Cloud Optimized GeoTIFFs.

### Prerequisites

```bash
# macOS
brew install gdal

# Ubuntu/Debian
sudo apt-get install gdal-bin python3-gdal
```

### Usage

1. Place `.tif` files in `data/02_Rasters/` (subdirectories supported).

2. Run the conversion:
   ```bash
   bash process_rasters.sh
   ```

3. The script will:
   - Reproject all rasters to EPSG:4326 (WGS 84) using bilinear resampling
   - Convert to Cloud Optimized GeoTIFFs with Google Maps Compatible tiling
   - Apply DEFLATE compression
   - Preserve subdirectory structure in the output
   - Copy associated metadata files

4. Output appears in `data/cogs/`, maintaining the input directory structure.

### Customization

Adjustable parameters in the script:

| Parameter | Location | Options |
|-----------|----------|---------|
| Input/output directories | `INPUT_DIR`, `OUTPUT_DIR` variables | Any valid path |
| Coordinate reference system | `-t_srs` in `gdalwarp` | Any EPSG code |
| Resampling method | `-r` in `gdalwarp` | nearest, bilinear, cubic, cubicspline |
| Compression | `gdal_translate` options | DEFLATE, LZW, ZSTD |

---

## Performance Considerations

### COG Processing

- **50 megapixel limit** for raster processing to prevent browser memory exhaustion
- **Progressive loading** using overview levels in COG files
- **Browser caching** of processed data URLs
- **HTTP range requests** for partial file access (only needed tiles are fetched)

### Map Rendering

- **Stable visualization switching** without full re-initialization of the MapLibre instance
- **Layer ordering** enforcement ensures points always render above rasters
- **Efficient filter application** updates data without full reloads
- **Debounced updates** for URL parameter serialization and smoother interactions

### Memory Management

- Map sources and layers are cleaned up when components unmount
- Concurrent raster loads are limited to prevent memory exhaustion
- SE rasters (for confidence intervals) are cached in memory after first load

---

## Known Issues

- Performance may degrade when many raster layers are visible simultaneously.
- Some naming inconsistencies exist between CSV data and raster layer IDs, requiring the `pathogen`, `ageGroup`, and `syndrome` fields in `raster-layers.json` to match CSV values exactly.
- Duplicate age group options may appear in filter dropdowns in certain scenarios.
