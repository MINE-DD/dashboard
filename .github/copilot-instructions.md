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
- **GeoTIFF** library for raster data processing
- **TiTiler** for serving Cloud-Optimized GeoTIFFs
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
- **TiTiler** as fallback/alternative for serving raster tiles when needed
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

### Deployment

- **Static Site**: Uses static adapter for deployment
- **Vercel**: Primary deployment target
- **Docker**: Containerized development environment
- **GitHub Pages**: Alternative deployment option

## Raster Data Architecture & COG Integration

### Core Principles

**Prioritize Cloud Optimized GeoTIFF (COG) files served directly from S3-compatible storage.** This architecture provides optimal performance, scalability, and cost-effectiveness for geospatial raster data.

### Storage Backend Strategy

#### Primary: Cloudflare R2 + Direct COG Access

- **Cloudflare R2**: Primary storage for all COG files (S3-compatible, cost-effective)
- **Direct browser access**: Client-side COG reading using range requests
- **No server intermediary**: Reduces latency and server load
- **Optimal performance**: Leverages COG's internal tiling and overviews

#### Fallback/Alternative: TiTiler Integration

- **TiTiler service**: For scenarios requiring tile servers or advanced processing
- **Tile-based serving**: When direct COG access isn't suitable
- **Server-side processing**: For color mapping, band combinations, or analytics

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

- **GeoTIFF.js library**: For browser-based COG reading
- **MapLibre GL integration**: Add COG data as sources/layers
- **Progressive loading**: Load overviews first, then higher resolution as needed
- **Error handling**: Graceful fallbacks when COG access fails

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

## Development Practices

### Modularity & Separation of Concerns (CORE PRINCIPLE)

**The application should be as modular as possible within reasonable terms.** Every component, utility, and store should have a single, well-defined responsibility:

#### Component Modularity

- **Break down complex components** into smaller, focused sub-components
- **Single Responsibility**: Each component should handle one specific concern
- **Example**: `Map.svelte` delegates to `MapCore`, `MapControls`, `RasterLayerManager`, `MapSidebar`, etc.
- **Avoid monolithic components** - if a component exceeds ~200 lines, consider splitting it
- **Create specialized components** for distinct UI patterns (modals, forms, data displays)

#### Store Modularity

- **Separate stores by domain**: authentication, map state, user preferences, data processing
- **Use folder structure** with index re-exports for complex store modules
- **Example**: `stores/mapStyle/` contains `types.ts`, `store.ts`, and `index.ts`
- **Avoid god stores** - split large stores into focused, smaller ones

#### Utility Modularity

- **Create specific utility modules** for distinct operations (CSV processing, URL params, data transformations)
- **Group related utilities** in dedicated files or folders
- **Example**: `Map/utils/` contains `urlParams.ts`, `csvDataProcessor.ts`, etc.
- **Pure functions**: Utilities should be stateless and testable

#### API/Service Layer Modularity

- **Separate API calls** by resource type or domain
- **Create service modules** for external integrations (MapTiler, TiTiler, database operations)
- **Abstract complex operations** into dedicated service functions

### Component Development

- Use **Svelte 5 runes** syntax consistently
- Implement **TypeScript interfaces** for all props
- Follow **modular component architecture** with clear separation of concerns
- Use **snippet-based composition** for flexible layouts
- **Extract reusable logic** into composable functions or custom stores
- **Limit component scope** to a single responsibility

### State Management

- Use **Svelte stores** for global state with clear domain separation
- Implement **persistent stores** for user preferences
- Create **modular store structure** with index re-exports
- Use **browser-aware** patterns for SSR compatibility
- **Separate read and write operations** when store logic becomes complex
- **Group related state** in domain-specific store modules

### Styling

- **Tailwind-first** approach with component-specific styles
- Use **DaisyUI** components consistently
- Follow **responsive design** patterns
- Maintain **custom theme** consistency
- **Extract common style patterns** into reusable CSS classes or Svelte components

### Data Processing

- Use **TypeScript** for type-safe data handling
- Implement **CSV processing** in dedicated utility modules
- Use **proper error handling** for async operations
- Follow **modular utility** patterns with single-purpose functions
- **Separate data transformation logic** from UI components
- **Create typed interfaces** for all data structures

### File Organization Principles

- **Group by feature/domain** rather than by file type
- **Use index files** to create clean public APIs for modules
- **Keep related files together** (component + types + utilities + tests)
- **Avoid deep nesting** - prefer flat, organized structures
- **Clear naming conventions** that reflect the module's purpose

## MCP Servers and Documentation

### Context7 MCP Server

**Always prefer using MCP servers when available** for accessing up-to-date library documentation and best practices. The project is configured with the Context7 MCP server which provides access to the latest documentation for popular libraries and frameworks.

#### When to Use MCP Servers

- **Library Documentation**: When implementing features with external libraries (SvelteKit, TailwindCSS, DaisyUI, etc.)
- **API References**: When working with authentication, database operations, or third-party integrations
- **Best Practices**: When looking for current patterns and recommended approaches
- **Troubleshooting**: When debugging issues with specific libraries or frameworks

#### Available MCP Servers

```json
{
  "servers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```

#### Usage Guidelines

1. **Check MCP first** before making assumptions about library APIs or patterns
2. **Verify current documentation** for libraries like:

   - SvelteKit (routing, forms, authentication)
   - Svelte 5 (runes syntax, components)
   - TailwindCSS/DaisyUI (component patterns)
   - @auth/sveltekit (authentication flows)
   - PostgreSQL drivers and ORMs

3. **Use for implementation guidance** when:

   - Setting up new features
   - Integrating external services
   - Following framework-specific patterns
   - Implementing security best practices

4. **Combine with project patterns** by using MCP documentation as a foundation and adapting it to follow the project's modular architecture and coding conventions

#### Example Usage Scenarios

- Implementing new SvelteKit form actions → Check Context7 for latest SvelteKit form patterns
- Adding new authentication providers → Reference current @auth/sveltekit documentation
- Creating responsive layouts → Get latest TailwindCSS/DaisyUI component examples
- Database integration patterns → Check PostgreSQL and relevant driver documentation
- API integration → Reference current HTTP client and validation patterns

Always cross-reference MCP server information with the project's established patterns to maintain consistency while leveraging the most current library documentation and best practices.

When working on this project, always consider the geospatial nature of the application, maintain the modular architecture patterns, and follow the established Svelte 5 conventions. **Before adding code to an existing file, consider if the functionality would be better served in a separate, focused module.** Pay special attention to map performance and user experience when dealing with large datasets.
