# Filter-to-Raster Mapping

This document describes the implementation of the filter-to-raster mapping functionality in the MINE-DD dashboard application.

## Overview

The filter-to-raster mapping functionality automatically displays relevant raster layers based on the user's filter selections (pathogen, age group, syndrome). When a user selects a combination of filters, the corresponding raster layers are automatically shown on the map.

## Implementation Details

The implementation consists of several components:

### 1. Filter-to-Raster Mapping Definition

The mapping between filter selections and raster layer IDs is defined in `app/src/lib/components/Map/store/filterRasterMapping.ts`. Each mapping entry specifies a combination of pathogen, age group, and syndrome that corresponds to a specific raster layer ID.

```typescript
export const filterToRasterMappings: FilterToRasterMapping[] = [
  // Shigella mappings
  // Age group 0-11 months
  { pathogen: 'Shigella spp.', ageGroup: '0-11 months', syndrome: 'Asymptomatic', layerId: 'cog-01_Pathogens-SHIG-SHIG_0011_Asym_Pr-tif' },
  { pathogen: 'Shigella spp.', ageGroup: '0-11 months', syndrome: 'Community', layerId: 'cog-01_Pathogens-SHIG-SHIG_0011_Comm_Pr-tif' },
  // ... more mappings ...
];
```

### 2. Derived Store for Visible Layers

A derived store (`autoVisibleRasterLayers`) calculates which raster layers should be visible based on the current filter selections. This store is updated whenever the filter selections change.

```typescript
export const autoVisibleRasterLayers = derived(
  [selectedPathogens, selectedAgeGroups, selectedSyndromes, rasterLayers],
  ([$selectedPathogens, $selectedAgeGroups, $selectedSyndromes, $rasterLayers]) => {
    // ... calculation logic ...
    return matchingLayerIds;
  }
);
```

### 3. Connection Initialization

The `initFilterRasterConnection` function subscribes to changes in the `autoVisibleRasterLayers` store and updates the visibility of raster layers accordingly. It also tracks which layers were automatically shown to handle toggling them off when filters change.

```typescript
export function initFilterRasterConnection() {
  return autoVisibleRasterLayers.subscribe(($autoVisibleRasterLayers) => {
    // ... update layer visibility based on filter selections ...
  });
}
```

### 4. UI Integration

The MapSidebar component displays asterisks next to filter options that have associated raster layers, helping users understand which selections will trigger raster layer display.

```svelte
{#each Array.from($pathogens || []).sort() as pathogen}
  <option value={pathogen} selected={$selectedPathogens?.has(pathogen)}>
    {hasRasterLayers('pathogen', pathogen) ? `${pathogen} *` : pathogen}
  </option>
{/each}
```

The sidebar also includes a global opacity slider that adjusts the opacity of all visible raster layers simultaneously.

### 5. Layer Z-Index Management

The MapLayer component ensures that point data (dots) always appears on top of raster layers by using a comprehensive approach:

1. A helper function `ensurePointsOnTop()` that moves the points layer to the top of all layers:

```typescript
function ensurePointsOnTop() {
  if (map && map.getLayer('points-layer')) {
    // Move the points layer to the top of all layers
    map.moveLayer('points-layer');
    console.log('Ensured points layer is on top of all other layers');
  }
}
```

2. A handler for the `sourcedata` event that ensures points stay on top when new layers are added:

```typescript
function handleSourceData(e: any) {
  // Only act when a source is loaded and points layer exists
  if (e.sourceDataType === 'metadata' && map && map.getLayer('points-layer')) {
    // Ensure points are on top whenever any source is loaded
    ensurePointsOnTop();
  }
}
```

3. The points layer is moved to the top in multiple scenarios:
   - When the points layer is initially added to the map
   - When new layers are added to the map (via the `sourcedata` event)
   - When the map style changes (via the `styledata` event)

This comprehensive approach ensures that the points are always visible on top of raster layers, regardless of when or how layers are added to the map.

## Data Handling

The application handles naming inconsistencies between the CSV data and raster layer IDs by:

1. Ensuring "Shigella spp." is always available as a pathogen option in the dataLoader.ts file
2. Using the exact pathogen name in the filter-to-raster mappings

```typescript
// In dataLoader.ts
pathogenSet.add('Shigella spp.');
```

## Usage

Users can:

1. Select filters (pathogen, age group, syndrome) in the sidebar
2. View the automatically displayed raster layers on the map
3. Adjust the opacity of all visible raster layers using the global opacity slider
4. See which filter options have associated raster layers (marked with asterisks)

## Future Improvements

Potential improvements to the filter-to-raster mapping functionality include:

1. Expanding the mapping to include additional pathogens and data categories
2. Optimizing performance when dealing with many raster layers simultaneously
3. Adding visual feedback when raster layers are loading or when filters are applied
4. Improving the naming consistency between CSV data and raster layer IDs
