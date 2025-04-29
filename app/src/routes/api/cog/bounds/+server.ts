import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import * as GeoTIFF from 'geotiff';

// Get the absolute path to the static directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticDir = path.resolve(__dirname, '../../../../../static');

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Get the URL parameter
    const cogUrl = url.searchParams.get('url');
    
    if (!cogUrl) {
      throw error(400, 'Missing URL parameter');
    }
    
    // Log the requested COG URL for debugging
    console.log(`COG bounds requested for: ${cogUrl}`);
    
    // Resolve the path to the local COG file in the static directory
    const filePath = path.resolve(staticDir, 'data/cogs', cogUrl);
    console.log(`Resolved to local path: ${filePath}`);
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      console.error(`COG file not found at: ${filePath}`);
      throw error(404, 'COG file not found');
    }
    
    console.log(`Found COG file at: ${filePath}`);
    
    // Extract the metadata from the GeoTIFF
    const tiff = await GeoTIFF.fromFile(filePath);
    const image = await tiff.getImage();
    const bbox = image.getBoundingBox();
    const fileDirectory = image.getFileDirectory();
    
    // Return the bounds in the format that your app expects
    return json({ 
      bounds: bbox,
      width: fileDirectory.ImageWidth,
      height: fileDirectory.ImageLength
    });
  } catch (e) {
    console.error('Error in bounds endpoint:', e);
    if (e.status) {
      throw e; // Rethrow SvelteKit errors
    }
    throw error(500, e.message || 'Internal server error');
  }
};