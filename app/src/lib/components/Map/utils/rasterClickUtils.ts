import type { RasterLayer } from '$lib/types';
import type { LngLatLike } from 'maplibre-gl';

/**
 * Checks if a map click occurred within the bounds of any visible raster layer.
 *
 * @param clickLngLat - The longitude and latitude of the map click.
 * @param rasterLayersMap - A Map object containing the current state of all raster layers.
 * @returns True if the click is on a visible raster layer, false otherwise.
 */
export function isClickOnVisibleRaster(
  clickLngLat: LngLatLike,
  rasterLayersMap: Map<string, RasterLayer>
): boolean {
  let clickLng: number;
  let clickLat: number;

  if (Array.isArray(clickLngLat)) {
    clickLng = clickLngLat[0];
    clickLat = clickLngLat[1];
  } else if ('lng' in clickLngLat) {
    clickLng = clickLngLat.lng;
    clickLat = clickLngLat.lat;
  } else {
    // Must be { lon: number; lat: number; }
    clickLng = clickLngLat.lon;
    clickLat = clickLngLat.lat;
  }

  for (const [, layerDetails] of rasterLayersMap) {
    if (layerDetails.isVisible && layerDetails.bounds) {
      const [minLng, minLat, maxLng, maxLat] = layerDetails.bounds;
      if (clickLng >= minLng && clickLng <= maxLng && clickLat >= minLat && clickLat <= maxLat) {
        return true; // Click is on a visible raster
      }
    }
  }
  return false; // Click is not on any visible raster
}
