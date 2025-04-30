import * as GeoTIFF from 'geotiff';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { RasterLayer } from '../store/types';
import { rasterLayers } from '../store'; // Add this import for updating layer bounds

/**
 * Loads a GeoTIFF file directly in the browser using GeoTIFF.js
 * @param url URL to the GeoTIFF file
 * @returns Promise resolving to a GeoTIFF.js image
 */
export async function loadGeoTIFF(url: string): Promise<GeoTIFF.GeoTIFFImage> {
  try {
    // URL is already correct for dev server at localhost:5173
    // No need to modify paths - the browser can access /data/cogs/ directly
    console.log(`GeoTIFF: Loading from URL: ${url}`);

    // Fetch and parse the GeoTIFF file
    const tiff = await GeoTIFF.fromUrl(url);
    const image = await tiff.getImage();
    return image;
  } catch (error) {
    console.error('Error loading GeoTIFF:', error);
    throw new Error(`Failed to load GeoTIFF from ${url}: ${error}`);
  }
}

/**
 * Transforms coordinates from Web Mercator (EPSG:3857) to WGS84 (EPSG:4326)
 * @param x X coordinate in Web Mercator
 * @param y Y coordinate in Web Mercator
 * @returns [longitude, latitude] in WGS84
 */
function webMercatorToWgs84(x: number, y: number): [number, number] {
  // Constants for the Web Mercator projection
  const R = 6378137; // Earth's radius in meters
  const MAX_LATITUDE = 85.0511287798; // Maximum latitude in Web Mercator

  // Convert x coordinate to longitude
  const lon = (x / R) * (180 / Math.PI);
  
  // Convert y coordinate to latitude
  let lat = (y / R) * (180 / Math.PI);
  lat = (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - (Math.PI / 2)) * (180 / Math.PI);
  
  // Clamp latitude to valid range
  lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
  
  return [lon, lat];
}

/**
 * Transforms bounds from Web Mercator (EPSG:3857) to WGS84 (EPSG:4326)
 * @param bounds Bounds as [west, south, east, north] in Web Mercator
 * @returns Bounds as [west, south, east, north] in WGS84
 */
function transformBoundsToWgs84(bounds: [number, number, number, number]): [number, number, number, number] {
  // Check if bounds are already in reasonable WGS84 range
  if (Math.abs(bounds[0]) <= 180 && Math.abs(bounds[1]) <= 90 && 
      Math.abs(bounds[2]) <= 180 && Math.abs(bounds[3]) <= 90) {
    return bounds;
  }
  
  // Transform corners
  const [west, south] = webMercatorToWgs84(bounds[0], bounds[1]);
  const [east, north] = webMercatorToWgs84(bounds[2], bounds[3]);
  
  console.log(`GeoTIFF: Transformed bounds from Web Mercator to WGS84: [${bounds}] -> [${west}, ${south}, ${east}, ${north}]`);
  
  return [west, south, east, north];
}

/**
 * Gets bounds from a GeoTIFF image
 * @param image GeoTIFF image
 * @returns Bounds as [west, south, east, north]
 */
export function getGeoTIFFBounds(image: GeoTIFF.GeoTIFFImage): [number, number, number, number] {
  // Use the proper GeoTIFF.js methods based on documentation
  // First try to get origin/resolution directly
  try {
    const origin = image.getOrigin();
    const resolution = image.getResolution();
    const width = image.getWidth();
    const height = image.getHeight();
    
    if (origin && resolution) {
      // Calculate bounds using origin and resolution
      const xMin = origin[0];
      const yMax = origin[1];
      const xMax = xMin + width * resolution[0];
      const yMin = yMax - height * resolution[1]; // Y goes down in pixel space
      
      console.log(`GeoTIFF: Using origin/resolution for bounds: origin=${origin}, resolution=${resolution}`);
      
      // Transform to WGS84 if needed and return
      return transformBoundsToWgs84([xMin, yMin, xMax, yMax]);
    }
  } catch (e) {
    console.log('GeoTIFF: Could not get origin/resolution directly, falling back to ModelTiepoint/ModelPixelScale');
  }
  
  // Fall back to manual calculation from ModelTiepoint/ModelPixelScale
  const fileDirectory = image.getFileDirectory();
  const tiepoint = fileDirectory.ModelTiepoint;
  const scale = fileDirectory.ModelPixelScale;
  
  if (!tiepoint || !scale) {
    console.warn('GeoTIFF: No ModelTiepoint or ModelPixelScale found, using placeholder bounds');
    return [-180, -90, 180, 90]; // Default to global extent
  }
  
  const rawBounds = getBboxFromGeoTransform(
    tiepoint,
    scale,
    image.getWidth(),
    image.getHeight()
  );
  
  // Transform to WGS84 if needed
  return transformBoundsToWgs84(rawBounds);
}

/**
 * Calculates bounding box from GeoTIFF geo transforms
 */
function getBboxFromGeoTransform(
  tiepoints: number[],
  scale: number[],
  width: number,
  height: number
): [number, number, number, number] {
  // Extract origin and pixel size from tiepoints and scale
  const x0 = tiepoints[3];
  const y0 = tiepoints[4];
  const xScale = scale[0];
  const yScale = scale[1];

  // Calculate bounds
  const xMin = x0;
  const yMax = y0;
  const xMax = x0 + width * xScale;
  const yMin = y0 - height * yScale;

  return [xMin, yMin, xMax, yMax];
}

/**
 * Renders a GeoTIFF image on a MapLibre map
 * @param map MapLibre map instance
 * @param layer Raster layer configuration
 * @param image GeoTIFF image
 */
export async function renderGeoTIFFOnMap(
  map: MaplibreMap,
  layer: RasterLayer,
  image: GeoTIFF.GeoTIFFImage
): Promise<void> {
  try {
    // Get image bounds from GeoTIFF metadata
    const bounds = getGeoTIFFBounds(image);
    console.log(`GeoTIFF: Extracted bounds for ${layer.id}:`, bounds);
    
    // Create coordinates in the format MapLibre expects
    const coordinates: [
      [number, number],
      [number, number],
      [number, number],
      [number, number]
    ] = [
      [bounds[0], bounds[3]], // top-left [lng, lat]
      [bounds[2], bounds[3]], // top-right
      [bounds[2], bounds[1]], // bottom-right
      [bounds[0], bounds[1]]  // bottom-left
    ];
    
    // Read raster data from image
    const width = image.getWidth();
    const height = image.getHeight();
    const numBands = image.getSamplesPerPixel();
    
    console.log(`GeoTIFF: Image dimensions ${width}x${height} with ${numBands} bands`);
    
    // Determine sample type and range
    const metadata = {
      width, 
      height,
      numBands,
      // Remove getDataType as it's not available in this version
      fileDirectory: image.getFileDirectory()
    };
    console.log('GeoTIFF: Metadata:', metadata);
    
    // Read the image data
    const rasterOptions = {};
    const rasterData = await image.readRasters(rasterOptions);
    
    // Get the bands (will be different length arrays depending on number of bands)
    const bands = [];
    for (let i = 0; i < numBands; i++) {
      bands.push(rasterData[i]);
    }
    
    // Create a canvas element to draw the raster data
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    // Draw raster data to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    // Create an ImageData object
    const imageData = ctx.createImageData(width, height);
    
    // For visualization, we need to determine actual min/max values for normalization
    // Get proper min/max based on percentiles to handle outliers
    let min = Infinity, max = -Infinity;
    
    // Function to get percentile value
    const getPercentileValue = (arr: any, percentile: number) => {
      // Create a sorted copy of the data
      const sortedData = Array.from(arr).sort((a, b) => a - b);
      const index = Math.floor(sortedData.length * percentile / 100);
      return sortedData[index];
    };
    
    // Use just the first band for single-band visualization
    // Skip NoData values (often very large negative numbers or specific values like -9999)
    const band = bands[0];
    
    // Check if band data exists
    if (!band || band.length === 0) {
      throw new Error('No valid band data found in GeoTIFF');
    }
    
    // For visualization, trim outliers by getting 1% and 99% percentiles
    const p1 = getPercentileValue(band, 1);
    const p99 = getPercentileValue(band, 99);
    min = p1;
    max = p99;
    
    console.log(`GeoTIFF: Using min=${min}, max=${max} for visualization (1% and 99% percentiles)`);
    
    // Create a colormap - using a viridis-like scheme for single-band data
    // These are approximate viridis colors from matplotlib
    const viridisColormap = [
      [68, 1, 84],    // Dark purple
      [70, 50, 126],  // Purple
      [54, 92, 141],  // Blue
      [39, 127, 142], // Cyan
      [31, 161, 135], // Teal
      [74, 194, 109], // Green
      [160, 217, 58], // Light green
      [253, 231, 37]  // Yellow
    ];
    
    // Function to get color from the colormap
    const getColor = (value: number) => {
      // Normalize value to 0-1 range
      const normValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
      
      // Map to colormap index
      const index = normValue * (viridisColormap.length - 1);
      const lowerIdx = Math.floor(index);
      const upperIdx = Math.min(viridisColormap.length - 1, lowerIdx + 1);
      const t = index - lowerIdx; // Interpolation factor
      
      // Interpolate between colors
      const lowerColor = viridisColormap[lowerIdx];
      const upperColor = viridisColormap[upperIdx];
      
      return [
        Math.round(lowerColor[0] * (1 - t) + upperColor[0] * t),
        Math.round(lowerColor[1] * (1 - t) + upperColor[1] * t),
        Math.round(lowerColor[2] * (1 - t) + upperColor[2] * t)
      ];
    };
    
    // Fill the ImageData
    for (let i = 0; i < width * height; i++) {
      const value = band[i];
      
      // Skip NoData values (if defined)
      if (value === -9999 || value === -32767 || !isFinite(value)) {
        // Set transparent
        imageData.data[i * 4 + 3] = 0;
        continue;
      }
      
      // Get color from colormap for this value
      const [r, g, b] = getColor(value);
      
      // Set RGBA values
      imageData.data[i * 4] = r;
      imageData.data[i * 4 + 1] = g;
      imageData.data[i * 4 + 2] = b;
      imageData.data[i * 4 + 3] = 255; // Full opacity for valid data
    }
    
    // Put image data on canvas
    ctx.putImageData(imageData, 0, 0);
    
    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png');
    
    // Source ID and layer ID
    const sourceId = `geotiff-source-${layer.id}`;
    const layerId = `geotiff-layer-${layer.id}`;
    
    // Remove existing source/layer if they exist
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
    
    console.log(`GeoTIFF: Adding layer ${layerId} with bounds:`, coordinates);
    
    // Add the source
    map.addSource(sourceId, {
      type: 'image',
      url: dataUrl,
      coordinates: coordinates
    });
    
    // Add the layer
    map.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: {
        'raster-opacity': layer.opacity,
        'raster-resampling': 'linear'
      },
      layout: {
        visibility: layer.isVisible ? 'visible' : 'none'
      }
    });
    
    // Update bounds in the layer if it was using dummy bounds
    if (!layer.bounds || 
        (layer.bounds[0] === -20 && layer.bounds[1] === -35 && 
         layer.bounds[2] === 55 && layer.bounds[3] === 40)) {
      // Update the layer's bounds with the actual bounds from GeoTIFF
      // This will help with future operations
      rasterLayers.update((currentLayers) => {
        const layerToUpdate = currentLayers.get(layer.id);
        if (layerToUpdate) {
          layerToUpdate.bounds = bounds;
        }
        return currentLayers;
      });
    }
  } catch (error) {
    console.error(`GeoTIFF: Error rendering ${layer.id}:`, error);
    throw error;
  }
}

/**
 * Loads and adds a GeoTIFF directly to the map from a URL
 * @param map MapLibre map instance
 * @param layer Raster layer configuration
 */
export async function addGeoTIFFToMap(map: MaplibreMap, layer: RasterLayer): Promise<void> {
  try {
    const image = await loadGeoTIFF(layer.sourceUrl);
    await renderGeoTIFFOnMap(map, layer, image);
    return Promise.resolve();
  } catch (error) {
    console.error(`Error adding GeoTIFF layer ${layer.id}:`, error);
    return Promise.reject(error);
  }
}