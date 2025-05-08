import type { Feature, FeatureCollection, Point } from 'geojson';
import type { LngLatBoundsLike } from 'maplibre-gl';

// Define the CSV row interface based on the provided structure
export interface PointDataRow {
  EST_ID: string;
  Pathogen: string;
  Age_group: string;
  Syndrome: string;
  Design: string;
  Site_Location: string;
  Prevalence: string;
  Age_range: string;
  Study: string;
  Duration: string;
  Source: string;
  Hyperlink: string;
  CASES: string;
  SAMPLES: string;
  PREV: string;
  SE: string;
  SITE_LAT: string;
  SITE_LONG: string;
}

// Define the GeoJSON feature properties interface
export interface PointProperties {
  id: string;
  pathogen: string;
  ageGroup: string;
  syndrome: string;
  design: string;
  location: string;
  prevalence: string;
  ageRange: string;
  study: string;
  duration: string;
  source: string;
  hyperlink: string;
  cases: number;
  samples: number;
  prevalenceValue: number;
  standardError: number;
}

export type PointFeature = Feature<Point, PointProperties>;
export type PointFeatureCollection = FeatureCollection<Point, PointProperties>;

// Type for feature indices used in filtering
export type FeatureIndex = Map<string, Set<number>>;

// --- Raster Layer Types ---

export interface RasterLayer {
  id: string; // Unique identifier for the layer
  name: string; // Display name (e.g., derived from URL or metadata)
  sourceUrl: string; // The original URL provided by the user
  dataUrl?: string; // Canvas data URL for the processed GeoTIFF
  bounds?: [number, number, number, number]; // Optional geographic bounds [west, south, east, north]
  isVisible: boolean; // Current visibility state
  opacity: number; // Current opacity state (0 to 1)
  isLoading?: boolean; // Optional flag for loading state (e.g., while fetching metadata)
  error?: string | null; // Optional error message if loading failed
  autoShown?: boolean; // Flag to indicate if layer was automatically shown by filter selection
  metadata?: any; // Store GeoTIFF metadata
  colormap?: string; // Store colormap name (e.g., 'viridis')
  rescale?: [number, number]; // Min/max values for rescaling
  swapCoordinates?: boolean; // Flag to swap coordinate order (lat/lng vs lng/lat)
}

// Mapping types for filter to raster layer connections
export interface FilterToRasterMapping {
  pathogen: string;
  ageGroup: string;
  syndrome: string;
  layerId: string;
}
