import fs from 'fs';
import path from 'path';
import * as GeoTIFF from 'geotiff';
import sharp from 'sharp';

// Path to the directory containing COG files, relative to the static folder
const COGS_BASE_PATH = 'static/data/cogs';

/**
 * Resolves a COG path from a URL parameter to a local file path
 */
export function resolveCogPath(urlPath: string): string {
  // Clean the path to prevent directory traversal
  const cleanPath = urlPath.replace(/\.\./g, '').replace(/^\/+/, '');
  
  // Resolve the absolute path to the COG file
  return path.resolve(process.cwd(), COGS_BASE_PATH, cleanPath);
}

/**
 * Check if a file exists and is accessible
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get metadata from a GeoTIFF file
 */
export async function getGeoTiffMetadata(filePath: string) {
  try {
    const tiff = await GeoTIFF.fromFile(filePath);
    const image = await tiff.getImage();
    const fileDirectory = image.getFileDirectory();
    const geoKeys = image.getGeoKeys();
    
    // Extract image dimensions
    const width = fileDirectory.ImageWidth;
    const height = fileDirectory.ImageLength;
    
    // Extract geospatial information
    const bbox = image.getBoundingBox();
    
    // Extract band information
    const samplesPerPixel = fileDirectory.SamplesPerPixel || 1;
    const bands = [];
    for (let i = 0; i < samplesPerPixel; i++) {
      bands.push({
        index: i + 1,
        type: fileDirectory.SampleFormat ? fileDirectory.SampleFormat[i] : 1,
        noData: fileDirectory.GDAL_NODATA ? fileDirectory.GDAL_NODATA[i] : null
      });
    }
    
    return {
      width,
      height,
      bounds: bbox,
      bands,
      geoKeys,
      resolution: image.getResolution(),
      proj4: geoKeys && geoKeys.ProjectedCSTypeGeoKey ? `+proj=utm +zone=${geoKeys.ProjectedCSTypeGeoKey}` : null
    };
  } catch (error) {
    console.error('Error reading GeoTIFF metadata:', error);
    throw new Error(`Failed to read GeoTIFF metadata: ${error.message}`);
  }
}

/**
 * Generate a preview image from a GeoTIFF file
 */
export async function generatePreviewImage(filePath: string, options: { 
  width?: number, 
  height?: number,
  bands?: number[],
  colormap?: string,
  min?: number,
  max?: number
} = {}) {
  try {
    // Default options
    const maxSize = options.width || 1024;
    const bands = options.bands || [1];
    const min = options.min !== undefined ? options.min : 0;
    const max = options.max !== undefined ? options.max : 255;
    
    // Read the GeoTIFF
    const tiff = await GeoTIFF.fromFile(filePath);
    const image = await tiff.getImage();
    const fileDirectory = image.getFileDirectory();
    const width = fileDirectory.ImageWidth;
    const height = fileDirectory.ImageLength;
    
    // Calculate dimensions to maintain aspect ratio
    const aspectRatio = width / height;
    let previewWidth = maxSize;
    let previewHeight = Math.round(maxSize / aspectRatio);
    
    if (previewHeight > maxSize) {
      previewHeight = maxSize;
      previewWidth = Math.round(maxSize * aspectRatio);
    }
    
    // Read the data for the requested bands
    const rasters = await image.readRasters({
      width: previewWidth,
      height: previewHeight,
      samples: bands
    });
    
    // Create a single-band or RGB image buffer
    let pixelData;
    
    if (bands.length === 1) {
      // Single band - create a grayscale image
      pixelData = new Uint8Array(previewWidth * previewHeight);
      
      const bandData = rasters[0];
      const range = max - min;
      
      for (let i = 0; i < bandData.length; i++) {
        // Normalize to 0-255 range
        pixelData[i] = Math.max(0, Math.min(255, Math.round(((bandData[i] - min) / range) * 255)));
      }
      
      // Apply colormap if requested (default to viridis-like)
      if (options.colormap) {
        const rgbData = new Uint8Array(previewWidth * previewHeight * 3);
        
        // Simple viridis-like colormap implementation
        for (let i = 0; i < pixelData.length; i++) {
          const value = pixelData[i];
          
          // Simple RGB mapping (can be expanded with more colormaps)
          if (options.colormap === 'viridis') {
            // Approximate viridis colormap
            const r = Math.round(70 - 70 * Math.pow(value / 255, 1.2));
            const g = Math.round(value < 128 ? value : 255 - (value - 128) * 0.5);
            const b = Math.round(value < 128 ? value * 1.5 : 255);
            
            rgbData[i * 3] = r;
            rgbData[i * 3 + 1] = g;
            rgbData[i * 3 + 2] = b;
          } else {
            // Grayscale as fallback
            rgbData[i * 3] = value;
            rgbData[i * 3 + 1] = value;
            rgbData[i * 3 + 2] = value;
          }
        }
        
        // Create the PNG using sharp
        const image = await sharp(Buffer.from(rgbData), {
          raw: {
            width: previewWidth,
            height: previewHeight,
            channels: 3
          }
        }).png().toBuffer();
        
        return image;
      } else {
        // Create a grayscale PNG using sharp
        const image = await sharp(Buffer.from(pixelData), {
          raw: {
            width: previewWidth,
            height: previewHeight,
            channels: 1
          }
        }).png().toBuffer();
        
        return image;
      }
    } else if (bands.length === 3) {
      // RGB composite
      pixelData = new Uint8Array(previewWidth * previewHeight * 3);
      
      const range = max - min;
      
      for (let i = 0; i < previewWidth * previewHeight; i++) {
        for (let b = 0; b < 3; b++) {
          // Normalize each band to 0-255
          pixelData[i * 3 + b] = Math.max(0, Math.min(255, 
            Math.round(((rasters[b][i] - min) / range) * 255)
          ));
        }
      }
      
      // Create the PNG using sharp
      const image = await sharp(Buffer.from(pixelData), {
        raw: {
          width: previewWidth,
          height: previewHeight,
          channels: 3
        }
      }).png().toBuffer();
      
      return image;
    }
  } catch (error) {
    console.error('Error generating preview image:', error);
    throw new Error(`Failed to generate preview image: ${error.message}`);
  }
}