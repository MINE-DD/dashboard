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

    // Log GeoTIFF metadata for debugging
    const fileDirectory = image.getFileDirectory();
    console.log('GeoTIFF: File directory metadata:', fileDirectory);

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
  // Web Mercator (EPSG:3857) to WGS84 (EPSG:4326) conversion
  // Constants
  const earthRadius = 6378137.0; // in meters

  // Convert x coordinate to longitude (in degrees)
  let lon = (x * 180.0) / (Math.PI * earthRadius);

  // Convert y coordinate to latitude (in degrees)
  // The formula correctly handles the Mercator projection
  let lat = 90 - (360 * Math.atan(Math.exp(-y / earthRadius))) / Math.PI;

  // Clamp to valid range
  lon = Math.max(-180, Math.min(180, lon));
  lat = Math.max(-85.05112878, Math.min(85.05112878, lat));

  return [lon, lat];
}

/**
 * Sets up a custom Africa bounding box since the GeoTIFF has global bounds
 * but the data is focused on Africa
 */
function getAfricaBoundingBox(): [number, number, number, number] {
  // Return a bounding box that covers Africa
  // [west, south, east, north] in WGS84 coordinates (longitude, latitude)
  return [-25, -40, 60, 45]; // Africa + some margin
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
    console.log('GeoTIFF: Bounds already in WGS84 range, no transformation needed');
    return bounds;
  }

  // Regular transformation for Web Mercator bounds
  const [west, south] = webMercatorToWgs84(bounds[0], bounds[1]);
  const [east, north] = webMercatorToWgs84(bounds[2], bounds[3]);

  console.log(`GeoTIFF: Transformed bounds from Web Mercator to WGS84: [${bounds}] -> [${west}, ${south}, ${east}, ${north}]`);

  return [west, south, east, north];
}

/**
 * Detects the coordinate system of a GeoTIFF image
 * @param image GeoTIFF image
 * @returns Object with coordinate system information
 */
function detectCoordinateSystem(image: GeoTIFF.GeoTIFFImage): {
  isWGS84: boolean,
  isWebMercator: boolean,
  projectionCode?: string
} {
  try {
    const fileDirectory = image.getFileDirectory();

    // Check for GeoKeyDirectoryTag which contains projection info
    if (fileDirectory.GeoKeyDirectory) {
      const geoKeys = fileDirectory.GeoKeyDirectory;

      // Look for ProjectedCSTypeGeoKey (3072) or GeographicTypeGeoKey (2048)
      for (let i = 4; i < geoKeys.length; i += 4) {
        if (geoKeys[i] === 3072 || geoKeys[i] === 2048) {
          const projectionCode = geoKeys[i + 3];
          console.log(`GeoTIFF: Found projection code ${projectionCode}`);

          // EPSG:4326 (WGS84)
          if (projectionCode === 4326) {
            return { isWGS84: true, isWebMercator: false, projectionCode: 'EPSG:4326' };
          }

          // EPSG:3857 (Web Mercator)
          if (projectionCode === 3857) {
            return { isWGS84: false, isWebMercator: true, projectionCode: 'EPSG:3857' };
          }

          return {
            isWGS84: false,
            isWebMercator: false,
            projectionCode: `EPSG:${projectionCode}`
          };
        }
      }
    }

    // If no projection info found, try to infer from bounds
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

        // If bounds are within WGS84 range, assume WGS84
        if (Math.abs(xMin) <= 180 && Math.abs(yMin) <= 90 &&
          Math.abs(xMax) <= 180 && Math.abs(yMax) <= 90) {
          console.log('GeoTIFF: Bounds suggest WGS84 coordinate system');
          return { isWGS84: true, isWebMercator: false, projectionCode: 'EPSG:4326' };
        }

        // If bounds are in Web Mercator range
        if (xMin >= -20037508.3427892 && xMin <= 20037508.3427892 &&
          yMin >= -20037508.3427892 && yMin <= 20037508.3427892 &&
          xMax >= -20037508.3427892 && xMax <= 20037508.3427892 &&
          yMax >= -20037508.3427892 && yMax <= 20037508.3427892) {
          console.log('GeoTIFF: Bounds suggest Web Mercator coordinate system');
          return { isWGS84: false, isWebMercator: true, projectionCode: 'EPSG:3857' };
        }
      }
    } catch (e) {
      console.log('GeoTIFF: Could not determine coordinate system from bounds');
    }

    // Default to WGS84 if we can't determine
    console.log('GeoTIFF: Could not determine coordinate system, assuming WGS84');
    return { isWGS84: true, isWebMercator: false };

  } catch (e) {
    console.warn('GeoTIFF: Error detecting coordinate system:', e);
    // Default to WGS84 if there's an error
    return { isWGS84: true, isWebMercator: false };
  }
}

/**
 * Gets bounds from a GeoTIFF image
 * @param image GeoTIFF image
 * @returns Bounds as [west, south, east, north]
 */
export function getGeoTIFFBounds(image: GeoTIFF.GeoTIFFImage): [number, number, number, number] {
  // Detect coordinate system
  const coordSystem = detectCoordinateSystem(image);
  console.log(`GeoTIFF: Detected coordinate system: ${coordSystem.projectionCode || 'Unknown'}`);

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

      // Only transform if it's Web Mercator
      if (coordSystem.isWebMercator) {
        return transformBoundsToWgs84([xMin, yMin, xMax, yMax]);
      } else {
        // For WGS84 or other projections, use bounds directly
        // But ensure they're within valid range for WGS84
        const validBounds: [number, number, number, number] = [
          Math.max(-180, Math.min(180, xMin)),
          Math.max(-90, Math.min(90, yMin)),
          Math.max(-180, Math.min(180, xMax)),
          Math.max(-90, Math.min(90, yMax))
        ];
        return validBounds;
      }
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

  // Log the raw bounds for debugging
  console.log(`GeoTIFF: Raw bounds from geo transform: [${rawBounds}]`);

  // Check if bounds need to be swapped (sometimes west/east or north/south are reversed)
  const fixedBounds = ensureCorrectBoundsOrder(rawBounds);
  if (fixedBounds !== rawBounds) {
    console.log(`GeoTIFF: Fixed bounds order: [${fixedBounds}]`);
  }

  // Only transform if it's Web Mercator
  if (coordSystem.isWebMercator) {
    return transformBoundsToWgs84(fixedBounds);
  } else {
    // For WGS84 or other projections, use bounds directly
    // But ensure they're within valid range for WGS84
    const validBounds: [number, number, number, number] = [
      Math.max(-180, Math.min(180, fixedBounds[0])),
      Math.max(-90, Math.min(90, fixedBounds[1])),
      Math.max(-180, Math.min(180, fixedBounds[2])),
      Math.max(-90, Math.min(90, fixedBounds[3]))
    ];
    return validBounds;
  }
}

/**
 * Ensures bounds are in the correct order: [west, south, east, north]
 * Sometimes GeoTIFFs have bounds in the wrong order
 */
function ensureCorrectBoundsOrder(bounds: [number, number, number, number]): [number, number, number, number] {
  // Extract bounds
  let [west, south, east, north] = bounds;

  // Check if west and east need to be swapped
  if (west > east) {
    console.log('GeoTIFF: West > East, swapping longitude values');
    [west, east] = [east, west];
  }

  // Check if south and north need to be swapped
  if (south > north) {
    console.log('GeoTIFF: South > North, swapping latitude values');
    [south, north] = [north, south];
  }

  return [west, south, east, north];
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
    // For EPSG:4326 (WGS84) GeoTIFFs, we need to ensure correct positioning
    // The order is: top-left, top-right, bottom-right, bottom-left
    // Each coordinate is [longitude, latitude]
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

    // Log the coordinates for debugging
    console.log(`GeoTIFF: Coordinates for ${layer.id}:`, JSON.stringify(coordinates));

    // Validate coordinates - check if they form a valid rectangle
    const isValidRectangle =
      coordinates[0][0] < coordinates[1][0] && // west < east
      coordinates[2][1] < coordinates[0][1];   // south < north

    if (!isValidRectangle) {
      console.warn(`GeoTIFF: Invalid rectangle for ${layer.id}. Attempting to fix.`);
      // Try to fix by ensuring west < east and south < north
      const west = Math.min(bounds[0], bounds[2]);
      const east = Math.max(bounds[0], bounds[2]);
      const south = Math.min(bounds[1], bounds[3]);
      const north = Math.max(bounds[1], bounds[3]);

      // Recreate coordinates with corrected bounds
      coordinates[0] = [west, north]; // top-left
      coordinates[1] = [east, north]; // top-right
      coordinates[2] = [east, south]; // bottom-right
      coordinates[3] = [west, south]; // bottom-left

      console.log(`GeoTIFF: Fixed coordinates for ${layer.id}:`, JSON.stringify(coordinates));
    }

    console.log(`GeoTIFF: Using coordinates for ${layer.id}:`, coordinates);

    // Check for anti-meridian issues and correct if needed
    for (let i = 0; i < coordinates.length; i++) {
      if (coordinates[i][0] < -180) coordinates[i][0] = -180;
      if (coordinates[i][0] > 180) coordinates[i][0] = 180;
      if (coordinates[i][1] < -85) coordinates[i][1] = -85;
      if (coordinates[i][1] > 85) coordinates[i][1] = 85;
    }

    // Flip the image data vertically to fix the upside-down issue
    // Read raster data from image with options to correct orientation
    const width = image.getWidth();
    const height = image.getHeight();
    const numBands = image.getSamplesPerPixel();

    console.log(`GeoTIFF: Image dimensions ${width}x${height} with ${numBands} bands`);

    // Determine sample type and range
    const metadata = {
      width,
      height,
      numBands,
      fileDirectory: image.getFileDirectory()
    };
    console.log('GeoTIFF: Metadata:', metadata);

    // Read the image data
    const rasterOptions = {};
    const rasterData = await image.readRasters(rasterOptions);

    // Get the bands (will be different length arrays depending on number of bands)
    const bands: Array<TypedArray> = [];
    for (let i = 0; i < numBands; i++) {
      bands.push(rasterData[i] as TypedArray);
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

    // Define TypedArray type for clarity
    type TypedArray = Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array;

    // Function to get percentile value
    const getPercentileValue = (arr: TypedArray, percentile: number): number => {
      // Create a sorted copy of the data
      const sortedData = Array.from(arr).sort((a, b) => Number(a) - Number(b));
      const index = Math.floor(sortedData.length * percentile / 100);
      return Number(sortedData[index]);
    };

    // Check if we have a multi-band (RGB) image
    const isRGB = numBands >= 3;
    console.log(`GeoTIFF: Image is ${isRGB ? 'RGB' : 'single-band'}`);

    // For single-band visualization, we need to determine min/max values
    if (!isRGB) {
      // Use just the first band for single-band visualization
      // Skip NoData values (often very large negative numbers or specific values like -9999)
      const band = bands[0] as TypedArray;

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
    }

    // Try to extract colormap from the GeoTIFF if available
    let useCustomColormap = true;
    let geoTiffColormap: number[][] = [];

    // Check if the GeoTIFF has a colormap
    const fileDirectory = image.getFileDirectory();
    if (fileDirectory.ColorMap) {
      try {
        console.log('GeoTIFF: Found embedded ColorMap');
        const colorMap = fileDirectory.ColorMap;

        // GeoTIFF colormaps are stored as a single array with R, G, B values for each index
        // We need to convert it to our format
        const numColors = colorMap.length / 3;
        for (let i = 0; i < numColors; i++) {
          const r = colorMap[i] / 65535 * 255;
          const g = colorMap[i + numColors] / 65535 * 255;
          const b = colorMap[i + numColors * 2] / 65535 * 255;
          geoTiffColormap.push([Math.round(r), Math.round(g), Math.round(b)]);
        }

        if (geoTiffColormap.length > 0) {
          useCustomColormap = false;
          console.log(`GeoTIFF: Using embedded colormap with ${geoTiffColormap.length} colors`);
        }
      } catch (e) {
        console.warn('GeoTIFF: Error extracting colormap:', e);
      }
    }

    // Default colormap if we couldn't extract one from the GeoTIFF
    // Using a red-yellow-blue colormap which is better for prevalence data
    // This matches the colors in the TiTiler implementation
    const defaultColormap = [
      [165, 0, 38],     // Dark red
      [215, 48, 39],    // Red
      [244, 109, 67],   // Light red
      [253, 174, 97],   // Orange
      [254, 224, 144],  // Light yellow
      [224, 243, 248],  // Light blue
      [171, 217, 233],  // Medium blue
      [116, 173, 209],  // Blue
      [69, 117, 180],   // Dark blue
      [49, 54, 149]     // Very dark blue
    ];

    // Function to get color from the colormap
    const getColor = (value: number) => {
      // Normalize value to 0-1 range
      const normValue = Math.max(0, Math.min(1, (value - min) / (max - min)));

      // Use the appropriate colormap
      const colormap = useCustomColormap ? defaultColormap : geoTiffColormap;

      // Map to colormap index
      const index = normValue * (colormap.length - 1);
      const lowerIdx = Math.floor(index);
      const upperIdx = Math.min(colormap.length - 1, lowerIdx + 1);
      const t = index - lowerIdx; // Interpolation factor

      // Interpolate between colors
      const lowerColor = colormap[lowerIdx];
      const upperColor = colormap[upperIdx];

      return [
        Math.round(lowerColor[0] * (1 - t) + upperColor[0] * t),
        Math.round(lowerColor[1] * (1 - t) + upperColor[1] * t),
        Math.round(lowerColor[2] * (1 - t) + upperColor[2] * t)
      ];
    };

    // Force vertical flip since the image is still upside down
    const needsFlip = true; // Force flip to fix the upside-down issue
    console.log(`GeoTIFF: Image ${needsFlip ? 'needs' : 'does not need'} vertical flip`);

    // Fill the ImageData
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Only flip Y coordinate if needed
        const srcIdx = needsFlip ? (height - 1 - y) * width + x : y * width + x;
        const destIdx = y * width + x;

        // Handle RGB images directly
        if (isRGB) {
          // Get sample type to determine if we need to scale values
          const sampleFormat = fileDirectory.SampleFormat ? fileDirectory.SampleFormat[0] : 1; // Default to unsigned
          const bitsPerSample = fileDirectory.BitsPerSample ? fileDirectory.BitsPerSample[0] : 8; // Default to 8 bits

          // Determine if we need to scale the values
          let needsScaling = false;
          let scaleFactor = 1;

          // If values are stored with more than 8 bits per sample, we need to scale them to 0-255
          if (bitsPerSample > 8) {
            needsScaling = true;
            scaleFactor = 255 / ((1 << bitsPerSample) - 1);
            console.log(`GeoTIFF: Scaling RGB values with factor ${scaleFactor} (${bitsPerSample} bits per sample)`);
          }

          // Get RGB values directly from bands
          let r = Number(bands[0][srcIdx]);
          let g = Number(bands[1][srcIdx]);
          let b = Number(bands[2][srcIdx]);

          // Scale values if needed
          if (needsScaling) {
            r = Math.round(r * scaleFactor);
            g = Math.round(g * scaleFactor);
            b = Math.round(b * scaleFactor);
          }

          // Clamp to 0-255 range
          r = Math.min(255, Math.max(0, r));
          g = Math.min(255, Math.max(0, g));
          b = Math.min(255, Math.max(0, b));

          // Check for NoData values
          if ((r === 0 && g === 0 && b === 0) || !isFinite(r) || !isFinite(g) || !isFinite(b)) {
            // Set transparent for NoData
            imageData.data[destIdx * 4 + 3] = 0;
            continue;
          }

          // Set RGBA values
          imageData.data[destIdx * 4] = r;
          imageData.data[destIdx * 4 + 1] = g;
          imageData.data[destIdx * 4 + 2] = b;
          imageData.data[destIdx * 4 + 3] = 255; // Full opacity for valid data
        } else {
          // Single-band visualization with colormap
          const value = Number(bands[0][srcIdx]);

          // Skip NoData values (if defined)
          if (value === -9999 || value === -32767 || !isFinite(value)) {
            // Set transparent
            imageData.data[destIdx * 4 + 3] = 0;
            continue;
          }

          // Get color from colormap for this value
          const [r, g, b] = getColor(value);

          // Set RGBA values
          imageData.data[destIdx * 4] = r;
          imageData.data[destIdx * 4 + 1] = g;
          imageData.data[destIdx * 4 + 2] = b;
          imageData.data[destIdx * 4 + 3] = 255; // Full opacity for valid data
        }
      }
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
