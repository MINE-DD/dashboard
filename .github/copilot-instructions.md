# MINE-DD Dashboard - Copilot Instructions

## Project Overview

This is the **MINE-DD Dashboard**, a geospatial data visualization platform developed by the Netherlands eScience Center. The project serves and visualizes geographical data on an interactive map interface for mining-related data analysis.

## Technology Stack

### Frontend Framework

- **SvelteKit** with **Svelte 5** (using modern runes API)
- **TypeScript** for type safety
- **Vite** as the build tool
- **Static site generation** with `@sveltejs/adapter-static`

### Styling & UI

- **Tailwind CSS** with custom configuration
- **DaisyUI** component library with custom "ctw" theme
- **@tailwindcss/typography**, **@tailwindcss/forms**, **@tailwindcss/container-queries** plugins
- Custom CSS in `src/lib/assets/css/app.css`

### Mapping & Geospatial

- **MapLibre GL JS** for interactive maps
- **GeoTIFF library (geotiff npm package)** for client-side COG processing and rendering
- **Direct COG access** from Cloudflare R2 using HTTP range requests for optimal performance
- **No TiTiler dependency** - all raster processing handled client-side
- Multiple map style sources: CARTO, MapTiler, OpenStreetMap
- Custom map style management with categories (Base Maps, Satellite & Terrain, Themes)

### Backend & Database

- **PostgreSQL** database
- **@auth/sveltekit** with multiple providers (Google, Credentials, Resend)
- **PostgreSQL adapter** for authentication
- **node-pg-migrate** for database migrations
- **Bun.js** runtime support

### Raster Data Backend Architecture

- **Cloud Optimized GeoTIFF (COG)** as the primary raster format
- **Cloudflare R2** as the primary storage backend for COG files
- **Direct COG access** from client-side using range requests for optimal performance
- **Client-side processing** using geotiff.js library for browser-based COG reading and rendering
- **No server intermediary** - eliminates TiTiler dependency and reduces latency
- **S3-compatible storage** pattern for flexibility across different cloud providers

### Data Processing & Visualization

- **Chart.js** for data visualization
- **Papa Parse** for CSV processing
- **date-fns** for date manipulation
- Custom CSV data processor for pathogen data

### Development Tools

- **ESLint** with TypeScript and Svelte plugins
- **Prettier** with Svelte and Tailwind plugins
- **mdsvex** for Markdown processing in Svelte
- **unplugin-icons** for icon management
- **vitest** for testing

## Architecture Patterns

### File Structure & Organization

```
src/
├── lib/
│   ├── components/        # Reusable components
│   │   ├── Map/          # Map-related components (modular structure)
│   │   └── ui/           # UI components
│   ├── stores/           # Svelte stores (modular with index exports)
│   ├── assets/css/       # Stylesheets
│   ├── models/           # Data models and types
│   ├── utils/            # Utility functions
│   └── server/           # Server-side utilities
├── routes/               # SvelteKit pages and layouts
└── app.html             # HTML template
```

### Component Architecture

- **Modular Map Components**: `Map.svelte` uses multiple sub-components (MapCore, MapControls, RasterLayerManager, etc.)
- **Svelte 5 Runes**: Uses modern `$props()`, `$state()`, and `{@render}` syntax
- **Component Composition**: Heavy use of snippet-based composition with `children` props

### Store Management

- **Modular Stores**: Organized in folders with index.ts re-exports
- **Persistent Storage**: Uses `svelte-persisted-store` for user preferences
- **Authentication Store**: Browser-aware with localStorage persistence

### Path Aliases

```typescript
$api: "./src/api";
$components: "./src/lib/components";
$assets: "./src/assets";
$content: "./src/content";
$lib: "./src/lib";
```

## Code Style Guidelines

### Formatting (Prettier Config)

- **Tabs**: Use tabs for indentation
- **Single Quotes**: Prefer single quotes
- **No Trailing Commas**: `trailingComma: "none"`
- **Print Width**: 100 characters
- **HTML Whitespace**: `htmlWhitespaceSensitivity: "ignore"`

### TypeScript Conventions

- **Strict Mode**: Enabled with strict type checking
- **Interface Definitions**: Clear interfaces for props and data models
- **Type Imports**: Use `import type` for type-only imports
- **Modern Module Resolution**: Uses `bundler` resolution

### Svelte 5 Patterns

```svelte
<script lang="ts">
  // Props using runes
  interface Props {
    children?: import('svelte').Snippet;
    someData: DataType;
  }

  let { children, someData }: Props = $props();

  // State using runes
  let isVisible = $state(false);

  // Derived state
  let computedValue = $derived(someData.length > 0);
</script>

<!-- Conditional rendering with snippets -->
{#if children}
  {@render children()}
{:else}
  <!-- Fallback content -->
{/if}
```

### CSS/Styling Conventions

- **Tailwind-first**: Prefer Tailwind utilities over custom CSS
- **DaisyUI Components**: Use DaisyUI components when available
- **Custom Theme**: Uses "ctw" custom theme with specific brand colors
- **Responsive Design**: Uses Tailwind responsive prefixes (`sm:`, `md:`, etc.)
- **Grid Layouts**: Extensive use of CSS Grid (`grid-rows-[auto_auto_1fr]`)

### Map Component Patterns

- **Modular Structure**: Break complex maps into focused sub-components
- **Store-based State**: Use dedicated stores for map state management
- **Layer Management**: Separate components for different layer types
- **Style Management**: Categorized map styles with runtime switching

### Authentication Patterns

- **Multi-provider Support**: Google, Credentials, Resend email
- **JWT Strategy**: Session management with JWT tokens
- **Route Protection**: Server-side route protection patterns
- **Browser-aware**: Conditional rendering based on authentication state

## Environment & Configuration

### Environment Variables

- `VITE_MAPTILER_KEY`: MapTiler API key for satellite imagery
- `AUTH_SECRET`: Authentication secret
- Database connection variables
- `BASE_PATH`: For deployment path configuration
- `VITE_R2_BUCKET_URL`: Cloudflare R2 bucket URL for COG files (optional, defaults to hardcoded URL)

### Deployment

- **Static Site**: Uses static adapter for deployment
- **Vercel**: Primary deployment target
- **Docker**: Containerized development environment (legacy)
- **GitHub Pages**: Alternative deployment option
- **Simplified Infrastructure**: No server-side dependencies for raster processing

## Raster Data Architecture & COG Integration

### Core Principles

**Prioritize Cloud Optimized GeoTIFF (COG) files served directly from S3-compatible storage.** This architecture provides optimal performance, scalability, and cost-effectiveness for geospatial raster data.

### Storage Backend Strategy

#### Primary: Cloudflare R2 + Direct COG Access

- **Cloudflare R2**: Primary storage for all COG files (S3-compatible, cost-effective)
- **Direct browser access**: Client-side COG reading using range requests
- **No server intermediary**: Reduces latency and server load
- **Optimal performance**: Leverages COG's internal tiling and overviews
- **geotiff.js library**: Handles all COG processing in the browser

#### Legacy/Alternative: TiTiler Integration (Deprecated)

- **Note**: TiTiler has been removed from the current architecture
- **Replaced by**: Direct client-side COG processing for better performance
- **Migration complete**: All raster processing now handled by geotiff.js library

### COG File Organization

```
data/cogs/
├── 01_Pathogens/          # Pathogen-related raster data
│   ├── SHIG_*.tif        # Shigella data by demographics
│   └── [pathogen]_*.tif  # Other pathogen datasets
└── 02_Risk_factors/       # Environmental risk factors
    ├── Flr_*.tif         # Fluoride data
    ├── Rfs_*.tif         # Risk factor data
    └── [factor]_*.tif    # Other risk factors
```

### Implementation Guidelines

#### COG Processing Standards

- **Optimize for web access**: Internal tiling (512x512 recommended)
- **Generate overviews**: Multiple resolution levels for zoom performance
- **Proper compression**: Use LZW or DEFLATE for balance of size/speed
- **Coordinate system**: Ensure proper EPSG codes (prefer EPSG:4326 for global data)

#### Client-Side COG Integration

- **GeoTIFF.js library**: For browser-based COG reading and processing
- **MapLibre GL integration**: Add processed COG data as image sources/layers
- **Canvas-based rendering**: Client-side data visualization with colormap application
- **Progressive loading**: Load overviews first, then higher resolution as needed
- **Error handling**: Graceful fallbacks when COG access fails
- **No-data transparency**: Efficient handling of missing data areas

#### Storage URL Patterns

```typescript
// Direct COG access pattern
const cogUrl = `https://r2-bucket.domain.com/cogs/${category}/${filename}.tif`;

// With authentication/signed URLs when needed
const signedCogUrl = await generateSignedUrl(cogPath, ttl);
```

#### Performance Considerations

- **Range request optimization**: Leverage HTTP range requests for partial file access
- **CDN integration**: Use Cloudflare CDN for global distribution
- **Caching strategy**: Implement appropriate cache headers for COG files
- **Bandwidth efficiency**: Only download needed image portions
- **Client-side processing**: Reduce server load by processing COGs in browser
- **Memory management**: Efficient handling of large raster datasets

### Development Workflow

#### Adding New Raster Data

1. **Convert to COG**: Ensure raster files are Cloud Optimized GeoTIFF format
2. **Upload to R2**: Store in appropriate category folder structure
3. **Update metadata**: Add file references to application metadata/config
4. **Test access**: Verify direct browser access and MapLibre integration

#### Alternative Scenarios

- **TiTiler integration**: When advanced server-side processing is required
- **Local development**: COG files can be served locally for development
- **Hybrid approach**: Combine direct COG access with tile services as needed

When implementing raster data features, **always prioritize the direct COG + Cloudflare R2 approach** unless specific requirements necessitate alternative solutions. This ensures optimal performance, scalability, and cost-effectiveness for the geospatial data visualization platform.

### COG Processing Workflow

#### Core Processing Pipeline

```typescript
// 1. Load COG from R2 URL
const cogUrl = `${baseR2url}01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif`;
const tiff = await GeoTIFF.fromUrl(cogUrl);
const image = await tiff.getImage();

// 2. Extract metadata and bounds
const metadata = {
  width: image.getWidth(),
  height: image.getHeight(),
  bounds: image.getBoundingBox(),
  resolution: image.getResolution(),
  samplesPerPixel: image.getSamplesPerPixel(),
};

// 3. Read raster data with range requests
const data = await image.readRasters();

// 4. Process data with colormap on canvas
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const imageData = ctx.createImageData(width, height);

// 5. Apply viridis colormap with transparency
for (let i = 0; i < width * height; i++) {
  const value = data[0][i];
  if (value === 0 || isNaN(value)) {
    // Transparent for no-data
    imageData.data[i * 4 + 3] = 0;
  } else {
    const [r, g, b] = getViridisColor(value);
    imageData.data[i * 4] = r;
    imageData.data[i * 4 + 1] = g;
    imageData.data[i * 4 + 2] = b;
    imageData.data[i * 4 + 3] = 255;
  }
}

// 6. Convert to data URL and add to map
const dataUrl = canvas.toDataURL("image/png");
map.addSource(sourceId, {
  type: "image",
  url: dataUrl,
  coordinates: fixedCoordinates,
});
```

#### Key Implementation Files

- **`src/lib/components/Map/utils/geoTiffProcessor.ts`**: Core COG processing utilities
- **`src/lib/components/Map/store/geoTiffProcessor.ts`**: Alternative processor with global GeoTIFF access
- **`src/lib/stores/raster.store.ts`**: Raster layer state management
- **`src/lib/components/Map/components/GeoTIFFExample.svelte`**: Example implementation
- **`app.html`**: Global GeoTIFF library loaded via CDN

#### Current R2 Configuration

```typescript
// Base R2 URL for all COG files
const baseR2url = "https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/";

// Predefined layer configurations
const layersToAdd = [
  {
    name: "SHIG 0-11 Asym Pr",
    sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif`,
    isVisible: false,
    opacity: 0.8,
  },
  // ... additional layers
];
```

### Error Handling & Debugging

#### Common Issues and Solutions

1. **CORS Errors**: Ensure R2 bucket has proper CORS configuration

   ```json
   {
     "AllowedOrigins": ["*"],
     "AllowedMethods": ["GET", "HEAD"],
     "AllowedHeaders": ["Range", "Accept-Encoding"],
     "MaxAgeSeconds": 3600
   }
   ```

2. **Range Request Failures**: Check that COG files are properly optimized

   ```bash
   # Verify COG structure
   gdalinfo -checksum path/to/file.tif
   ```

3. **Memory Issues**: Handle large COG files with progressive loading

   ```typescript
   // Load overview first, then full resolution
   const overview = await image.getImage(0); // Lowest resolution
   const fullRes = await image.getImage(image.getImageCount() - 1);
   ```

4. **Projection Issues**: Handle coordinate system conversion
   ```typescript
   const geoKeys = image.getGeoKeys();
   const projectionInfo = geoKeys?.ProjectedCSTypeGeoKey
     ? `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`
     : "EPSG:4326";
   ```

### Browser Compatibility

#### GeoTIFF Library Requirements

- **Modern Browsers**: Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
- **Web Workers**: Supported for background processing
- **ArrayBuffer**: Required for binary data handling
- **Canvas API**: Required for image rendering
- **Fetch API**: Required for range requests

#### Fallback Strategies

```typescript
// Check for GeoTIFF support
if (!window.GeoTIFF && typeof GeoTIFF === "undefined") {
  console.error("GeoTIFF library not available");
  // Fallback to static image or error message
}

// Handle browser compatibility
if (!("readAsArrayBuffer" in new FileReader())) {
  console.warn("Limited browser support for binary data");
}
```

### Migration from TiTiler (Completed)

#### What Was Removed

- **Docker Services**: TiTiler container and related services
- **Server Dependencies**: FastAPI, TiTiler, python-multipart
- **Environment Variables**: `VITE_TITILER_ENDPOINT`, `VITE_TITILER_DATA_PREFIX`
- **Tile Endpoints**: All `/cog/` API endpoints for tile serving
- **Volume Mounts**: Local data directory mounting for TiTiler

#### What Was Added

- **geotiff npm package**: Client-side COG processing library
- **Canvas Processing**: Browser-based image rendering
- **Direct R2 Access**: HTTP range requests to Cloudflare R2
- **Client-side Colormaps**: Viridis colormap implementation
- **Transparent No-data**: Proper handling of missing data areas

#### Key Benefits of Migration

- **Reduced Infrastructure**: No server-side processing required
- **Better Performance**: Direct CDN access with edge caching
- **Lower Latency**: Eliminated server round-trips
- **Improved Scalability**: Browser-based processing scales with users
- **Cost Efficiency**: No compute costs for raster processing

#### Migration Checklist for New Features

- ✅ Use `geotiff` library instead of TiTiler endpoints
- ✅ Store COG files in Cloudflare R2 with public access
- ✅ Implement client-side colormap processing
- ✅ Handle coordinate system conversion in browser
- ✅ Use canvas for data visualization
- ✅ Implement proper error handling for network failures
- ✅ Add transparent handling for no-data values

### Development Environment Setup

#### Required Dependencies

```json
{
  "dependencies": {
    "geotiff": "^2.1.1",
    "maplibre-gl": "^5.2.0"
  },
  "devDependencies": {
    "@types/geotiff": "latest"
  }
}
```

#### Local Development with COG Files

```typescript
// For local development, serve COG files statically
const isDev = import.meta.env.DEV;
const baseUrl = isDev
  ? "http://localhost:5173/data/cogs/"
  : "https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/";
```

#### Testing COG Access

```bash
# Test direct COG access
curl -I "https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif"

# Should return 200 OK with Accept-Ranges: bytes header
```

### Performance Optimization Guidelines

#### COG File Optimization

```bash
# Convert existing raster to optimized COG
gdal_translate -of COG \
  -co TILING_SCHEME=GoogleMapsCompatible \
  -co COMPRESS=DEFLATE \
  -co BLOCKSIZE=512 \
  input.tif output_cog.tif

# Add overviews for multi-resolution
gdaladdo -r average output_cog.tif 2 4 8 16 32
```

#### Memory Management

```typescript
// Implement progressive loading
const loadCOGProgressively = async (url: string) => {
  const tiff = await GeoTIFF.fromUrl(url);

  // Load lowest resolution first for quick preview
  const overview = await tiff.getImage(0);
  renderPreview(overview);

  // Load full resolution in background
  const fullImage = await tiff.getImage(tiff.getImageCount() - 1);
  renderFullResolution(fullImage);
};
```

#### Caching Strategy

```typescript
// Implement browser caching for processed data URLs
const cacheKey = `cog-${url}-${colormap}-${rescale.join(",")}`;
const cached = localStorage.getItem(cacheKey);
if (cached) {
  return cached; // Return cached data URL
}

// Process and cache result
const dataUrl = await processGeoTIFF(image, options);
localStorage.setItem(cacheKey, dataUrl);
```

### Best Practices for COG Implementation

#### Code Organization

```typescript
// Preferred structure for COG-related code
src/lib/components/Map/
├── utils/
│   ├── geoTiffProcessor.ts     // Core processing logic
│   ├── colormaps.ts           // Colormap definitions and utilities
│   └── coordinateUtils.ts     // Projection and bounds handling
├── stores/
│   ├── raster.store.ts        // Raster layer state management
│   └── mapState.store.ts      // Map-specific state
└── components/
    ├── RasterLayerManager.svelte
    ├── COGUploader.svelte
    └── LayerControls.svelte
```

#### Error Handling Patterns

```typescript
// Robust error handling for COG operations
const loadCOGWithRetry = async (url: string, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await GeoTIFF.fromUrl(url);
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(
          `Failed to load COG after ${maxRetries} attempts:`,
          error
        );
        throw new Error(`COG loading failed: ${error.message}`);
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
      );
    }
  }
};
```

#### State Management for Raster Layers

```typescript
// Use stores for raster layer management
export const rasterLayers = writable<Map<string, RasterLayer>>(new Map());

// Helper functions for common operations
export const addRasterLayer = (layer: RasterLayer) => {
  rasterLayers.update((layers) => layers.set(layer.id, layer));
};

export const updateLayerVisibility = (id: string, visible: boolean) => {
  rasterLayers.update((layers) => {
    const layer = layers.get(id);
    if (layer) {
      layers.set(id, { ...layer, isVisible: visible });
    }
    return layers;
  });
};
```

#### TypeScript Interfaces

```typescript
// Define clear interfaces for COG data structures
interface RasterLayer {
  id: string;
  name: string;
  sourceUrl: string;
  isVisible: boolean;
  opacity: number;
  bounds?: [number, number, number, number];
  metadata?: GeoTIFFMetadata;
  colormap?: "viridis" | "plasma" | "inferno";
  rescale?: [number, number];
  isLoading?: boolean;
  error?: string | null;
}

interface GeoTIFFMetadata {
  width: number;
  height: number;
  bounds: number[];
  resolution: number[];
  samplesPerPixel: number;
  projection?: string;
}
```

#### CORS Configuration for R2

```json
// Required R2 CORS policy
[
  {
    "AllowedOrigins": ["https://yourdomain.com", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Accept-Encoding", "Accept", "Content-Type"],
    "MaxAgeSeconds": 3600,
    "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges"]
  }
]
```

#### Data Validation

```typescript
// Validate COG data before processing
const validateCOGData = (image: any) => {
  const width = image.getWidth();
  const height = image.getHeight();

  // Prevent excessive memory usage
  if (width * height > 50_000_000) {
    // 50MP limit
    throw new Error("COG file too large for client-side processing");
  }

  // Validate bounds
  const bounds = image.getBoundingBox();
  if (!Array.isArray(bounds) || bounds.length !== 4) {
    throw new Error("Invalid COG bounds data");
  }

  return true;
};
```

#### Environment Variables

```bash
# Production environment variables
VITE_R2_BUCKET_URL=https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev
VITE_MAPTILER_KEY=your_maptiler_key
VITE_SENTRY_DSN=your_sentry_dsn # For error tracking

# Development overrides
VITE_COG_BASE_URL=http://localhost:5173/data/cogs/
VITE_DEBUG_COG=true
```

### Testing Strategies

#### Unit Testing COG Processing

```typescript
// Example test for COG processing utilities
import { describe, it, expect, vi } from "vitest";
import { loadAndProcessGeoTIFF } from "$lib/components/Map/utils/geoTiffProcessor";

describe("COG Processing", () => {
  it("should process valid COG file", async () => {
    const mockUrl = "https://example.com/test.tif";
    const result = await loadAndProcessGeoTIFF(mockUrl);

    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.metadata).toHaveProperty("width");
    expect(result.bounds).toHaveLength(4);
  });

  it("should handle invalid COG gracefully", async () => {
    const invalidUrl = "https://example.com/invalid.tif";
    await expect(loadAndProcessGeoTIFF(invalidUrl)).rejects.toThrow();
  });
});
```

#### Integration Testing

```typescript
// Test COG integration with MapLibre
const testCOGLayerIntegration = async (map, cogUrl) => {
  const { dataUrl, bounds } = await loadAndProcessGeoTIFF(cogUrl);

  map.addSource("test-cog", {
    type: "image",
    url: dataUrl,
    coordinates: convertBoundsToCoordinates(bounds),
  });

  map.addLayer({
    id: "test-cog-layer",
    type: "raster",
    source: "test-cog",
  });

  // Verify layer was added
  expect(map.getLayer("test-cog-layer")).toBeTruthy();
};
```

#### Performance Monitoring

```typescript
// Track COG loading performance
const trackCOGPerformance = async (
  url: string,
  operation: () => Promise<any>
) => {
  const startTime = performance.now();

  try {
    const result = await operation();
    const loadTime = performance.now() - startTime;

    // Send metrics to analytics
    analytics.track("COG_LOAD_SUCCESS", {
      url,
      loadTime,
      fileSize: result.metadata?.width * result.metadata?.height,
    });

    return result;
  } catch (error) {
    analytics.track("COG_LOAD_ERROR", {
      url,
      error: error.message,
      loadTime: performance.now() - startTime,
    });
    throw error;
  }
};
```

#### Error Tracking

```typescript
// Comprehensive error tracking for COG operations
const handleCOGError = (error: Error, context: Record<string, any>) => {
  console.error("COG Error:", error);

  // Send to error tracking service
  Sentry.captureException(error, {
    tags: {
      component: "COG_PROCESSOR",
      operation: context.operation,
    },
    extra: context,
  });

  // Update UI state
  toastStore.addToast({
    type: "error",
    message: `Failed to load raster data: ${error.message}`,
    timeout: 5000,
  });
};
```

When implementing new COG-related features, always follow these patterns and prioritize client-side processing with proper error handling and performance monitoring. The direct COG + R2 approach should be the default choice for all raster data visualization needs.
