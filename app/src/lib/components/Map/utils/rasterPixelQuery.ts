import type { RasterLayer } from '$lib/types';

/**
 * Get the raster value at a specific geographic coordinate
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
    return null;
  }

  // Convert geographic coordinates to pixel coordinates
  // X increases from west to east (left to right)
  // Y increases from north to south (top to bottom in image space)
  const xRatio = (lng - west) / (east - west);
  const yRatio = (north - lat) / (north - south); // Inverted because image Y goes top to bottom
  
  const pixelX = Math.floor(xRatio * layer.width);
  const pixelY = Math.floor(yRatio * layer.height);
  
  // Ensure pixel coordinates are within bounds
  if (pixelX < 0 || pixelX >= layer.width || pixelY < 0 || pixelY >= layer.height) {
    return null;
  }
  
  // Get the index in the flat array
  const index = pixelY * layer.width + pixelX;
  
  // Get the value
  const value = layer.rasterData[index];
  
  // Check for no-data values
  // Common no-data values include 0, NaN, and very large negative numbers
  if (value === 0 || isNaN(value) || value < -1e10 || value > 1e10) {
    return null;
  }
  
  // Round to 2 decimal places for display
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
  console.log(`Finding raster layer at lng: ${lng}, lat: ${lat}`);
  for (const [, layer] of rasterLayers) {
    if (layer.isVisible && layer.bounds && !layer.isLoading && !layer.error) {
      const [west, south, east, north] = layer.bounds;
      console.log(`Checking layer ${layer.name}: bounds [${west}, ${south}, ${east}, ${north}]`);
      console.log(`  Longitude check: ${lng} >= ${west} && ${lng} <= ${east} = ${lng >= west && lng <= east}`);
      console.log(`  Latitude check: ${lat} >= ${south} && ${lat} <= ${north} = ${lat >= south && lat <= north}`);
      if (lng >= west && lng <= east && lat >= south && lat <= north) {
        console.log(`  -> Layer matches!`);
        return layer;
      }
    }
  }
  console.log('No matching raster layer found');
  return null;
}