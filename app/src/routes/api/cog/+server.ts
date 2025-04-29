import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as fs from 'fs';
import * as path from 'path';
import * as GeoTIFF from 'geotiff';
import sharp from 'sharp';

// Define the path to your COG files in the static directory
const COGS_DIRECTORY = path.join(process.cwd(), 'static', 'data', 'cogs');

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Get operation type from the URL
    const operation = url.searchParams.get('operation');
    const cogFilename = url.searchParams.get('file');

    if (!cogFilename) {
      return json({ error: 'Missing file parameter' }, { status: 400 });
    }

    // Construct the path to the COG file, ensuring no path traversal
    const safeFilename = path.basename(cogFilename);
    const cogFilePath = path.join(COGS_DIRECTORY, safeFilename);

    // Check if the file exists
    if (!fs.existsSync(cogFilePath)) {
      console.error(`File not found: ${cogFilePath}`);
      return json({ error: 'COG file not found' }, { status: 404 });
    }

    console.log(`Processing ${operation} for ${cogFilePath}`);

    // Handle different operations
    switch (operation) {
      case 'bounds':
        return await getBounds(cogFilePath);
      case 'preview':
        return await getPreview(cogFilePath, url);
      default:
        return json({ error: 'Invalid operation' }, { status: 400 });
    }
  } catch (e) {
    console.error('Error in COG endpoint:', e);
    return json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
};

// Function to get bounds of a GeoTIFF
async function getBounds(filePath: string) {
  try {
    const tiff = await GeoTIFF.fromFile(filePath);
    const image = await tiff.getImage();
    const bbox = image.getBoundingBox();
    const fileDirectory = image.getFileDirectory();

    return json({
      bounds: bbox,
      width: fileDirectory.ImageWidth,
      height: fileDirectory.ImageLength
    });
  } catch (e) {
    console.error('Error getting bounds:', e);
    throw error(500, 'Failed to get bounds from GeoTIFF');
  }
}

// Function to generate a preview image
async function getPreview(filePath: string, url: URL) {
  try {
    // Parse preview options from query params
    const maxSize = parseInt(url.searchParams.get('max_size') || '1024', 10);

    // Parse band indices
    const bidx: number[] = [];
    url.searchParams.getAll('bidx').forEach(b => {
      const bandIndex = parseInt(b, 10);
      if (!isNaN(bandIndex)) {
        bidx.push(bandIndex);
      }
    });

    // Parse rescale values (min,max)
    let min = 0;
    let max = 255;
    const rescale = url.searchParams.get('rescale');
    if (rescale) {
      const [minStr, maxStr] = rescale.split(',');
      min = parseFloat(minStr) || 0;
      max = parseFloat(maxStr) || 255;
    }

    // Get colormap
    const colormap = url.searchParams.get('colormap_name') || undefined;

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

    // Read the data for the requested bands (default to first band if none specified)
    const samples = bidx.length > 0 ? bidx : [1];
    const rasters = await image.readRasters({
      width: previewWidth,
      height: previewHeight,
      samples: samples
    });

    // Generate image based on the number of bands
    let imageBuffer;

    if (samples.length === 1) {
      // Single band - apply colormap if requested
      const bandData = rasters[0];
      const range = max - min;

      if (colormap === 'viridis') {
        // Create RGB data with viridis-like colormap
        const rgbData = new Uint8Array(previewWidth * previewHeight * 3);

        for (let i = 0; i < bandData.length; i++) {
          // Normalize value to 0-255 range
          const value = Math.max(0, Math.min(255, Math.round(((bandData[i] - min) / range) * 255)));

          // Approximate viridis colormap
          const r = Math.round(70 - 70 * Math.pow(value / 255, 1.2));
          const g = Math.round(value < 128 ? value : 255 - (value - 128) * 0.5);
          const b = Math.round(value < 128 ? value * 1.5 : 255);

          rgbData[i * 3] = r;
          rgbData[i * 3 + 1] = g;
          rgbData[i * 3 + 2] = b;
        }

        // Create the PNG using sharp
        imageBuffer = await sharp(Buffer.from(rgbData), {
          raw: {
            width: previewWidth,
            height: previewHeight,
            channels: 3
          }
        }).png().toBuffer();
      } else {
        // Grayscale
        const pixelData = new Uint8Array(previewWidth * previewHeight);

        for (let i = 0; i < bandData.length; i++) {
          // Normalize to 0-255 range
          pixelData[i] = Math.max(0, Math.min(255, Math.round(((bandData[i] - min) / range) * 255)));
        }

        // Create grayscale PNG using sharp
        imageBuffer = await sharp(Buffer.from(pixelData), {
          raw: {
            width: previewWidth,
            height: previewHeight,
            channels: 1
          }
        }).png().toBuffer();
      }
    } else if (samples.length === 3) {
      // RGB composite
      const pixelData = new Uint8Array(previewWidth * previewHeight * 3);
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
      imageBuffer = await sharp(Buffer.from(pixelData), {
        raw: {
          width: previewWidth,
          height: previewHeight,
          channels: 3
        }
      }).png().toBuffer();
    } else {
      throw error(400, 'Unsupported number of bands');
    }

    // Return the image
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (e) {
    console.error('Error generating preview:', e);
    throw error(500, 'Failed to generate preview image');
  }
}