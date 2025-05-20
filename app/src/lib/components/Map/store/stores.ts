import { writable, get } from 'svelte/store';
import type { FeatureIndex, PointFeatureCollection, RasterLayer } from './types';
import { toastStore } from '$lib/stores/toast.store';
import { loadAndProcessGeoTIFF, validateBounds } from './geoTiffProcessor';

// Indices for fast filtering
export const pathogenIndex = writable<FeatureIndex>(new Map());
export const ageGroupIndex = writable<FeatureIndex>(new Map());
export const syndromeIndex = writable<FeatureIndex>(new Map());

// Filter options stores
export const pathogens = writable<Set<string>>(new Set());
export const ageGroups = writable<Set<string>>(new Set());
export const syndromes = writable<Set<string>>(new Set());

// Selected filters stores
export const selectedPathogens = writable<Set<string>>(new Set(['Campylobacter spp.']));
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

// Default rescale values for GeoTIFF processing
const DEFAULT_RESCALE: [number, number] = [0, 11];

// Helper to create the initial raster layers map
function createInitialRasterLayers(): Map<string, RasterLayer> {
  const initialMap = new Map<string, RasterLayer>();

  const baseR2url = 'https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/'
  // Define layers based on files in data/cogs
  const layersToAdd: Omit<RasterLayer, 'id'>[] = [
    // Keep existing TCI layer if needed, assuming it's local now
    // Pathogens - SHIG

    { name: 'SHIG 0-11 Asym Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 0-11 Asym SE', sourceUrl:`${baseR2url}01_Pathogens/SHIG/SHIG_0011_Asym_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 0-11 Comm Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_0011_Comm_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 0-11 Comm SE', sourceUrl:`${baseR2url}01_Pathogens/SHIG/SHIG_0011_Comm_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 0-11 Medi Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_0011_Medi_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 0-11 Medi SE', sourceUrl:`${baseR2url}01_Pathogens/SHIG/SHIG_0011_Medi_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Asym Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_1223_Asym_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 12-23 Asym SE', sourceUrl:`${baseR2url}01_Pathogens/SHIG/SHIG_1223_Asym_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Comm Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_1223_Comm_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 12-23 Comm SE', sourceUrl:`${baseR2url}01_Pathogens/SHIG/SHIG_1223_Comm_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Medi Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_1223_Medi_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 12-23 Medi SE', sourceUrl:`${baseR2url}01_Pathogens/SHIG/SHIG_1223_Medi_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Asym Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_2459_Asym_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 24-59 Asym SE', sourceUrl:`${baseR2url}01_Pathogens/SHIG/SHIG_2459_Asym_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Comm Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_2459_Comm_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 24-59 Comm SE', sourceUrl:`${baseR2url}01_Pathogens/SHIG/SHIG_2459_Comm_SE.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Medi Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_2459_Medi_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'SHIG 24-59 Medi SE', sourceUrl:`${baseR2url}01_Pathogens/SHIG/SHIG_2459_Medi_SE.tif`, isVisible: false, opacity: 0.8 },
    // Risk Factors - Floor
    { name: 'Floor Finished Pr', sourceUrl: `${baseR2url}02_Risk_factors/Floor/Flr_Fin_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'Floor Finished SE', sourceUrl:`${baseR2url}02_Risk_factors/Floor/Flr_Fin_SE.tif`, isVisible: false, opacity: 0.8 },
    // Risk Factors - Roofs
    { name: 'Roofs Finished Pr', sourceUrl: `${baseR2url}02_Risk_factors/Roofs/Rfs_Fin_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'Roofs Finished SE', sourceUrl:`${baseR2url}02_Risk_factors/Roofs/Rfs_Fin_SE.tif`, isVisible: false, opacity: 0.8 },
    // Risk Factors - Walls
    { name: 'Walls Finished Pr', sourceUrl: `${baseR2url}02_Risk_factors/Walls/Wll_Fin_Pr.tif`, isVisible: false, opacity: 0.8 },
    // { name: 'Walls Finished SE', sourceUrl:`${baseR2url}02_Risk_factors/Walls/Wll_Fin_SE.tif`, isVisible: false, opacity: 0.8 }
  ];

  layersToAdd.forEach((layerData) => {
    const layer: RasterLayer = {
      id: `cog-${layerData.sourceUrl.replace(/[\/\.]/g, '-')}`, // Generate ID from path
      name: layerData.name,
      sourceUrl: layerData.sourceUrl, // Store relative path
      isVisible: layerData.isVisible,
      opacity: layerData.opacity,
      bounds: undefined, // Bounds will be fetched dynamically
      isLoading: false,
      error: null,
      colormap: 'viridis',
      rescale: DEFAULT_RESCALE
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
 * Uses GeoTIFF.js to load and process the data directly in the browser.
 * @param url The URL of the COG file.
 */
export async function addRasterLayerFromUrl(url: string): Promise<void> {
  const layerId = `cog-url-${Date.now()}`; // Simple unique ID

  // Create a temporary layer entry with loading state
  const tempLayer: RasterLayer = {
    id: layerId,
    name: `Loading: ${url.substring(url.lastIndexOf('/') + 1)}...`,
    sourceUrl: url,
    isVisible: true,
    opacity: 0.8,
    isLoading: true,
    error: null,
    colormap: 'viridis',
    rescale: DEFAULT_RESCALE
  };

  rasterLayers.update((layers) => {
    layers.set(layerId, tempLayer);
    return layers;
  });

  try {
    console.log(`Raster: Loading GeoTIFF from URL: ${url}`);

    // Load and process the GeoTIFF
    const { dataUrl, metadata, bounds } = await loadAndProcessGeoTIFF(url, {
      rescale: DEFAULT_RESCALE
    });

    // Update the layer with processed data and metadata
    const finalLayer: RasterLayer = {
      ...tempLayer,
      name: url.substring(url.lastIndexOf('/') + 1), // Use filename as name for now
      dataUrl: dataUrl, // Store the processed image data URL
      bounds: bounds as [number, number, number, number], // Store validated bounds
      metadata: metadata, // Store the GeoTIFF metadata
      isLoading: false
    };

    rasterLayers.update((layers) => {
      layers.set(layerId, finalLayer);
      return layers;
    });
    toastStore.success(`Loaded layer: ${finalLayer.name}`);
  } catch (err: any) {
    console.error('Error adding raster layer:', err);
    const errorMessage = err.message || 'Failed to load or process GeoTIFF.';
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
 * Fetches and sets the bounds and data URL for a specific raster layer if they are missing.
 * @param layerId The ID of the layer to process.
 */
export async function fetchAndSetLayerBounds(layerId: string): Promise<void> {
  const layers = get(rasterLayers);
  const layer = layers.get(layerId);

  // Only proceed if layer exists, has no bounds, and isn't already loading
  if (!layer || (layer.bounds && layer.dataUrl) || layer.isLoading) {
    return;
  }

  // console.log(`Raster: Processing GeoTIFF for layer ${layerId}`);

  // Mark as loading
  rasterLayers.update((currentLayers) => {
    const layerToUpdate = currentLayers.get(layerId);
    if (layerToUpdate) {
      layerToUpdate.isLoading = true;
      layerToUpdate.error = null; // Clear previous errors
    }
    return currentLayers;
  });

  try {
    // Load and process the GeoTIFF
    const { dataUrl, metadata, bounds } = await loadAndProcessGeoTIFF(layer.sourceUrl, {
      rescale: layer.rescale || DEFAULT_RESCALE
    });

    // Update layer with processed data
    rasterLayers.update((currentLayers) => {
      const layerToUpdate = currentLayers.get(layerId);
      if (layerToUpdate) {
        layerToUpdate.bounds = bounds as [number, number, number, number];
        layerToUpdate.dataUrl = dataUrl;
        layerToUpdate.metadata = metadata;
        layerToUpdate.isLoading = false;
      }
      return currentLayers;
    });
    // console.log(`Raster: Successfully processed GeoTIFF for ${layerId}`);

  } catch (err: any) {
    console.error(`Error processing GeoTIFF for layer ${layerId}:`, err);
    const errorMessage = err.message || 'Failed to process GeoTIFF.';
    // Update layer state with error
    rasterLayers.update((currentLayers) => {
      const layerToUpdate = currentLayers.get(layerId);
      if (layerToUpdate) {
        layerToUpdate.isLoading = false;
        layerToUpdate.error = errorMessage;
        layerToUpdate.name = `Error: ${layerToUpdate.name}`; // Indicate error in name
      }
      return currentLayers;
    });
    toastStore.error(`Error processing GeoTIFF for ${layer?.name || layerId}: ${errorMessage}`);
  }
}

/**
 * Updates the visibility of a specific raster layer.
 * @param id The ID of the layer to update.
 * @param isVisible The new visibility state.
 */
export function updateRasterLayerVisibility(id: string, isVisible: boolean): void {
  // console.log(`Store: Updating visibility for ${id} to ${isVisible}`); // Add log
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
 * Updates the opacity of all visible raster layers.
 * @param opacity The new opacity value (0 to 1).
 */
export function updateAllRasterLayersOpacity(opacity: number): void {
  console.log(`Store: Updating opacity for all visible layers to ${opacity}`);
  rasterLayers.update((layers) => {
    // Iterate through all layers and update opacity for visible ones
    layers.forEach((layer) => {
      if (layer.isVisible) {
        // Clamp opacity between 0 and 1
        layer.opacity = Math.max(0, Math.min(1, opacity));
      }
    });
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
