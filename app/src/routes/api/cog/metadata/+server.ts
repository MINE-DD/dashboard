import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveCogPath, fileExists, getGeoTiffMetadata } from '$lib/cog-utils';

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Get the URL parameter
    const cogUrl = url.searchParams.get('url');
    
    if (!cogUrl) {
      return json({ error: 'Missing URL parameter' }, { status: 400 });
    }
    
    // Resolve the path to the local COG file
    const filePath = resolveCogPath(cogUrl);
    
    // Check if the file exists
    if (!await fileExists(filePath)) {
      return json({ error: 'COG file not found' }, { status: 404 });
    }
    
    // Extract the metadata from the GeoTIFF
    const metadata = await getGeoTiffMetadata(filePath);
    
    // Return the full metadata
    return json({
      cogMetadata: metadata,
      filename: cogUrl.split('/').pop(),
      driver: 'GTiff',
      dtype: 'float32', // This might need to be determined from the actual file
      nodata: metadata.bands[0]?.noData,
      count: metadata.bands.length,
      width: metadata.width,
      height: metadata.height,
      bounds: metadata.bounds
    });
  } catch (error) {
    console.error('Error fetching COG metadata:', error);
    return json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
};