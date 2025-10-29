# Map Styles Feature

This document explains how to use the map styles feature in the application.

## Available Map Styles

The map now supports multiple map styles organized in the following categories:

### Base Maps
- Street Map - Detailed street map from CARTO
- Vector - Clean vector map
- OSM Default - Default OpenStreetMap style

### Satellite & Terrain
- Satellite - Satellite imagery from MapTiler
- Hybrid - Satellite imagery with labels from MapTiler

### Themes
- Light Theme - Light, minimal style for general use
- Dark Theme - Dark mode map for night usage or dark interfaces

### Data Visualization
- Light Data - Light theme optimized for data overlays (no labels)
- Dark Data - Dark theme optimized for data overlays (no labels)

## Available Map Sources

The map styles come from various sources:

1. **CARTO** - Primary source providing free vector basemaps
2. **MapLibre Demo Tiles** - Default OSM style
3. **MapTiler** - Provides satellite imagery (requires API key)

The MapTiler styles require an API key which is already configured in the project's `.env` file.

## Using the Map Component

The Map component accepts the following props:

```svelte
<Map
  initialCenter={[longitude, latitude]}
  initialZoom={zoomLevel}
  initialStyleId="style-id-here"
/>
```

Properties:
- `initialCenter`: Array with [longitude, latitude] (defaults to [0, 0])
- `initialZoom`: Zoom level (defaults to 2)
- `initialStyleId`: Optional ID of the map style to use initially

Style IDs include: 'street-map', 'osm-default', 'satellite', 'dark', 'light', etc. See `MapStyles.ts` for the complete list:

- 'street-map' - CARTO Voyager (detailed streets)
- 'vector' - CARTO RasterTiles (clean vector)
- 'osm-default' - MapLibre default style
- 'satellite' - MapTiler satellite imagery
- 'hybrid' - MapTiler satellite imagery with labels
- 'light' - CARTO Positron (light theme)
- 'dark' - CARTO Dark Matter (dark theme)
- 'light-data' - CARTO Positron without labels
- 'dark-data' - CARTO Dark Matter without labels

## User Preferences

The selected map style is automatically saved to localStorage, so users will see the same map style when they return to the application.

## Adding Custom Map Styles

To add additional map styles, modify the `MAP_STYLES` array in `app/src/lib/components/Map/MapStyles.ts`:

```typescript
{
  id: 'your-style-id',
  name: 'Your Style Name',
  url: 'URL to style JSON',
  category: MapStyleCategory.YOUR_CATEGORY,
  description: 'Style description'
}
```

## MapTiler Configuration

This project uses MapTiler for satellite imagery. The API key is already configured in the `.env` file:

```
VITE_MAPTILER_KEY=your_api_key
```

If you need to change the API key:
1. Get a key from [MapTiler](https://www.maptiler.com/)
2. Update the value in your `.env` file
3. Restart the development server
