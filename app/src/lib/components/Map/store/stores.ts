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

// Define endpoints and paths
const TITILER_ENDPOINT = 'http://localhost:8000'; // Keep for backward compatibility
const STATIC_COGS_PATH = '/data/cogs'; // Base path to COG files
const USE_DIRECT_GEOTIFF_BY_DEFAULT = true; // Set to true to use GeoTIFF.js by default

// Helper to create the initial raster layers map
function createInitialRasterLayers(): Map<string, RasterLayer> {
  const initialMap = new Map<string, RasterLayer>();

  // Define layers based on files in static/data/cogs
  const layersToAdd: Omit<RasterLayer, 'id' | 'tileUrlTemplate'>[] = [
    // SE (Standar Error files are not needed to be displayed)
    // Pathogens - SHIG
    { name: 'SHIG 0-11 Asym Pr', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 0-11 Asym SE', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_0011_Asym_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 0-11 Comm Pr', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_0011_Comm_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 0-11 Comm SE', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_0011_Comm_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 0-11 Medi Pr', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_0011_Medi_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 0-11 Medi SE', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_0011_Medi_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Asym Pr', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_1223_Asym_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 12-23 Asym SE', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_1223_Asym_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Comm Pr', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_1223_Comm_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 12-23 Comm SE', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_1223_Comm_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Medi Pr', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_1223_Medi_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 12-23 Medi SE', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_1223_Medi_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Asym Pr', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_2459_Asym_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 24-59 Asym SE', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_2459_Asym_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Comm Pr', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_2459_Comm_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 24-59 Comm SE', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_2459_Comm_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Medi Pr', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_2459_Medi_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 24-59 Medi SE', sourceUrl: `${STATIC_COGS_PATH}/01_Pathogens/SHIG/SHIG_2459_Medi_SE.tif`, isVisible: false, opacity: 0.8 },
    // Risk Factors - Floor
    { name: 'Floor Finished Pr', sourceUrl: `${STATIC_COGS_PATH}/02_Risk_factors/Floor/Flr_Fin_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'Floor Finished SE', sourceUrl: `${STATIC_COGS_PATH}/02_Risk_factors/Floor/Flr_Fin_SE.tif`, isVisible: false, opacity: 0.8 },
    // Risk Factors - Roofs
    { name: 'Roofs Finished Pr', sourceUrl: `${STATIC_COGS_PATH}/02_Risk_factors/Roofs/Rfs_Fin_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'Roofs Finished SE', sourceUrl: `${STATIC_COGS_PATH}/02_Risk_factors/Roofs/Rfs_Fin_SE.tif`, isVisible: false, opacity: 0.8 },
    // Risk Factors - Walls
    { name: 'Walls Finished Pr', sourceUrl: `${STATIC_COGS_PATH}/02_Risk_factors/Walls/Wll_Fin_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'Walls Finished SE', sourceUrl: `${STATIC_COGS_PATH}/02_Risk_factors/Walls/Wll_Fin_SE.tif`, isVisible: false, opacity: 0.8 }
  ];

  layersToAdd.forEach((layerData) => {
    // Simply use the direct source URL for GeoTIFF.js processing
    const layer: RasterLayer = {
      id: `cog-${layerData.name.replace(/\s+/g, '-').toLowerCase()}`, // Generate ID from name
      name: layerData.name,
      sourceUrl: layerData.sourceUrl, // Use full path to static file
      tileUrlTemplate: layerData.sourceUrl, // Same URL for GeoTIFF.js
      isVisible: layerData.isVisible,
      opacity: layerData.opacity,
      isDirectGeoTIFF: USE_DIRECT_GEOTIFF_BY_DEFAULT, // Use GeoTIFF.js by default
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

  try {
    // Check if this is a direct GeoTIFF layer - if so, don't try to use TiTiler
    if (layer.isDirectGeoTIFF) {
      console.log(`Raster: Layer ${layerId} is using direct GeoTIFF processing - skipping TiTiler bounds fetch`);

      // Set dummy bounds for now - they'll be determined when the GeoTIFF is loaded
      // We're setting reasonable bounds for African continent as a placeholder
      const dummyBounds: [number, number, number, number] = [
        -20, -35, 55, 40 // west, south, east, north
      ];

      // Update the layer with dummy bounds
      rasterLayers.update((currentLayers) => {
        const layerToUpdate = currentLayers.get(layerId);
        if (layerToUpdate) {
          layerToUpdate.bounds = dummyBounds;
          layerToUpdate.isLoading = false;
        }
        return currentLayers;
      });

      console.log(`Raster: Set placeholder bounds for direct GeoTIFF layer ${layerId}`);
      return;
    }

    // Traditional TiTiler path - only used when isDirectGeoTIFF is false
    // --- Fetch bounds ---
    // Note: layer.sourceUrl is the relative path. Prepend '/data/' for TiTiler container path.
    const absolutePathInContainer = `/data/${layer.sourceUrl}`;
    const encodedAbsolutePath = encodeURIComponent(absolutePathInContainer);
    const boundsUrl = `${TITILER_ENDPOINT}/cog/bounds?url=${encodedAbsolutePath}`;

    console.log(`Raster: Fetching bounds for ${layerId}: ${boundsUrl}`);
    const response = await fetch(boundsUrl);
    console.log(`Raster: Bounds response status for ${layerId}: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Raster: Bounds fetch failed for ${layerId}: ${errorText}`);
      throw new Error(`TiTiler bounds error (${response.status}): ${errorText}`);
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

    // If this is a direct GeoTIFF layer, provide a more appropriate error message
    const improvedMessage = layer.isDirectGeoTIFF
      ? 'GeoTIFF bounds will be determined when the layer is loaded'
      : errorMessage;

    // --- Update layer state with error ---
    rasterLayers.update((currentLayers) => {
      const layerToUpdate = currentLayers.get(layerId);
      if (layerToUpdate) {
        layerToUpdate.isLoading = false;

        // Only set as error if not using direct GeoTIFF
        if (!layerToUpdate.isDirectGeoTIFF) {
          layerToUpdate.error = errorMessage;
          layerToUpdate.name = `Error: ${layerToUpdate.name}`; // Indicate error in name
          toastStore.error(`Error loading bounds for ${layer?.name || layerId}: ${errorMessage}`);
        } else {
          // For direct GeoTIFF, we'll set dummy bounds and proceed
          layerToUpdate.bounds = [-20, -35, 55, 40]; // Default bounds for Africa
          console.log(`Raster: Set placeholder bounds for direct GeoTIFF layer ${layerId} after error`);
        }
      }
      return currentLayers;
    });
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

// --- GeoTIFF.js Integration ---

/**
 * Adds a raster layer using direct GeoTIFF processing with geotiff.js
 * (no server/TiTiler required!)
 * @param url The URL to the GeoTIFF file
 */
export async function addDirectGeoTIFFLayerFromUrl(url: string): Promise<void> {
  const layerId = `geotiff-direct-${Date.now()}`; // Simple unique ID

  // Create a temporary layer entry with loading state
  const tempLayer: RasterLayer = {
    id: layerId,
    name: `Loading: ${url.substring(url.lastIndexOf('/') + 1)}...`,
    sourceUrl: url,
    tileUrlTemplate: url, // Store the original URL as we won't use TiTiler
    isVisible: true,
    opacity: 0.8,
    isLoading: true,
    error: null,
    isDirectGeoTIFF: true // Flag to indicate this uses direct GeoTIFF processing
  };

  // Add to store
  rasterLayers.update((layers) => {
    layers.set(layerId, tempLayer);
    return layers;
  });

  try {
    // Update the layer with a better name once we know it loaded
    // (We'll get bounds directly when rendering)
    const finalLayer: RasterLayer = {
      ...tempLayer,
      name: url.substring(url.lastIndexOf('/') + 1), // Use filename as name
      isLoading: false
    };

    rasterLayers.update((layers) => {
      layers.set(layerId, finalLayer);
      return layers;
    });

    toastStore.success(`Added GeoTIFF layer: ${finalLayer.name}`);
  } catch (err: any) {
    console.error('Error adding direct GeoTIFF layer:', err);
    const errorMessage = err.message || 'Failed to load GeoTIFF.';

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
