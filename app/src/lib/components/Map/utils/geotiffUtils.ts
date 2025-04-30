import * as GeoTIFF from 'geotiff';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { RasterLayer } from '../store/types';

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
 * Gets bounds from a GeoTIFF image
 * @param image GeoTIFF image
 * @returns Bounds as [west, south, east, north]
 */
export function getGeoTIFFBounds(image: GeoTIFF.GeoTIFFImage): [number, number, number, number] {
  const geoKeys = image.getGeoKeys();
  const fileDirectory = image.getFileDirectory();
  const [xMin, yMin, xMax, yMax] = getBboxFromGeoTransform(
    fileDirectory.ModelTiepoint,
    fileDirectory.ModelPixelScale,
    image.getWidth(),
    image.getHeight()
  );

  return [xMin, yMin, xMax, yMax];
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
  // Get image bounds
  const bounds = layer.bounds || getGeoTIFFBounds(image);

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
  const rasterData = await image.readRasters();
  const width = image.getWidth();
  const height = image.getHeight();

  // Create a canvas element to draw the raster data
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  // Draw raster data to canvas
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Create an ImageData object to draw
  const imageData = ctx.createImageData(width, height);

  // Get the first band (usually the only one for single-band rasters)
  const firstBand = rasterData[0];

  // Determine min/max values for normalization
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < firstBand.length; i++) {
    const value = firstBand[i];
    if (value < min) min = value;
    if (value > max) max = value;
  }

  // Fill the ImageData
  for (let i = 0; i < firstBand.length; i++) {
    // Normalize value to 0-255 range
    const normalizedValue = Math.floor(255 * (firstBand[i] - min) / (max - min));

    // Apply a color ramp (using viridis-like colors)
    // This is a simple version - you can implement more sophisticated colormaps
    const r = Math.min(255, normalizedValue); // More red for higher values
    const g = Math.min(255, normalizedValue > 128 ? 255 - normalizedValue : normalizedValue * 2); // Green peaks in middle
    const b = Math.min(255, 255 - normalizedValue); // More blue for lower values

    // Set RGBA values
    imageData.data[i * 4] = r;
    imageData.data[i * 4 + 1] = g;
    imageData.data[i * 4 + 2] = b;
    imageData.data[i * 4 + 3] = 255; // Full opacity
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

  // Add the source
  map.addSource(sourceId, {
    type: 'image',
    url: dataUrl,
    coordinates
  });

  // Add the layer
  map.addLayer({
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: {
      'raster-opacity': layer.opacity,
      'raster-resampling': 'nearest'
    },
    layout: {
      visibility: layer.isVisible ? 'visible' : 'none'
    }
  });
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