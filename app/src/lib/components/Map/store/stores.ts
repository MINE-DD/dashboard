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

// Use the new SvelteKit API endpoints for serverless COG processing
const TITILER_ENDPOINT = '/api/cog';

// Helper to create the initial raster layers map
function createInitialRasterLayers(): Map<string, RasterLayer> {
  const initialMap = new Map<string, RasterLayer>();

  // Define layers based on files in the static folder
  const layersToAdd: Omit<RasterLayer, 'id' | 'tileUrlTemplate'>[] = [
    // Pathogens - SHIG
    { name: 'SHIG 0-11 Asym Pr', sourceUrl: 'SHIG_0011_Asym_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 0-11 Asym SE', sourceUrl: 'SHIG_0011_Asym_SE.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 0-11 Comm Pr', sourceUrl: 'SHIG_0011_Comm_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 0-11 Comm SE', sourceUrl: 'SHIG_0011_Comm_SE.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 0-11 Medi Pr', sourceUrl: 'SHIG_0011_Medi_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 0-11 Medi SE', sourceUrl: 'SHIG_0011_Medi_SE.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Asym Pr', sourceUrl: 'SHIG_1223_Asym_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Asym SE', sourceUrl: 'SHIG_1223_Asym_SE.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Comm Pr', sourceUrl: 'SHIG_1223_Comm_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Comm SE', sourceUrl: 'SHIG_1223_Comm_SE.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Medi Pr', sourceUrl: 'SHIG_1223_Medi_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Medi SE', sourceUrl: 'SHIG_1223_Medi_SE.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Asym Pr', sourceUrl: 'SHIG_2459_Asym_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Asym SE', sourceUrl: 'SHIG_2459_Asym_SE.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Comm Pr', sourceUrl: 'SHIG_2459_Comm_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Comm SE', sourceUrl: 'SHIG_2459_Comm_SE.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Medi Pr', sourceUrl: 'SHIG_2459_Medi_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Medi SE', sourceUrl: 'SHIG_2459_Medi_SE.tif', isVisible: false, opacity: 0.8 },
    // Risk Factors
    { name: 'Floor Finished Pr', sourceUrl: 'Flr_Fin_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'Floor Finished SE', sourceUrl: 'Flr_Fin_SE.tif', isVisible: false, opacity: 0.8 },
    { name: 'Roofs Finished Pr', sourceUrl: 'Rfs_Fin_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'Roofs Finished SE', sourceUrl: 'Rfs_Fin_SE.tif', isVisible: false, opacity: 0.8 },
    { name: 'Walls Finished Pr', sourceUrl: 'Wll_Fin_Pr.tif', isVisible: false, opacity: 0.8 },
    { name: 'Walls Finished SE', sourceUrl: 'Wll_Fin_SE.tif', isVisible: false, opacity: 0.8 }
  ];

  layersToAdd.forEach((layerData) => {
    // For our serverless approach, we need to use the file path relative to the static folder
    const relativePath = layerData.sourceUrl;
    const encodedPath = encodeURIComponent(relativePath);

    // Using our new unified COG endpoint for previews
    const imageUrl = `${TITILER_ENDPOINT}?operation=preview&file=${encodedPath}&max_size=1024&bidx=1&colormap_name=viridis&rescale=0,11`;

    const layer: RasterLayer = {
      id: `cog-${layerData.sourceUrl.replace(/[\/\.]/g, '-')}`, // Generate ID from path
      name: layerData.name,
      sourceUrl: layerData.sourceUrl, // Store relative path
      tileUrlTemplate: imageUrl, // Store the preview URL for now
      isVisible: layerData.isVisible,
      opacity: layerData.opacity,
      bounds: undefined, // Bounds will be fetched dynamically
      isLoading: false,
      error: null
    };
    initialMap.set(layer.id, layer);
  });

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
 * Fetches and sets the bounds for a specific raster layer if they are missing.
 * @param layerId The ID of the layer to fetch bounds for.
 */
export async function fetchAndSetLayerBounds(layerId: string): Promise<void> {
  const layers = get(rasterLayers);
  const layer = layers.get(layerId);

  // Only proceed if layer exists, has no bounds, and isn't already loading
  if (!layer || layer.bounds || layer.isLoading) {
    // console.log(`Raster: Skipping bounds fetch for ${layerId} (exists, has bounds, or loading)`);
    return;
  }

  console.log(`Raster: Triggering bounds fetch for layer ${layerId}`);

  // --- Mark as loading ---
  rasterLayers.update((currentLayers) => {
    const layerToUpdate = currentLayers.get(layerId);
    if (layerToUpdate) {
      layerToUpdate.isLoading = true;
      layerToUpdate.error = null; // Clear previous errors
    }
    return currentLayers;
  });

  // --- Fetch bounds ---
  const boundsUrl = `${TITILER_ENDPOINT}?operation=bounds&file=${encodeURIComponent(layer.sourceUrl)}`;

  try {
    console.log(`Raster: Fetching bounds for ${layerId}: ${boundsUrl}`);
    const response = await fetch(boundsUrl);
    console.log(`Raster: Bounds response status for ${layerId}: ${response.status}`);

    // Get content type to check if we're getting HTML instead of JSON
    const contentType = response.headers.get('content-type') || '';
    console.log(`Raster: Response content type: ${contentType}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Raster: Bounds fetch failed for ${layerId}: ${errorText}`);
      throw new Error(`TiTiler bounds error (${response.status}): ${errorText}`);
    }

    // Check for HTML response (which would cause JSON parsing to fail)
    if (contentType.includes('text/html')) {
      const htmlText = await response.text();
      console.error(`Raster: Received HTML instead of JSON for ${layerId}`, htmlText.substring(0, 100));
      throw new Error('Received HTML instead of JSON from TiTiler endpoint');
    }

    const boundsJson = await response.json();
    console.log(`Raster: Received bounds JSON for ${layerId}:`, JSON.stringify(boundsJson));

    // Validate bounds
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
      console.error(`Raster: Invalid or out-of-range bounds received for ${layerId}:`, receivedBounds);
      throw new Error('Invalid bounds received from TiTiler');
    }

    // Check for problematic global bounds (adjust if needed)
    const isGlobalBounds =
      receivedBounds[0] === -180 &&
      receivedBounds[1] === -90 &&
      receivedBounds[2] === 180 &&
      receivedBounds[3] === 90;

    if (isGlobalBounds) {
      console.warn(`Raster: Received global bounds for ${layerId}, using slightly smaller bounds.`);
      receivedBounds = [-179.9, -89.9, 179.9, 89.9];
    }

    // --- Update layer with bounds ---
    rasterLayers.update((currentLayers) => {
      const layerToUpdate = currentLayers.get(layerId);
      if (layerToUpdate) {
        layerToUpdate.bounds = receivedBounds;
        layerToUpdate.isLoading = false;
      }
      return currentLayers;
    });
    console.log(`Raster: Successfully fetched and set bounds for ${layerId}`);

  } catch (err: any) {
    console.error(`Error fetching bounds for layer ${layerId}:`, err);
    const errorMessage = err.message || 'Failed to load COG bounds from TiTiler.';
    // --- Update layer state with error ---
    rasterLayers.update((currentLayers) => {
      const layerToUpdate = currentLayers.get(layerId);
      if (layerToUpdate) {
        layerToUpdate.isLoading = false;
        layerToUpdate.error = errorMessage;
        layerToUpdate.name = `Error: ${layerToUpdate.name}`; // Indicate error in name
      }
      return currentLayers;
    });
    toastStore.error(`Error loading bounds for ${layer?.name || layerId}: ${errorMessage}`);
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
