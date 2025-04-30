<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Map as MaplibreMap } from 'maplibre-gl';
  import type { RasterLayer } from '../store/types';
  import { addGeoTIFFToMap } from '../utils/geotiffUtils';

  // Props
  export let map: MaplibreMap;
  export let layer: RasterLayer;

  // Layer tracking
  let layerId = `geotiff-layer-${layer.id}`;
  let sourceId = `geotiff-source-${layer.id}`;
  let isInitialized = false;

  // Initialize GeoTIFF layer
  async function initializeLayer() {
    try {
      if (!map || !layer || !layer.sourceUrl) {
        console.warn('GeoTIFF layer missing required properties');
        return;
      }

      // Add the GeoTIFF layer to the map
      await addGeoTIFFToMap(map, layer);
      isInitialized = true;
      console.log(`GeoTIFF layer ${layer.id} successfully initialized`);
    } catch (error) {
      console.error('Error initializing GeoTIFF layer:', error);
    }
  }

  // Update layer when opacity changes
  $: if (map && isInitialized && layer) {
    // Try to update the layer's opacity
    try {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'raster-opacity', layer.opacity);
      }
    } catch (error) {
      console.error(`Error updating opacity for GeoTIFF layer ${layer.id}:`, error);
    }
  }

  // Update layer when visibility changes
  $: if (map && isInitialized && layer) {
    try {
      if (map.getLayer(layerId)) {
        const visibility = layer.isVisible ? 'visible' : 'none';
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    } catch (error) {
      console.error(`Error updating visibility for GeoTIFF layer ${layer.id}:`, error);
    }
  }

  // Initialize when component mounts
  onMount(() => {
    initializeLayer();
  });

  // Clean up when component is destroyed
  onDestroy(() => {
    if (map) {
      try {
        // Remove layer and source if they exist
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        console.log(`GeoTIFF layer ${layer.id} removed from map`);
      } catch (error) {
        console.error(`Error cleaning up GeoTIFF layer ${layer.id}:`, error);
      }
    }
  });
</script>

<!-- This component has no visible UI of its own -->
