import { writable, get } from 'svelte/store';
import type { FeatureIndex, PointFeatureCollection, RasterLayer } from './types';
import { toastStore } from '$lib/stores/toast.store';

// Indices for fast filtering
export const pathogenIndex = writable<FeatureIndex>(new Map());
export const ageGroupIndex = writable<FeatureIndex>(new Map());
export const syndromeIndex = writable<FeatureIndex>(new Map());

// Filter options stores
export const pathogens = writable<Set<string>>(new Set());
export const ageGroups = writable<Set<string>>(new Set());
export const syndromes = writable<Set<string>>(new Set());

// Selected filters stores
export const selectedPathogens = writable<Set<string>>(new Set());
export const selectedAgeGroups = writable<Set<string>>(new Set());
export const selectedSyndromes = writable<Set<string>>(new Set());

// GeoJSON data store
export const pointsData = writable<PointFeatureCollection>({
  type: 'FeatureCollection',
  features: []
});

// Loading and error states
export const isLoading = writable<boolean>(false);
export const dataError = writable<string | null>(null);
// Color mapping for pathogens
export const pathogenColors = writable<Map<string, string>>(new Map());

// --- Raster Layer Store ---

// Use localhost as the browser needs to access the port mapped to the host
const TITILER_ENDPOINT = 'http://localhost:8000';

// Helper to create the initial example layer
function createInitialRasterLayers(): Map<string, RasterLayer> {
  const initialMap = new Map<string, RasterLayer>();
  const exampleUrl = 'https://pub-62f092641a504c70a213fec807d20190.r2.dev/cogs/TCI.tif';
  const encodedUrl = encodeURIComponent(exampleUrl);
  // Use preview endpoint for the image URL, adding default RGB bands
  const exampleImageUrl = `${TITILER_ENDPOINT}/cog/preview.png?url=${encodedUrl}&max_size=1024&bidx=1&bidx=2&bidx=3`;
  const exampleLayer: RasterLayer = {
    id: 'example-cog-tci',
    name: 'Example COG (Sentinel TCI)',
    sourceUrl: exampleUrl,
    // tileJsonUrl: `${TITILER_ENDPOINT}/cog/tilejson.json?url=${encodedUrl}`, // Not strictly needed for preview
    tileUrlTemplate: exampleImageUrl, // Store the preview URL here
    isVisible: true,
    opacity: 0.8,
    bounds: [33.0, 15.0, 37.0, 17.0] // Hardcode known bounds for the example
  };
  initialMap.set(exampleLayer.id, exampleLayer);
  return initialMap;
}

// Main store for all raster layers
export const rasterLayers = writable<Map<string, RasterLayer>>(createInitialRasterLayers());

// --- Raster Layer Helper Functions ---

/**
 * Adds a new raster layer from a given URL.
 * Fetches metadata from TiTiler's tilejson endpoint if possible.
 * @param url The URL of the COG file.
 */
export async function addRasterLayerFromUrl(url: string): Promise<void> {
  const layerId = `cog-url-${Date.now()}`; // Simple unique ID
  const encodedUrl = encodeURIComponent(url);
  const boundsUrl = `${TITILER_ENDPOINT}/cog/bounds?url=${encodedUrl}`;
  // Use preview, adding default RGB bands
  const imageUrl = `${TITILER_ENDPOINT}/cog/preview.png?url=${encodedUrl}&max_size=1024&bidx=1&bidx=2&bidx=3`;

  // Create a temporary layer entry with loading state
  const tempLayer: RasterLayer = {
    id: layerId,
    name: `Loading: ${url.substring(url.lastIndexOf('/') + 1)}...`,
    sourceUrl: url,
    // tileJsonUrl: tileJsonUrl, // Not fetching tilejson anymore
    tileUrlTemplate: imageUrl, // Store preview URL
    isVisible: true,
    opacity: 0.8,
    isLoading: true,
    error: null
  };

  rasterLayers.update((layers) => {
    layers.set(layerId, tempLayer);
    return layers;
  });

  try {
    // Fetch bounds from TiTiler
    console.log(`Raster: Fetching bounds: ${boundsUrl}`);
    const response = await fetch(boundsUrl);
    console.log(`Raster: Bounds response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Raster: Bounds fetch failed: ${errorText}`);
      throw new Error(`TiTiler bounds error (${response.status}): ${errorText}`);
    }

    const boundsJson = await response.json();
    // Log BEFORE validation
    console.log('Raster: Received bounds JSON from TiTiler:', JSON.stringify(boundsJson));

    // Validate bounds - use 'let' to allow modification
    let receivedBounds = boundsJson?.bounds;
    if (
      !receivedBounds ||
      receivedBounds.length !== 4 ||
      receivedBounds.some((coord: number | null) => typeof coord !== 'number' || !isFinite(coord)) ||
      receivedBounds[0] < -180 || receivedBounds[0] > 180 || // west
      receivedBounds[2] < -180 || receivedBounds[2] > 180 || // east
      receivedBounds[1] < -90 || receivedBounds[1] > 90 || // south
      receivedBounds[3] < -90 || receivedBounds[3] > 90     // north
    ) {
      console.error('Raster: Invalid or out-of-range bounds received from TiTiler:', receivedBounds);
      throw new Error('Invalid bounds received from TiTiler');
    }

    // Check for problematic global bounds
    const isGlobalBounds =
      receivedBounds[0] === -180 &&
      receivedBounds[1] === -90 &&
      receivedBounds[2] === 180 &&
      receivedBounds[3] === 90;

    if (isGlobalBounds) {
      console.warn('Raster: Received global bounds, cannot display accurately as image layer.');
      console.warn('Raster: Received global bounds, attempting to use slightly smaller bounds.');
      // Replace global bounds with slightly smaller ones as a workaround
      receivedBounds = [-179.9, -89.9, 179.9, 89.9];
      // No longer throwing an error here, proceed with modified bounds
    }

    // Update the layer with fetched bounds and final name
    const finalLayer: RasterLayer = {
      ...tempLayer,
      name: url.substring(url.lastIndexOf('/') + 1), // Use filename as name for now
      bounds: receivedBounds, // Store validated or modified bounds
      isLoading: false
    };

    rasterLayers.update((layers) => {
      layers.set(layerId, finalLayer);
      return layers;
    });
    toastStore.success(`Loaded layer: ${finalLayer.name}`);
  } catch (err: any) {
    console.error('Error adding raster layer:', err);
    const errorMessage = err.message || 'Failed to load COG metadata from TiTiler.';
    // Update layer state with error
    rasterLayers.update((layers) => {
      const layerWithError = layers.get(layerId);
      if (layerWithError) {
        layerWithError.isLoading = false;
        layerWithError.error = errorMessage;
        layerWithError.name = `Error loading: ${url.substring(url.lastIndexOf('/') + 1)}`;
      }
      return layers;
    });
    toastStore.error(errorMessage);
  }
}

/**
 * Updates the visibility of a specific raster layer.
 * @param id The ID of the layer to update.
 * @param isVisible The new visibility state.
 */
export function updateRasterLayerVisibility(id: string, isVisible: boolean): void {
  console.log(`Store: Updating visibility for ${id} to ${isVisible}`); // Add log
  rasterLayers.update((layers) => {
    const layer = layers.get(id);
    if (layer) {
      layer.isVisible = isVisible;
    }
    return layers;
  });
}

/**
 * Updates the opacity of a specific raster layer.
 * @param id The ID of the layer to update.
 * @param opacity The new opacity value (0 to 1).
 */
export function updateRasterLayerOpacity(id: string, opacity: number): void {
  console.log(`Store: Updating opacity for ${id} to ${opacity}`); // Add log
  rasterLayers.update((layers) => {
    const layer = layers.get(id);
    if (layer) {
      // Clamp opacity between 0 and 1
      layer.opacity = Math.max(0, Math.min(1, opacity));
    }
    return layers;
  });
}

/**
 * Removes a raster layer from the store.
 * @param id The ID of the layer to remove.
 */
export function removeRasterLayer(id: string): void {
  rasterLayers.update((layers) => {
    layers.delete(id);
    return layers;
  });
  // Optional: Add toast notification for removal
  // toast.push({ message: `Removed layer`, type: 'info' });
}
