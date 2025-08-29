import { writable } from 'svelte/store';
import type { Map as MaplibreMap } from 'maplibre-gl';

// Store for tracking data points visibility
export const dataPointsVisible = writable<boolean>(true);

// Function to toggle data points visibility
export function toggleDataPointsVisibility(): void {
  dataPointsVisible.update(visible => !visible);
}

// Function to update data points visibility
export function updateDataPointsVisibility(visible: boolean): void {
  dataPointsVisible.set(visible);
}

// Function to apply visibility to all point layers on the map
export function applyDataPointsVisibility(map: MaplibreMap | null, visible: boolean): void {
  if (!map || !map.isStyleLoaded()) return;

  // List of all possible point layer IDs
  const pointLayerIds = [
    'points-layer', // Dots visualization
    'pie-charts', // Single pie chart layer with dynamic sorting
    '3d-bars-layer', // 3D bars visualization
    'heatmap-layer' // Heatmap visualization
  ];

  // Apply visibility to each layer if it exists
  pointLayerIds.forEach(layerId => {
    if (map.getLayer(layerId)) {
      try {
        map.setLayoutProperty(
          layerId, 
          'visibility', 
          visible ? 'visible' : 'none'
        );
      } catch (error) {
        console.warn(`Failed to update visibility for layer ${layerId}:`, error);
      }
    }
  });
}