# Issue: Raster Data Points and Image Display Coordinate Mismatch

## Problem Description
The red data points (extracted from COG/GeoTIFF files) do not align with the colored raster image display, even though both come from the same COG file. The data points appear stretched vertically compared to the raster visualization.

## Visual Evidence
- Data points (red dots) extend beyond the colored raster area
- Vertical stretching is visible, particularly in the Y-axis
- Points appear at latitudes (e.g., 74°, 79°) that exceed the raster bounds (±66.51°)

## Technical Analysis

### Root Cause
There's a mismatch between:
1. **Image display bounds**: The raster image is being positioned on the map using certain bounds
2. **Data query bounds**: The pixel queries for data points use different bounds
3. **Viewport queries**: The system queries for data points outside the actual raster extent

### Key Findings

#### 1. Web Mercator Bounds Issue
- COG files appear to be in Web Mercator projection (EPSG:3857)
- Web Mercator has practical latitude limits:
  - Mathematical limit: ±85.051129°
  - Common tile extent: ±66.51326° (corresponds to Y=±10018754.17 meters)
- The system was incorrectly using ±90° latitude bounds for global data

#### 2. Coordinate System Details
```javascript
// Web Mercator standard bounds in meters
const WEB_MERCATOR_BOUNDS = {
  x: [-20037508.34, 20037508.34],
  y: [-10018754.17, 10018754.17]  // Corresponds to ±66.51326° latitude
};

// When converted to WGS84
const WGS84_BOUNDS = {
  lng: [-180, 180],
  lat: [-66.51326, 66.51326]  // NOT ±90°!
};
```

#### 3. Current Data Flow
```
COG File → GeoTIFF.js → Bounds Extraction → Validation → Display
                ↓                               ↓
         [Raw bounds]                   [Transformed bounds]
                                               ↓
                                    ┌─────────────────────┐
                                    │   Image Display     │ ← Uses one set of bounds
                                    └─────────────────────┘
                                    ┌─────────────────────┐
                                    │   Data Queries      │ ← May use different bounds
                                    └─────────────────────┘
```

## Files Involved

### Core Processing
- `/app/src/lib/components/Map/utils/geoTiffProcessor.ts`
  - `loadGeoTIFF()`: Loads COG file and extracts metadata
  - `validateBounds()`: Transforms and validates bounds
  - `processGeoTIFF()`: Processes raster data and creates image

### Display & Synchronization
- `/app/src/lib/components/Map/utils/RasterLayerSync.ts`
  - Positions raster image on map using `layer.bounds`
  - Creates image source with corner coordinates

### Data Queries
- `/app/src/lib/components/Map/utils/rasterPixelQuery.ts`
  - `getRasterValueAtCoordinate()`: Queries pixel values at coordinates
  - Uses bounds to map lat/lng to pixel coordinates

### Visualization
- `/app/src/lib/components/Map/components/RasterDataOverlay.svelte`
  - Generates red dots for data visualization
  - Queries entire viewport, including areas outside raster bounds

### Store
- `/app/src/lib/stores/raster.store.ts`
  - Manages raster layer state
  - `fetchAndSetLayerBounds()`: Loads and processes COG files

## Attempted Fixes

### 1. Bounds Adjustment Removal (Partially Successful)
```typescript
// OLD: Incorrect adjustment
if (isNearGlobal) {
  return [-180, -56, 180, 72];  // Wrong! Arbitrary adjustment
}

// NEW: Keep original bounds
if (isNearGlobal) {
  return bounds;  // Keep ±66.51326°
}
```

### 2. Longitude Normalization (Successful)
```typescript
// Handle world copies when map wraps around date line
lng = ((lng + 180) % 360) - 180;
```

### 3. Global Bounds Correction (Attempted)
```typescript
// If bounds claim to be exactly [-180, -90, 180, 90]
if (isExactlyGlobal) {
  // Correct to Web Mercator tile extent
  return [-180, -66.51326044311186, 180, 66.51326044311186];
}
```

## Remaining Issues

### 1. Bounds Source Uncertainty
- Need to verify what bounds the COG files actually contain
- Check if GeoTIFF metadata has projection information (EPSG code)
- Determine if bounds are already in WGS84 or need transformation

### 2. Console Logs Show
```javascript
// Data queries happening outside raster bounds
Query at (170.182, 70.246) // Latitude 70° exceeds ±66.51° bounds
Query at (-177.680, 79.113) // Latitude 79° exceeds bounds
// But bounds show:
Bounds: [-180, -66.51326044311188, 180, 66.51326044311186]
```

### 3. Possible Cache Issues
- Raster layers may be cached with old incorrect bounds
- Need to force complete reload of all layers
- Browser may be caching the processed images

## Next Steps to Debug

### 1. Add Comprehensive Logging
```typescript
// In geoTiffProcessor.ts
console.log('RAW BOUNDS FROM FILE:', image.getBoundingBox());
console.log('GEOKEYS:', image.getGeoKeys());
console.log('PROJECTION:', geoKeys.ProjectedCSTypeGeoKey);
console.log('FINAL BOUNDS RETURNED:', bounds);
```

### 2. Verify Bounds at Each Stage
```typescript
// In RasterLayerSync.ts
console.log('BOUNDS USED FOR IMAGE:', layer.bounds);
console.log('IMAGE CORNERS:', coordinates);

// In rasterPixelQuery.ts  
console.log('BOUNDS USED FOR QUERY:', layer.bounds);
```

### 3. Check Raw COG File
```bash
# Use GDAL tools to inspect the actual COG file
gdalinfo https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_2459_Asym_Pr.tif

# Expected output should show:
# - Coordinate System (EPSG code)
# - Corner Coordinates
# - Pixel Size
# - Origin
```

### 4. Test with Known Good Data
- Create a test COG with known exact bounds
- Verify the processing pipeline with controlled input
- Compare results with production COGs

## Potential Solutions

### Solution 1: Force Consistent Bounds
```typescript
// Ensure all global data uses Web Mercator tile extent
const WEB_MERCATOR_TILE_BOUNDS = [-180, -66.51326044311186, 180, 66.51326044311186];

// Apply consistently everywhere
if (isGlobalData) {
  return WEB_MERCATOR_TILE_BOUNDS;
}
```

### Solution 2: Trust GeoTIFF Metadata
```typescript
// Use bounds directly from GeoTIFF without modification
const bounds = image.getBoundingBox();
// Only transform if in different projection
if (projectionIsWebMercator) {
  return convertWebMercatorToWGS84(bounds);
}
return bounds;
```

### Solution 3: Clip Viewport Queries
```typescript
// In RasterDataOverlay.svelte
// Only query points within actual raster bounds
if (lat < -66.51326 || lat > 66.51326) {
  continue; // Skip points outside raster extent
}
```

## Testing Checklist

- [ ] Verify bounds from COG metadata match expected values
- [ ] Confirm image positioning uses same bounds as data queries  
- [ ] Check that viewport queries respect raster bounds
- [ ] Test with multiple COG files to ensure consistency
- [ ] Verify behavior when map wraps around date line
- [ ] Test zoom levels to ensure alignment at all scales
- [ ] Clear all caches and test with fresh load

## Related Issues
- MapLibre's `renderWorldCopies: true` causes longitude > 180°
- Web Mercator projection limitations at high latitudes
- GeoTIFF.js bounds extraction may vary by file format

## Environment
- MapLibre GL JS with `renderWorldCopies: true`
- GeoTIFF.js for COG processing
- Svelte 5 for UI components
- COG files hosted on R2 CDN

## References
- [Web Mercator Projection](https://en.wikipedia.org/wiki/Web_Mercator_projection)
- [GeoTIFF Format Specification](http://geotiff.maptools.org/spec/geotiffhome.html)
- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js/docs/)

## Priority
**High** - Core functionality affected, data visualization is incorrect

## Last Updated
2025-09-01

---

## Quick Test Commands

```javascript
// In browser console to check current bounds
Array.from($rasterLayers.values()).forEach(layer => {
  console.log(`Layer: ${layer.name}`);
  console.log(`Bounds: [${layer.bounds?.join(', ')}]`);
});

// Force reload with debugging
reprocessVisibleLayers();
```