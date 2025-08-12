import type { Map as MaplibreMap } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import type { MapStyle } from '../MapStyles';
import { parseUrlFilters } from './urlParams';
import { loadPointsData } from '../store';

/**
 * Get the latest CSV file from the points data directory
 * Looks for files matching pattern: YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv
 */
async function getLatestDataFile(): Promise<string> {
  const baseDir = 'data/01_Points/';
  
  // For now, hardcode the latest file
  // In production, this would come from a directory listing endpoint
  const latestFile = '2025-07-31_Plan-EO_Dashboard_point_data.csv';
  
  console.log(`Loading data from: ${latestFile}`);
  return baseDir + latestFile;
}

// Export for consistency across the app
export let POINTS_DATA_URL = 'data/01_Points/2025-07-31_Plan-EO_Dashboard_point_data.csv';

/**
 * Preload data before map initialization
 * @returns URL parameters
 */
export async function preloadData() {
  console.log('preloadData called');
  // Parse URL parameters
  const urlParams = parseUrlFilters();
  
  // Get the latest data file
  POINTS_DATA_URL = await getLatestDataFile();
  console.log('About to load data from:', POINTS_DATA_URL);

  // Load point data with forceReload if URL has filter parameters
  await loadPointsData(POINTS_DATA_URL, urlParams.hasFilters);

  return urlParams;
}

/**
 * Initialize the map with the given container and style
 * @param mapContainer The HTML element to contain the map
 * @param initialStyle The initial map style
 * @param initialCenter The initial center coordinates
 * @param initialZoom The initial zoom level
 * @returns The initialized map instance
 */
export function initializeMap(
  mapContainer: HTMLElement,
  initialStyle: MapStyle,
  initialCenter: [number, number] = [28.4, -15.0],
  initialZoom: number = 4
): MaplibreMap | null {
  try {
    // Create map with the appropriate style
    const map = new maplibregl.Map({
      container: mapContainer,
      style: initialStyle.url,
      center: initialCenter,
      zoom: initialZoom,
      renderWorldCopies: true // Enable world copies for better wrapping at edges
    });

    // Add controls
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: 'metric'
      }),
      'bottom-left'
    );

    return map;
  } catch (error) {
    console.error('Error initializing map:', error);
    return null;
  }
}

/**
 * Add event listeners to the map
 * @param map The map instance
 * @param onStyleChange Callback for style change events
 * @param onMapMove Callback for map movement events
 */
export function addMapEventListeners(
  map: MaplibreMap,
  onStyleChange: () => void,
  onMapMove: () => void
): void {
  // Add style change listener
  map.on('styledata', onStyleChange);

  // Add map movement listeners
  map.on('moveend', onMapMove);
  map.on('zoomend', onMapMove);

  // Add error listener
  map.on('error', (e) => {
    console.error('MapLibre error:', e);
  });
}

/**
 * Remove event listeners from the map
 * @param map The map instance
 * @param onStyleChange Callback for style change events
 * @param onMapMove Callback for map movement events
 */
export function removeMapEventListeners(
  map: MaplibreMap,
  onStyleChange: () => void,
  onMapMove: () => void
): void {
  map.off('styledata', onStyleChange);
  map.off('moveend', onMapMove);
  map.off('zoomend', onMapMove);
}
