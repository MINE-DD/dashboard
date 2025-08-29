import type { Map as MaplibreMap } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import type { MapStyle } from '../MapStyles';
import { parseUrlFilters } from './urlParams';
import { loadPointsData } from '../store';
import { dataUpdateDate } from '$lib/stores/data.store';

// Get R2 base URL from environment
const R2_BASE_URL = import.meta.env.VITE_R2_POINTS_BASE_URL || 'https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/01_Points';

/**
 * Get the main CSV data file path from R2 storage
 * The file uses semicolon (;) as delimiter and contains pathogen prevalence data.
 * Note: Some pathogen names include markdown-style formatting (__name__) 
 * for italic rendering of genus names (e.g., __Campylobacter__, __E. coli__).
 * Files follow pattern: YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv
 */
async function getLatestDataFile(): Promise<string> {
  console.log('Getting latest data file from R2...');
  console.log('R2 Base URL:', R2_BASE_URL);
  
  try {
    // Fetch the list of available files from our API endpoint with cache busting
    const cacheBuster = `?t=${Date.now()}`;
    const response = await fetch(`/api/r2-files${cacheBuster}`);
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: Failed to fetch file list from R2`);
    }
    
    const data = await response.json();
    console.log('API response data:', data);
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    if (!data.files || data.files.length === 0) {
      console.error('No data files found in R2 bucket via API');
      // Fallback to a known file URL
      const fallbackUrl = `${R2_BASE_URL}/2025-08-25_Plan-EO_Dashboard_point_data.csv`;
      dataUpdateDate.set('2025-08-25');
      return fallbackUrl;
    }
    
    // Use the most recent file (already sorted by the API)
    const latestFile = data.files[0];
    dataUpdateDate.set(latestFile.date);
    
    console.log(`✓ Loading data from R2: ${latestFile.fileName} (Date: ${latestFile.date})`);
    console.log(`Found ${data.files.length} data files in R2, using the most recent one`);
    console.log('All available files:', data.files.map((f: any) => f.fileName));
    
    return latestFile.url;
    
  } catch (error) {
    console.error('Error fetching R2 file list:', error);
    
    // Try to directly check for known recent files as a fallback
    const fallbackDates = ['2025-08-26', '2025-08-25', '2025-08-24', '2025-07-31'];
    
    for (const date of fallbackDates) {
      const testUrl = `${R2_BASE_URL}/${date}_Plan-EO_Dashboard_point_data.csv`;
      try {
        const response = await fetch(testUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log(`Found fallback file: ${date}_Plan-EO_Dashboard_point_data.csv`);
          dataUpdateDate.set(date);
          return testUrl;
        }
      } catch {
        // Try next date
      }
    }
    
    // Final fallback to a known file URL
    const fallbackUrl = `${R2_BASE_URL}/2025-08-25_Plan-EO_Dashboard_point_data.csv`;
    dataUpdateDate.set('2025-08-25');
    console.log('Using final fallback R2 URL:', fallbackUrl);
    return fallbackUrl;
  }
}

// Export for consistency across the app
export let POINTS_DATA_URL = `${R2_BASE_URL}/2025-08-25_Plan-EO_Dashboard_point_data.csv`;

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
