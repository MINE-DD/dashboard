import type { Map as MaplibreMap } from 'maplibre-gl';
import type { MapStyle } from '../MapStyles';
import { selectedMapStyle } from '$lib/stores/mapStyle.store';
import { get } from 'svelte/store';

/**
 * Set the map style
 * @param map The map instance
 * @param style The style to set
 * @returns Whether the style was set successfully
 */
export function setMapStyle(map: MaplibreMap, style: MapStyle): boolean {
  if (!map) return false;

  try {
    // Update the store
    selectedMapStyle.set(style);
    console.log('Changing style to:', style.name, style.url);

    // Apply the style to the map
    map.setStyle(style.url);
    return true;
  } catch (error) {
    console.error('Error setting style:', error);
    return false;
  }
}

/**
 * Get the current map style
 * @returns The current map style
 */
export function getCurrentMapStyle(): MapStyle {
  return get(selectedMapStyle);
}
