/**
 * A simplified implementation of the COG protocol handler for MapLibre based on the maplibre-cog-protocol library
 * Adapted from https://github.com/geomatico/maplibre-cog-protocol
 */

import type { Map as MaplibreMap, RequestParameters, RequestTransformFunction } from 'maplibre-gl';

/**
 * Adds the COG protocol to the map
 * @param map The MapLibre map instance
 */
export function addCogProtocol(map: MaplibreMap): void {
  // Register the protocol handler if it doesn't exist yet
  if (!map.hasProtocol('cog')) {
    map.addProtocol('cog', cogProtocolHandler);
    console.log('COG protocol handler registered with MapLibre');
  }
}

/**
 * The COG protocol handler function
 * This simplified version passes the URL through to a TiTiler endpoint
 */
function cogProtocolHandler(params: RequestParameters, callback: (error: Error | null, data?: {data: ArrayBuffer; cacheControl?: string; expires?: string} | {data: ArrayBuffer}[]) => void): void {
  const url = params.url;
  
  if (!url) {
    callback(new Error('No URL provided for COG protocol'));
    return;
  }
  
  console.log('COG protocol handling URL:', url);
  
  // Extract the COG URL (remove the cog:// prefix)
  const cogUrl = url.replace(/^cog:\/\//, '');
  
  // Convert this to a TiTiler request
  // We're using the local TiTiler instance by default
  const titilerEndpoint = 'http://localhost:8000';
  
  // Build the TiTiler URL for this tile request
  const [z, x, y] = params.url.match(/\/(\d+)\/(\d+)\/(\d+)\.webp$/)?.[1-3] || [];
  
  let titilerUrl: string;
  
  if (z && x && y) {
    // This is a tile request
    titilerUrl = `${titilerEndpoint}/cog/tiles/${z}/${x}/${y}.webp?url=${encodeURIComponent(cogUrl)}`;
  } else {
    // This is a metadata request
    titilerUrl = `${titilerEndpoint}/cog/info?url=${encodeURIComponent(cogUrl)}`;
  }
  
  console.log('COG protocol forwarding to TiTiler:', titilerUrl);
  
  // Make the request to TiTiler
  fetch(titilerUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`TiTiler request failed: ${response.status} ${response.statusText}`);
      }
      return response.arrayBuffer();
    })
    .then(data => {
      callback(null, { data });
    })
    .catch(error => {
      console.error('COG protocol error:', error);
      callback(error);
    });
}