import type { Map as MaplibreMap } from 'maplibre-gl';
import type { RasterLayer } from '../store/types';
import { rasterLayers } from '../store';

// Flag to track if COG protocol has been initialized
let cogProtocolInitialized = false;

/**
 * Initializes the COG protocol handler for MapLibre
 * @param map Maplibre map instance
 */
function initCogProtocol(map: MaplibreMap) {
  if (!cogProtocolInitialized) {
    console.log('COG: Initializing COG protocol for MapLibre');

    if (typeof window !== 'undefined' && window.MaplibreCogProtocol) {
      try {
        window.MaplibreCogProtocol.addCogProtocol(map);
        cogProtocolInitialized = true;
        console.log('COG: Protocol initialized successfully');
      } catch (error) {
        console.error('COG: Failed to initialize protocol:', error);
      }
    } else {
      console.warn('COG: MaplibreCogProtocol not found in global scope');
    }
  }
}

/**
 * Loads and adds a GeoTIFF directly to the map using COG protocol
 * @param map MapLibre map instance
 * @param layer Raster layer configuration
 */
export async function addGeoTIFFToMap(map: MaplibreMap, layer: RasterLayer): Promise<void> {
  try {
    // Initialize COG protocol handler
    initCogProtocol(map);

    // Check if protocol was initialized successfully
    if (!cogProtocolInitialized) {
      throw new Error('COG protocol initialization failed');
    }

    console.log(`COG: Adding layer ${layer.id} using protocol`);

    // Format the COG URL properly
    const sourceUrl = layer.sourceUrl;
    let cogUrl = sourceUrl;

    // If the URL doesn't have cog:// prefix, add it
    if (!cogUrl.startsWith('cog://')) {
      cogUrl = `cog://${cogUrl}`;
    }

    console.log(`COG: URL for ${layer.id}: ${cogUrl}`);

    // Source ID and layer ID for consistent naming
    const sourceId = `cog-source-${layer.id}`;
    const layerId = `cog-layer-${layer.id}`;

    // Remove existing source/layer if they exist
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    // Add the COG source using the protocol handler
    map.addSource(sourceId, {
      type: 'raster',
      tiles: [`${cogUrl}/{z}/{x}/{y}`],
      tileSize: 256
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

    // Try to update bounds
    try {
      // Set placeholder bounds for now (will be updated if we can get them from the source)
      const placeholderBounds = [-20, -35, 55, 40]; // Approximate bounds for Africa

      // Update the store with placeholder bounds
      rasterLayers.update((currentLayers) => {
        const layerToUpdate = currentLayers.get(layer.id);
        if (layerToUpdate) {
          layerToUpdate.bounds = placeholderBounds;
        }
        return currentLayers;
      });

      console.log(`COG: Set placeholder bounds for ${layer.id}`);
    } catch (boundsError) {
      console.warn(`COG: Could not set bounds for ${layer.id}:`, boundsError);
    }

    console.log(`COG: Successfully added layer ${layer.id}`);
    return Promise.resolve();
  } catch (error) {
    console.error(`Error adding COG layer ${layer.id}:`, error);
    return Promise.reject(error);
  }
}
