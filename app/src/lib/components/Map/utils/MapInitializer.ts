import type { Map as MaplibreMap } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import type { MapStyle } from '../MapStyles';
import { parseUrlFilters } from './urlParams';
import { loadPointsData } from '../store';
import { dataUpdateDate } from '$lib/stores/data.store';

/**
 * Get the main CSV data file path
 * The file uses semicolon (;) as delimiter and contains pathogen prevalence data.
 * Note: Some pathogen names include markdown-style formatting (__name__) 
 * for italic rendering of genus names (e.g., __Campylobacter__, __E. coli__).
 * Files follow pattern: YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv
 */
async function getLatestDataFile(): Promise<string> {
  const baseDir = 'data/01_Points/';
  
  try {
    // Fetch the directory listing from the server
    const response = await fetch(baseDir);
    
    if (!response.ok) {
      throw new Error('Failed to fetch directory listing');
    }
    
    const html = await response.text();
    
    // Parse the HTML to extract CSV file links
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('a');
    
    const csvFiles: string[] = [];
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.match(/^\d{4}-\d{2}-\d{2}_Plan-EO_Dashboard_point_data\.csv$/)) {
        csvFiles.push(href);
      }
    });
    
    if (csvFiles.length === 0) {
      // Fallback to a known file if directory listing fails
      const fallbackFile = '2025-08-18_Plan-EO_Dashboard_point_data.csv';
      dataUpdateDate.set('2025-08-18');
      return baseDir + fallbackFile;
    }
    
    // Sort files to get the latest (they're already in YYYY-MM-DD format which sorts correctly)
    const latestFile = csvFiles.sort().reverse()[0];
    
    // Extract date from filename (YYYY-MM-DD format)
    const dateMatch = latestFile.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      dataUpdateDate.set(dateMatch[1]);
    }
    
    console.log(`Loading data from: ${latestFile}`);
    return baseDir + latestFile;
    
  } catch (error) {
    console.error('Error fetching directory listing:', error);
    // Fallback to the latest known file
    const fallbackFile = '2025-08-18_Plan-EO_Dashboard_point_data.csv';
    dataUpdateDate.set('2025-08-18');
    console.log(`Using fallback file: ${fallbackFile}`);
    return baseDir + fallbackFile;
  }
}

// Export for consistency across the app
export let POINTS_DATA_URL = 'data/01_Points/2025-08-18_Plan-EO_Dashboard_point_data.csv';

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
