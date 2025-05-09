// Import geotiff from CDN for static deployments
import { browser } from '$app/environment';

// Access the global geotiff library that's loaded via CDN in app.html
declare global {
  interface Window {
    GeoTIFF: any;
  }
}

/**
 * Interface for GeoTIFF metadata
 */
export interface GeoTIFFMetadata {
  width: number;
  height: number;
  bounds: number[];
  resolution: number[];
  samplesPerPixel: number;
  [key: string]: any;
}

/**
 * Interface for GeoTIFF processing options
 */
export interface ProcessingOptions {
  colormap?: string; // e.g., 'viridis'
  rescale?: [number, number]; // Min/max values for rescaling
  noDataValue?: number; // Value to treat as transparent
  noDataThreshold?: number; // Threshold for treating values as no-data (e.g., 0.01)
}

/**
 * Default viridis colormap similar to what TiTiler uses
 */
export const VIRIDIS_COLORMAP = [
  [68, 1, 84], // Dark purple
  [72, 40, 120], // Purple
  [62, 73, 137], // Blue
  [49, 104, 142], // Light blue
  [38, 130, 142], // Cyan
  [31, 158, 137], // Teal
  [53, 183, 121], // Green
  [109, 205, 89], // Light green
  [180, 222, 44], // Yellow-green
  [253, 231, 37] // Yellow
];

/**
 * Load a GeoTIFF from a URL and return the image and metadata
 */
export async function loadGeoTIFF(url: string): Promise<{
  image: any;
  metadata: GeoTIFFMetadata;
}> {
  console.log(`GeoTIFF Processor: Loading from URL: ${url}`);
  
  // Check if we're in the browser and GeoTIFF is available globally
  if (!browser) {
    throw new Error('GeoTIFF processing is only available in browser environments');
  }
  
  // Use the global GeoTIFF library loaded from CDN in app.html
  let tiff;
  try {
    // First try using the global window.GeoTIFF
    if (window.GeoTIFF && typeof window.GeoTIFF.fromUrl === 'function') {
      tiff = await window.GeoTIFF.fromUrl(url);
    } 
    // Fallback to try accessing it from the global scope
    else if (typeof GeoTIFF !== 'undefined' && typeof GeoTIFF.fromUrl === 'function') {
      tiff = await GeoTIFF.fromUrl(url);
    }
    // If neither approach works, try dynamic import as last resort
    else {
      try {
        const module = await import('geotiff');
        tiff = await module.fromUrl(url);
      } catch (e) {
        console.error('Failed to import geotiff dynamically:', e);
        throw new Error('GeoTIFF library not available');
      }
    }
  } catch (error) {
    console.error('Error loading GeoTIFF:', error);
    throw new Error(`Failed to load GeoTIFF from URL: ${url}`);
  }
  
  if (!tiff) {
    throw new Error('Failed to load GeoTIFF library');
  }
  
  const image = await tiff.getImage();

  // Extract metadata
  const imageWidth = image.getWidth();
  const imageHeight = image.getHeight();
  const imageBounds = image.getBoundingBox();

  const metadata: GeoTIFFMetadata = {
    width: imageWidth,
    height: imageHeight,
    bounds: imageBounds as number[],
    resolution: image.getResolution(),
    samplesPerPixel: image.getSamplesPerPixel()
  };

  return { image, metadata };
}

/**
 * Function to convert Web Mercator coordinates to Lat/Lng
 */
export function mercatorToLatLng(mercatorX: number, mercatorY: number): [number, number] {
  // Earth's radius in meters at the equator
  const earthRadius = 6378137;

  // Convert X coordinate from meters to longitude in degrees
  const lng = (mercatorX / earthRadius) * (180 / Math.PI);

  // Convert Y coordinate from meters to latitude in degrees
  // Using the inverse Mercator projection formula
  const lat = (Math.PI / 2 - 2 * Math.atan(Math.exp(-mercatorY / earthRadius))) * (180 / Math.PI);

  // Clamp to valid lat/lng range
  const clampedLng = Math.max(-180, Math.min(180, lng));
  const clampedLat = Math.max(-85.051129, Math.min(85.051129, lat));

  return [clampedLng, clampedLat];
}

/**
 * Validate and adjust bounds if needed, including handling latitude limits for global bounds
 * @param bounds The bounds to validate
 * @param projectionInfo Optional projection information (e.g., 'EPSG:3857')
 */
export function validateBounds(bounds: number[], projectionInfo?: string): number[] {
  // Initialize bounds with a default value to avoid null issues
  if (!bounds || bounds.length !== 4) {
    console.warn('GeoTIFF Processor: Missing or invalid bounds, using global bounds');
    return [-180, -85, 180, 85]; // Use global bounds with latitude limits
  }

  // Check if projection is Web Mercator or if coordinates are outside WGS84 range
  const isWebMercator = projectionInfo === 'EPSG:3857' ||
    Math.abs(bounds[0]) > 180 ||
    Math.abs(bounds[2]) > 180;

  if (isWebMercator) {
    console.log('GeoTIFF Processor: Detected Web Mercator coordinates, converting to WGS84');

    // Convert Web Mercator bounds to lat/lng
    const sw = mercatorToLatLng(bounds[0], bounds[1]);
    const ne = mercatorToLatLng(bounds[2], bounds[3]);

    console.log('GeoTIFF Processor: Converted Web Mercator bounds:');
    console.log(`  Original: [${bounds[0]}, ${bounds[1]}, ${bounds[2]}, ${bounds[3]}]`);
    console.log(`  Converted: [${sw[0]}, ${sw[1]}, ${ne[0]}, ${ne[1]}]`);

    return [sw[0], sw[1], ne[0], ne[1]];
  }

  // Check for Web Mercator global bounds (approximately ±20037508.34, ±10018754.17)
  const isWebMercatorGlobalBounds =
    Math.abs(bounds[0] + 20037508.34) < 100 &&
    Math.abs(bounds[1] + 10018754.17) < 100 &&
    Math.abs(bounds[2] - 20037508.34) < 100 &&
    Math.abs(bounds[3] - 10018754.17) < 100;

  if (isWebMercatorGlobalBounds) {
    console.log('GeoTIFF Processor: Detected Web Mercator global bounds, using global WGS84 bounds with latitude limits');
    return [-180, -85, 180, 85]; // Use global bounds with latitude limits
  }

  // Check for invalid coordinates in WGS84
  if (
    bounds.some((coord) => typeof coord !== 'number' || !isFinite(coord)) ||
    bounds[0] < -180 || bounds[0] > 180 || // west
    bounds[2] < -180 || bounds[2] > 180 || // east
    bounds[1] < -90 || bounds[1] > 90 || // south
    bounds[3] < -90 || bounds[3] > 90     // north
  ) {
    console.warn('GeoTIFF Processor: Invalid or out-of-range bounds, using global bounds:', bounds);
    return [-180, -85, 180, 85]; // Use global bounds with latitude limits
  }

  // For any bounds that are close to global, use slightly smaller bounds to avoid issues
  const isNearGlobalBounds =
    Math.abs(bounds[0] + 180) < 10 &&
    Math.abs(bounds[1] + 90) < 10 &&
    Math.abs(bounds[2] - 180) < 10 &&
    Math.abs(bounds[3] - 90) < 10;

  if (isNearGlobalBounds) {
    console.log('GeoTIFF Processor: Bounds are close to global, using slightly smaller bounds');
    return [-179.9, -89.9, 179.9, 89.9]; // Use slightly smaller bounds to avoid issues
  }

  // For non-global bounds, check if latitudes are too extreme and limit them if needed
  let [west, south, east, north] = bounds;

  // Limit extreme latitudes to avoid projection issues
  if (north > 85) {
    console.log(`GeoTIFF Processor: Limiting north latitude from ${north} to 85`);
    north = 85;
  }
  if (south < -85) {
    console.log(`GeoTIFF Processor: Limiting south latitude from ${south} to -85`);
    south = -85;
  }

  console.log('GeoTIFF Processor: Using bounds:', [west, south, east, north]);
  return [west, south, east, north];
}

/**
 * Get color from the viridis colormap
 * Using the exact same implementation as in GeoTIFFExample.svelte
 */
function getViridisColor(value: number): [number, number, number] {
  // Rescale value from 0-11 to 0-1 (similar to TiTiler's rescale=0,11)
  const rescaledValue = Math.min(1, Math.max(0, value / 11));

  // Map to colormap index
  const index = rescaledValue * (VIRIDIS_COLORMAP.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.min(VIRIDIS_COLORMAP.length - 1, lowerIndex + 1);
  const t = index - lowerIndex; // Interpolation factor

  // Interpolate between colors
  if (lowerIndex === upperIndex) {
    // Ensure we return a tuple of exactly 3 numbers
    const color = VIRIDIS_COLORMAP[lowerIndex];
    return [color[0], color[1], color[2]];
  }

  const lowerColor = VIRIDIS_COLORMAP[lowerIndex];
  const upperColor = VIRIDIS_COLORMAP[upperIndex];

  // Ensure we return a tuple of exactly 3 numbers
  return [
    Math.round(lowerColor[0] * (1 - t) + upperColor[0] * t),
    Math.round(lowerColor[1] * (1 - t) + upperColor[1] * t),
    Math.round(lowerColor[2] * (1 - t) + upperColor[2] * t)
  ];
}

/**
 * Process GeoTIFF data and return a data URL
 */
export async function processGeoTIFF(
  image: any,
  options: ProcessingOptions = {}
): Promise<string> {
  const width = image.getWidth();
  const height = image.getHeight();

  console.log('GeoTIFF Processor: Reading raster data...');
  const data = await image.readRasters();

  // Create a canvas to render the data
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Create an ImageData object
  const imageData = ctx.createImageData(width, height);

  // Find data range to determine no-data values
  const rasterData = data as any;
  let minValue = Infinity;
  let maxValue = -Infinity;

  // Scan for min/max values and identify no-data areas
  for (let i = 0; i < width * height; i++) {
    const value = rasterData[0][i]; // First band
    if (value !== 0 && !isNaN(value)) {
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
    }
  }

  console.log(`GeoTIFF Processor: Data range: ${minValue} to ${maxValue}`);

  // Use provided rescale values or default to the detected range
  const rescale = options.rescale || [minValue, maxValue];
  const noDataThreshold = options.noDataThreshold || 0.01;

  // Apply colormap to raster data with better no-data handling
  for (let i = 0; i < width * height; i++) {
    const value = rasterData[0][i]; // First band

    // More aggressive no-data detection
    // Consider values very close to 0 or outside reasonable range as no-data
    if (value === 0 || isNaN(value) || value < minValue * 0.01) {
      // Transparent for no-data values
      imageData.data[i * 4] = 0;
      imageData.data[i * 4 + 1] = 0;
      imageData.data[i * 4 + 2] = 0;
      imageData.data[i * 4 + 3] = 0;
    } else {
      // Apply viridis colormap
      const [r, g, b] = getViridisColor(value);
      imageData.data[i * 4] = r;
      imageData.data[i * 4 + 1] = g;
      imageData.data[i * 4 + 2] = b;
      imageData.data[i * 4 + 3] = 255; // Alpha
    }
  }

  // Put the image data on the canvas
  ctx.putImageData(imageData, 0, 0);

  // Convert canvas to data URL
  const dataUrl = canvas.toDataURL('image/png');
  console.log('GeoTIFF Processor: Created data URL');

  return dataUrl;
}

/**
 * Load and process a GeoTIFF from a URL
 */
export async function loadAndProcessGeoTIFF(
  url: string,
  options: ProcessingOptions = {}
): Promise<{
  dataUrl: string;
  metadata: GeoTIFFMetadata;
  bounds: number[];
}> {
  try {
    // Load the GeoTIFF
    const { image, metadata } = await loadGeoTIFF(url);

    // Extract projection information from GeoTIFF metadata
    let projectionInfo = null;
    try {
      const geoKeys = image.getGeoKeys();
      if (geoKeys && geoKeys.ProjectedCSTypeGeoKey) {
        projectionInfo = `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`;
        console.log(`GeoTIFF Processor: Detected projection ${projectionInfo}`);
      } else if (geoKeys && geoKeys.GeographicTypeGeoKey) {
        projectionInfo = `EPSG:${geoKeys.GeographicTypeGeoKey}`;
        console.log(`GeoTIFF Processor: Detected geographic CRS ${projectionInfo}`);
      }

      // Store projection info in metadata
      metadata.projection = projectionInfo;
    } catch (err) {
      console.warn('GeoTIFF Processor: Error extracting projection info:', err);
    }

    // Initialize bounds with a default value to avoid null issues
    let bounds = (metadata.bounds as number[]) || [-20, -35, 55, 40]; // Default to Africa if null
    console.log('GeoTIFF Processor: Raw bounds from GeoTIFF:', bounds);

    // Validate and adjust bounds, passing projection info
    bounds = validateBounds(bounds, projectionInfo || undefined);

    // Process the GeoTIFF
    const dataUrl = await processGeoTIFF(image, options);

    return { dataUrl, metadata, bounds };
  } catch (error) {
    console.error('GeoTIFF Processor: Error processing GeoTIFF:', error);
    throw error;
  }
}
