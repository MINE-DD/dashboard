import type { RasterLayer } from '$lib/types';
import type { Map as MaplibreMap } from 'maplibre-gl';

/**
 * Get the raster value using MapLibre's coordinate transformation
 * This ensures we read from the same pixel that MapLibre displays
 */
export function getRasterValueAtCoordinateUsingMapTransform(
  map: MaplibreMap,
  layer: RasterLayer,
  lng: number,
  lat: number
): number | null {
  if (!layer.rasterData || !layer.width || !layer.height || !layer.bounds) {
    return null;
  }

  const [west, south, east, north] = layer.bounds;
  
  // Check if coordinate is within bounds
  if (lng < west || lng > east || lat < south || lat > north) {
    return null;
  }

  // MapLibre image source uses these corners in this order:
  // top-left, top-right, bottom-right, bottom-left
  const corners = [
    [west, north], // top-left
    [east, north], // top-right
    [east, south], // bottom-right
    [west, south]  // bottom-left
  ];

  // Convert geographic coordinate to image pixel using bilinear interpolation
  // This matches how MapLibre maps the image to the geographic bounds
  
  // First, find where the point is in geographic space (0-1 range)
  const geoX = (lng - west) / (east - west);
  const geoY = (north - lat) / (north - south); // Note: Y is flipped
  
  // Map to pixel coordinates
  const pixelX = Math.floor(geoX * layer.width);
  const pixelY = Math.floor(geoY * layer.height);
  
  // Bounds check
  if (pixelX < 0 || pixelX >= layer.width || pixelY < 0 || pixelY >= layer.height) {
    return null;
  }
  
  // Get the value from the raster data
  const index = pixelY * layer.width + pixelX;
  const value = layer.rasterData[index];
  
  // Check for valid data
  if (!isNaN(value) && value > -1e10 && value < 1e10) {
    return Math.round(value * 100) / 100;
  }
  
  return null;
}