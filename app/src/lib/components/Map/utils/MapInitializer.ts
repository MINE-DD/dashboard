import type { Map as MaplibreMap } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import type { MapStyle } from '../MapStyles';
import { parseUrlFilters } from './urlParams';
import { loadPointsData } from '../store';
import { dataUpdateDate } from '$lib/stores/data.store';

// Use Vite's glob import to get all CSV files at build time
// The eager: false means files won't be loaded until needed
const dataFiles = import.meta.glob('/static/data/01_Points/*_Plan-EO_Dashboard_point_data.csv', { 
  eager: false,
  as: 'url'
});

/**
 * Get the main CSV data file path
 * The file uses semicolon (;) as delimiter and contains pathogen prevalence data.
 * Note: Some pathogen names include markdown-style formatting (__name__) 
 * for italic rendering of genus names (e.g., __Campylobacter__, __E. coli__).
 * Files follow pattern: YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv
 */
async function getLatestDataFile(): Promise<string> {
  // Get all file paths from the glob import
  const filePaths = Object.keys(dataFiles);
  
  if (filePaths.length === 0) {
    console.error('No data files found in /static/data/01_Points/');
    // Fallback to a known file
    const fallbackFile = 'data/01_Points/2025-12-19_Plan-EO_Dashboard_point_data.csv';
    dataUpdateDate.set('2025-12-19');
    return fallbackFile;
  }
  
  // Extract filenames and sort by date (newest first)
  const sortedFiles = filePaths
    .map(path => {
      // Extract filename from path
      const filename = path.split('/').pop() || '';
      // Extract date from filename
      const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
      return {
        path: path.replace('/static/', ''), // Remove /static/ prefix for fetch
        filename,
        date: dateMatch ? dateMatch[1] : ''
      };
    })
    .filter(file => file.date) // Only keep files with valid dates
    .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
  
  if (sortedFiles.length === 0) {
    console.error('No valid data files found with date pattern');
    const fallbackFile = 'data/01_Points/2025-12-19_Plan-EO_Dashboard_point_data.csv';
    dataUpdateDate.set('2025-12-19');
    return fallbackFile;
  }
  
  // Use the most recent file
  const latestFile = sortedFiles[0];
  dataUpdateDate.set(latestFile.date);
  
  console.log(`Loading data from: ${latestFile.filename} (Date: ${latestFile.date})`);
  console.log(`Found ${sortedFiles.length} data files, using the most recent one`);
  
  return latestFile.path;
}

// Export for consistency across the app
export let POINTS_DATA_URL = 'data/01_Points/2025-08-19_Plan-EO_Dashboard_point_data.csv';

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
