import type { RasterLayer } from '$lib/types';
import { WEB_MERCATOR_MAX_LATITUDE } from './geoTiffProcessor';

/**
 * Check if a latitude is within Web Mercator's representable range
 * @param lat Latitude to check
 * @returns true if the latitude can be represented in Web Mercator
 */
export function isLatitudeInWebMercatorRange(lat: number): boolean {
  return Math.abs(lat) <= WEB_MERCATOR_MAX_LATITUDE;
}

/**
 * Get the raster value at a specific geographic coordinate (ultra-fast version for real-time hover)
 * @param layer The raster layer containing the data
 * @param lng Longitude
 * @param lat Latitude
 * @returns The raster value at that location, or null if outside bounds or no data
 */
export function getRasterValueAtCoordinateFast(
  layer: RasterLayer,
  lng: number,
  lat: number
): number | null {
  // Fast fail checks
  if (!layer.rasterData) return null;
  
  const data = layer.rasterData;
  const w = layer.width;
  const h = layer.height;
  const bounds = layer.bounds;
  
  if (!w || !h || !bounds) return null;

  // Debug logging for coordinate mapping (reduced for performance)
  if (Math.random() < 0.1) { // Only log 10% of queries to avoid spam
    console.log(`🔍 Query at (${lng.toFixed(3)}, ${lat.toFixed(3)}) for layer: ${layer.name}`);
    console.log(`  Bounds: [${bounds[0]}, ${bounds[1]}, ${bounds[2]}, ${bounds[3]}]`);
  }

  // Direct array access for bounds
  const west = bounds[0];
  const south = bounds[1];
  const east = bounds[2];
  const north = bounds[3];
  
  // Bounds check
  if (lng < west || lng > east || lat < south || lat > north) return null;

  // Direct pixel calculation - optimize for top-down (most common)
  const xRatio = (lng - west) / (east - west);
  const pixelX = ~~(xRatio * w); // ~~ is faster than Math.floor for positive numbers
  
  const yRatio = (north - lat) / (north - south);
  const pixelY = ~~(yRatio * h);
  
  // Log critical coordinate mapping occasionally
  if (Math.random() < 0.05) { // Only log 5% of queries
    console.log(`  Pixel: (${pixelX}, ${pixelY}) from ratios (${xRatio.toFixed(3)}, ${yRatio.toFixed(3)})`);
  }
  
  // Bounds check
  if (pixelX < 0 || pixelX >= w || pixelY < 0 || pixelY >= h) return null;
  
  // Direct array access
  const value = data[pixelY * w + pixelX];
  
  // Fast no-data check - most values are valid, so optimize for that path
  if (!isNaN(value) && value > -1e10 && value < 1e10) {
    // Fast rounding to 2 decimal places
    return ~~(value * 100 + 0.5) / 100;
  }
  
  // Fallback: try bottom-up orientation
  const pixelYAlt = ~~((lat - south) / (north - south) * h);
  if (pixelYAlt >= 0 && pixelYAlt < h) {
    const altValue = data[pixelYAlt * w + pixelX];
    if (!isNaN(altValue) && altValue > -1e10 && altValue < 1e10) {
      return ~~(altValue * 100 + 0.5) / 100;
    }
  }
  
  return null;
}

/**
 * Get the raster value at a specific geographic coordinate (with full analysis)
 * @param layer The raster layer containing the data
 * @param lng Longitude
 * @param lat Latitude
 * @returns The raster value at that location, or null if outside bounds or no data
 */
export function getRasterValueAtCoordinate(
  layer: RasterLayer,
  lng: number,
  lat: number
): number | null {
  // Check if we have the necessary data
  if (!layer.rasterData || !layer.width || !layer.height || !layer.bounds) {
    console.warn('Raster layer missing required data for pixel query');
    return null;
  }

  const [west, south, east, north] = layer.bounds;
  
  // Check if coordinate is within bounds
  if (lng < west || lng > east || lat < south || lat > north) {
    console.log(`Coordinate (${lng}, ${lat}) is outside raster bounds [${west}, ${south}, ${east}, ${north}]`);
    return null;
  }

  // Convert geographic coordinates to pixel coordinates
  // X increases from west to east (left to right)
  const xRatio = (lng - west) / (east - west);
  const pixelX = Math.floor(xRatio * layer.width);
  
  // Y-axis: Most GeoTIFFs store with Y=0 at top (north)
  // Let's go back to the original orientation
  const yRatio = (north - lat) / (north - south); // Y=0 is north (top)
  const pixelY = Math.floor(yRatio * layer.height);
  
  // Also calculate bottom-up for comparison
  const yRatioBottomUp = (lat - south) / (north - south); // Y=0 is south (bottom)
  const pixelYBottomUp = Math.floor(yRatioBottomUp * layer.height);
  const pixelYAlt = pixelYBottomUp;
  
  // console.log(`Y-axis: Using top-down orientation. Pixel Y=${pixelY}, Bottom-up would be Y=${pixelYAlt}`);
  
  // console.log('Pixel calculation:', {
  //   xRatio,
  //   yRatio,
  //   pixelX,
  //   pixelY,
  //   width: layer.width,
  //   height: layer.height
  // });
  
  // Ensure pixel coordinates are within bounds
  if (pixelX < 0 || pixelX >= layer.width || pixelY < 0 || pixelY >= layer.height) {
    console.log(`Pixel coordinates out of bounds: (${pixelX}, ${pixelY})`);
    return null;
  }
  
  // Get the index in the flat array
  let index = pixelY * layer.width + pixelX;
  
  // console.log(`Array index: ${index} (max: ${layer.rasterData.length - 1})`);
  
  // Get the value using current orientation (top-down)
  let value = layer.rasterData[index];
  let usedOrientation = 'top-down';
  
  // Check the alternative orientation (bottom-up)
  let altValue = NaN;
  let altIndex = -1;
  if (pixelYAlt >= 0 && pixelYAlt < layer.height && pixelX >= 0 && pixelX < layer.width) {
    altIndex = pixelYAlt * layer.width + pixelX;
    altValue = layer.rasterData[altIndex];
  }
  
  // Smart orientation selection: Use whichever has valid data
  // But be careful not to create false positives by reading from wrong locations
  
  // First, check surrounding pixels for both orientations to determine which is correct
  let topDownValidCount = 0;
  let bottomUpValidCount = 0;
  
  // Count valid neighbors for top-down orientation
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const testX = pixelX + dx;
      const testY = pixelY + dy;
      if (testX >= 0 && testX < layer.width && testY >= 0 && testY < layer.height) {
        const testIndex = testY * layer.width + testX;
        const testValue = layer.rasterData[testIndex];
        if (!isNaN(testValue) && testValue > -1e10 && testValue < 1e10) {
          topDownValidCount++;
        }
      }
    }
  }
  
  // Count valid neighbors for bottom-up orientation
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const testX = pixelX + dx;
      const testY = pixelYAlt + dy;
      if (testX >= 0 && testX < layer.width && testY >= 0 && testY < layer.height) {
        const testIndex = testY * layer.width + testX;
        const testValue = layer.rasterData[testIndex];
        if (!isNaN(testValue) && testValue > -1e10 && testValue < 1e10) {
          bottomUpValidCount++;
        }
      }
    }
  }
  
  // console.log(`Neighbor analysis - Top-down valid: ${topDownValidCount}, Bottom-up valid: ${bottomUpValidCount}`);
  
  // Smart orientation selection based on neighbor analysis
  // The goal is to use the correct orientation without creating false positives
  if (isNaN(value) && !isNaN(altValue) && altIndex >= 0) {
    // Case 1: Bottom-up has significantly more valid neighbors - strong evidence it's correct
    if (bottomUpValidCount > topDownValidCount && bottomUpValidCount >= 3) {
      console.warn(`⚠️ Switching to bottom-up - more valid neighbors (${bottomUpValidCount} vs ${topDownValidCount})`);
      value = altValue;
      usedOrientation = 'bottom-up';
      index = altIndex;
    }
    // Case 2: Both have very few neighbors, but bottom-up has a value - likely near edge or sparse area
    else if (topDownValidCount <= 2 && bottomUpValidCount > 0) {
      console.warn(`⚠️ Switching to bottom-up - has value in sparse area (neighbors: ${bottomUpValidCount})`);
      value = altValue;
      usedOrientation = 'bottom-up';
      index = altIndex;
    }
    // Case 3: No clear evidence - keep NaN (likely truly no-data)
    else {
      console.log(`Keeping top-down NaN - insufficient evidence for bottom-up (${topDownValidCount} vs ${bottomUpValidCount})`);
    }
  }
  // Also check the reverse: if top-down has value but we should consider bottom-up
  else if (!isNaN(value) && isNaN(altValue)) {
    // If top-down has almost no valid neighbors but bottom-up has many, we might have wrong orientation
    if (topDownValidCount <= 1 && bottomUpValidCount >= 5) {
      console.warn('⚠️ WARNING: Top-down has value but very few neighbors, bottom-up has many - orientation might be wrong');
    }
  }
  
  // console.log(`Primary (top-down) value: ${layer.rasterData[pixelY * layer.width + pixelX]}`);
  // console.log(`Alternative (bottom-up) value: ${altValue}`);
  // console.log(`Using ${usedOrientation} orientation, final value: ${value}`);
  // console.log(`Valid neighbors - Top-down: ${topDownValidCount}/9, Bottom-up: ${bottomUpValidCount}/9`);
  
  // Debug: Check surrounding values to understand the data
  const debugValues = [];
  const checkY = usedOrientation === 'bottom-up' ? pixelYAlt : pixelY;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const testX = pixelX + dx;
      const testY = checkY + dy;
      if (testX >= 0 && testX < layer.width && testY >= 0 && testY < layer.height) {
        const testIndex = testY * layer.width + testX;
        debugValues.push(`(${dx},${dy}): ${layer.rasterData[testIndex]?.toFixed(2) || 'NaN'}`);
      }
    }
  }
  
  // console.log(`Surrounding values (${usedOrientation}):`, debugValues.join(', '));
  
  // Check for no-data values
  // NaN indicates no data (ocean, outside coverage area, etc.)
  // 0 is a valid value (0% prevalence)
  if (isNaN(value) || value < -1e10 || value > 1e10) {
    console.log(`No data at pixel (${pixelX}, ${pixelY}): value is ${value}`);
    return null;
  }
  
  // Round to 2 decimal places for display
  // Note: 0 is a valid value representing 0% prevalence
  return Math.round(value * 100) / 100;
}

/**
 * Find the visible raster layer at a coordinate
 * @param rasterLayers Map of all raster layers
 * @param lng Longitude
 * @param lat Latitude
 * @returns The first visible raster layer at that location, or null
 */
export function findVisibleRasterLayerAtCoordinate(
  rasterLayers: Map<string, RasterLayer>,
  lng: number,
  lat: number
): RasterLayer | null {
  // console.log(`Finding raster layer at lng: ${lng}, lat: ${lat}`);
  
  // For global raster layers, we need to check if the click is within data range
  // even if technically outside the stored bounds
  for (const [, layer] of rasterLayers) {
    if (layer.isVisible && layer.bounds && !layer.isLoading && !layer.error) {
      const [west, south, east, north] = layer.bounds;
      
      // Simple bounds check - if the click is within the layer's bounds, it matches
      // console.log(`Checking layer ${layer.name}: bounds [${west}, ${south}, ${east}, ${north}]`);
      // console.log(`  Longitude check: ${lng} >= ${west} && ${lng} <= ${east} = ${lng >= west && lng <= east}`);
      // console.log(`  Latitude check: ${lat} >= ${south} && ${lat} <= ${north} = ${lat >= south && lat <= north}`);
      
      if (lng >= west && lng <= east && lat >= south && lat <= north) {
        // console.log(`  -> Layer matches!`);
        return layer;
      }
    }
  }
  // console.log('No matching raster layer found');
  return null;
}