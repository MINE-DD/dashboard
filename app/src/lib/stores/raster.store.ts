import { writable, get } from 'svelte/store';
import type { RasterLayer } from '$lib/types';
import { toastStore } from '$lib/stores/toast.store';
// Adjust the import path for geoTiffProcessor relative to the new store location
import { loadAndProcessGeoTIFF } from '$lib/components/Map/utils/geoTiffProcessor';

// Default rescale values for GeoTIFF processing
const DEFAULT_RESCALE: [number, number] = [0, 11];

// Helper to create the initial raster layers map
function createInitialRasterLayers(): Map<string, RasterLayer> {
  const initialMap = new Map<string, RasterLayer>();
  const baseR2url = 'https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/';

  const layersToAdd: Omit<RasterLayer, 'id' | 'bounds' | 'isLoading' | 'error' | 'metadata' | 'colormap' | 'rescale'>[] = [
    // Pathogens - SHIG
    { name: 'SHIG 0-11 Asym Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 0-11 Comm Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_0011_Comm_Pr.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 0-11 Medi Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_0011_Medi_Pr.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Asym Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_1223_Asym_Pr.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Comm Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_1223_Comm_Pr.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 12-23 Medi Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_1223_Medi_Pr.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Asym Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_2459_Asym_Pr.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Comm Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_2459_Comm_Pr.tif`, isVisible: false, opacity: 0.8 },
    { name: 'SHIG 24-59 Medi Pr', sourceUrl: `${baseR2url}01_Pathogens/SHIG/SHIG_2459_Medi_Pr.tif`, isVisible: false, opacity: 0.8 },
    // Risk Factors - Floor
    { name: 'Floor Finished Pr', sourceUrl: `${baseR2url}02_Risk_factors/Floor/Flr_Fin_Pr.tif`, isVisible: false, opacity: 0.8 },
    // Risk Factors - Roofs
    { name: 'Roofs Finished Pr', sourceUrl: `${baseR2url}02_Risk_factors/Roofs/Rfs_Fin_Pr.tif`, isVisible: false, opacity: 0.8 },
    // Risk Factors - Walls
    { name: 'Walls Finished Pr', sourceUrl: `${baseR2url}02_Risk_factors/Walls/Wll_Fin_Pr.tif`, isVisible: false, opacity: 0.8 }
  ];

  layersToAdd.forEach((layerData) => {
    const layer: RasterLayer = {
      id: `cog-${layerData.sourceUrl.replace(/[\/\.]/g, '-')}`, // Generate ID from path
      name: layerData.name,
      sourceUrl: layerData.sourceUrl,
      isVisible: layerData.isVisible,
      opacity: layerData.opacity,
      bounds: undefined,
      isLoading: false,
      error: null,
      colormap: 'viridis', // Default colormap
      rescale: DEFAULT_RESCALE // Default rescale
    };
    initialMap.set(layer.id, layer);
  });

  return initialMap;
}

// Main store for all raster layers
export const rasterLayers = writable<Map<string, RasterLayer>>(createInitialRasterLayers());

// --- Raster Layer Helper Functions ---

export async function addRasterLayerFromUrl(url: string): Promise<void> {
  const layerId = `cog-url-${Date.now()}`;
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
    const { dataUrl, metadata, bounds, rasterData, width, height } = await loadAndProcessGeoTIFF(url, {
      rescale: DEFAULT_RESCALE
    });
    const finalLayer: RasterLayer = {
      ...tempLayer,
      name: url.substring(url.lastIndexOf('/') + 1),
      dataUrl: dataUrl,
      bounds: bounds as [number, number, number, number],
      metadata: metadata,
      rasterData: rasterData,
      width: width,
      height: height,
      isLoading: false
    };
    rasterLayers.update((layers) => {
      layers.set(layerId, finalLayer);
      return layers;
    });
    toastStore.success(`Loaded layer: ${finalLayer.name}`);
  } catch (err: any) {
    const errorMessage = err.message || 'Failed to load or process GeoTIFF.';
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

export async function fetchAndSetLayerBounds(layerId: string): Promise<void> {
  const layers = get(rasterLayers);
  const layer = layers.get(layerId);

  if (!layer || (layer.bounds && layer.dataUrl) || layer.isLoading) {
    return;
  }

  rasterLayers.update((currentLayers) => {
    const layerToUpdate = currentLayers.get(layerId);
    if (layerToUpdate) {
      layerToUpdate.isLoading = true;
      layerToUpdate.error = null;
    }
    return currentLayers;
  });

  try {
    const { dataUrl, metadata, bounds, rasterData, width, height } = await loadAndProcessGeoTIFF(layer.sourceUrl, {
      rescale: layer.rescale || DEFAULT_RESCALE
    });
    console.log(`Raster store: Setting bounds for ${layerId}:`, bounds);
    rasterLayers.update((currentLayers) => {
      const layerToUpdate = currentLayers.get(layerId);
      if (layerToUpdate) {
        layerToUpdate.bounds = bounds as [number, number, number, number];
        layerToUpdate.dataUrl = dataUrl;
        layerToUpdate.metadata = metadata;
        layerToUpdate.rasterData = rasterData;
        layerToUpdate.width = width;
        layerToUpdate.height = height;
        layerToUpdate.isLoading = false;
      }
      return currentLayers;
    });
  } catch (err: any) {
    const errorMessage = err.message || 'Failed to process GeoTIFF.';
    rasterLayers.update((currentLayers) => {
      const layerToUpdate = currentLayers.get(layerId);
      if (layerToUpdate) {
        layerToUpdate.isLoading = false;
        layerToUpdate.error = errorMessage;
        layerToUpdate.name = `Error: ${layerToUpdate.name}`;
      }
      return currentLayers;
    });
    toastStore.error(`Error processing GeoTIFF for ${layer?.name || layerId}: ${errorMessage}`);
  }
}

export function updateRasterLayerVisibility(id: string, isVisible: boolean): void {
  rasterLayers.update((layers) => {
    const layer = layers.get(id);
    if (layer) {
      layer.isVisible = isVisible;
    }
    return layers;
  });
}

export function updateRasterLayerOpacity(id: string, opacity: number): void {
  rasterLayers.update((layers) => {
    const layer = layers.get(id);
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity));
    }
    return layers;
  });
}

export function updateAllRasterLayersOpacity(opacity: number): void {
  rasterLayers.update((layers) => {
    layers.forEach((layer) => {
      if (layer.isVisible) {
        layer.opacity = Math.max(0, Math.min(1, opacity));
      }
    });
    return layers;
  });
}

export function removeRasterLayer(id: string): void {
  rasterLayers.update((layers) => {
    layers.delete(id);
    return layers;
  });
}
