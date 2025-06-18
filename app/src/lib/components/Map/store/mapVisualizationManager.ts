import { writable, derived, get } from 'svelte/store';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { PointFeatureCollection } from '$lib/types';
import { visualizationType, type VisualizationType } from '$lib/stores/map.store';
import { isLoading, loadingMessage } from '$lib/stores/data.store';
import { filteredPointsData } from '$lib/stores/filter.store';
import {
  createPieChartImage,
  cleanupPieChartImages,
  generatePieChartSymbols,
  generatePieChartIconExpression,
  getSeparatePieChartData,
  createPieChartLayers,
  removePieChartLayers,
  getDesignColors,
  getDefaultColor
} from '../utils/pieChartUtils';
import { debounce } from '../utils/urlParams'; // Assuming debounce is here

// Store to track the current map instance
export const mapInstance = writable<MaplibreMap | null>(null);

// Store to track if points have been added to the map
export const pointsAddedToMap = writable<boolean>(false);

// Store to track if we're currently updating the visualization
export const isUpdatingVisualization = writable<boolean>(false);

// Store to track if a programmatic switch is in progress
export const isProgrammaticSwitching = writable<boolean>(false);

// Auto-update store (can be used by components if needed, but not for automatic map updates from here)
export const autoUpdateEnabled = writable<boolean>(true);

// Function to set the map instance
export function setMapInstance(map: MaplibreMap | null) {
  mapInstance.set(map);
}

// Function to mark points as added
export function setPointsAddedToMap(added: boolean) {
  pointsAddedToMap.set(added);
}

// Main function to update the map visualization
export async function updateMapVisualization(): Promise<boolean> {
  const $isUpdating = get(isUpdatingVisualization);
  const $map = get(mapInstance);
  const $filteredData = get(filteredPointsData);
  const $vizType = get(visualizationType);
  const $pointsAdded = get(pointsAddedToMap);

  // Prevent concurrent updates
  if ($isUpdating) {
    console.log('Skipping visualization update: already updating');
    return false;
  }

  if (!$map || !$map.loaded()) {
    console.log('Skipping visualization update: map not ready', {
      mapExists: !!$map,
      mapLoaded: $map?.loaded()
    });
    return false;
  }

  if (!$pointsAdded) {
    console.log('Skipping visualization update: points not yet added to map', {
      pointsAdded: $pointsAdded
    });
    return false;
  }

  isUpdatingVisualization.set(true);

  try {
    console.log('Updating map visualization for', $vizType);

    // Check if source exists
    let sourceExists = false;
    try {
      sourceExists = !!$map.getSource('points-source');
    } catch (e) {
      console.warn('Source check failed:', e);
      sourceExists = false;
    }

    if (!sourceExists) {
      console.warn('Points source does not exist, attempting to recreate...');
      // Try to add initial points again
      const success = await addInitialPointsToMap();
      if (!success) {
        console.error('Failed to recreate points source');
        return false;
      }
      return true; // Successfully recreated, no need to continue
    }

    // Prepare data based on visualization type
    let dataToUpdate = $filteredData;
    if ($vizType === 'pie-charts') {
      dataToUpdate = getSeparatePieChartData($filteredData) as any;
    }

    // Update the source data
    const source = $map.getSource('points-source') as maplibregl.GeoJSONSource;
    if (source && source.setData) {
      source.setData(dataToUpdate);
      console.log('Updated map source with filtered data');
    } else {
      console.error('Source does not have setData method');
      return false;
    }

    // Handle pie chart specific updates
    if ($vizType === 'pie-charts') {
      console.log('Updating pie chart visualization...');

      // Clean up existing pie chart images
      cleanupPieChartImages($map);

      // Regenerate pie chart symbols for the new filtered data
      await generatePieChartSymbols($map, $filteredData, (loading) => {
        isLoading.set(loading);
        loadingMessage.set(loading ? 'Generating pie charts...' : 'Loading...');
      });

      // Update the layer's icon expression for each pie chart layer
      const pieChartLayerIds = ['pie-charts-large', 'pie-charts-medium', 'pie-charts-small'];
      const iconExpression = generatePieChartIconExpression($filteredData) as any;

      pieChartLayerIds.forEach(layerId => {
        try {
          if ($map.getLayer(layerId)) {
            $map.setLayoutProperty(layerId, 'icon-image', iconExpression);
          }
        } catch (e) {
          console.warn(`Failed to update icon expression for layer ${layerId}:`, e);
        }
      });

      console.log('Pie chart visualization updated');
    } else {
      console.log('Circle visualization updated');
    }

    // Ensure points are on top
    ensurePointsOnTop($map);

    return true;

  } catch (error) {
    console.error('Error updating map visualization:', error);
    return false;
  } finally {
    isUpdatingVisualization.set(false);
  }
}

// Helper function to ensure points are always on top
function ensurePointsOnTop(map: MaplibreMap) {
  if (!map) return;

  // For dots visualization
  if (map.getLayer('points-layer')) {
    map.moveLayer('points-layer');
  }

  // For pie charts visualization
  const pieChartLayerIds = ['pie-charts-large', 'pie-charts-medium', 'pie-charts-small'];
  pieChartLayerIds.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId);
    }
  });
}

// Function to add initial points to map (called once when map is ready)
export async function addInitialPointsToMap(): Promise<boolean> {
  const $map = get(mapInstance);
  const $filteredData = get(filteredPointsData);
  const $vizType = get(visualizationType);
  const $pointsAdded = get(pointsAddedToMap);

  console.log('Adding initial points to map...');

  if (!$map) {
    console.log('No map instance available');
    return false;
  }

  if (!$map.loaded()) {
    console.log('Map not loaded yet');
    return false;
  }

  if ($pointsAdded) {
    console.log('Points already added to map');
    return false;
  }

  if ($filteredData.features.length === 0) {
    console.log('No filtered data features available');
    return false;
  }

  try {
    // Check if source already exists
    let sourceExists = false;
    try {
      sourceExists = !!$map.getSource('points-source');
    } catch (e) {
      sourceExists = false;
    }

    if (sourceExists) {
      console.log('Points source already exists, fixing state consistency');
      // If source exists but pointsAdded is false, it means we're in an inconsistent state
      // Fix this by setting pointsAdded to true
      setPointsAddedToMap(true);
      return true; // Return true since the source is already there
    }

    // Prepare data based on visualization type
    let dataToUse = $filteredData;
    if ($vizType === 'pie-charts') {
      dataToUse = getSeparatePieChartData($filteredData) as any;
      console.log('📊 Using separate pie chart data:', dataToUse.features.length, 'features');
    }

    console.log('🎯 Adding source to map...');
    // Add the source
    $map.addSource('points-source', {
      type: 'geojson',
      data: dataToUse
    });

    console.log('🎨 Adding layers based on visualization type:', $vizType);

    // Add layers based on visualization type
    if ($vizType === 'pie-charts') {
      // Generate pie chart symbols first
      await generatePieChartSymbols($map, $filteredData, (loading) => {
        isLoading.set(loading);
        loadingMessage.set(loading ? 'Generating pie charts...' : 'Loading...');
      });

      // Add symbol layers for pie charts
      createPieChartLayers($map, $filteredData);
    } else {
      // Add circle layer for dots
      $map.addLayer({
        id: 'points-layer',
        type: 'circle',
        source: 'points-source',
        paint: {
          'circle-radius': 7,
          'circle-color': generateDesignColorExpression() as any,
          'circle-opacity': 0.9,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });
    }

    setPointsAddedToMap(true);
    console.log('✅ Successfully added initial points to map');
    return true;

  } catch (error) {
    console.error('❌ Error adding initial points to map:', error);
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : { message: String(error) };

    console.error('Error details:', {
      ...errorDetails,
      mapExists: !!$map,
      mapLoaded: $map?.loaded(),
      featuresCount: $filteredData?.features?.length
    });
    return false;
  }
}

// Function to switch visualization type
export async function switchVisualizationType(newType: VisualizationType): Promise<boolean> {
  const $map = get(mapInstance);
  const $currentType = get(visualizationType);

  if (!$map || !$map.loaded() || $currentType === newType) {
    console.warn(
      `Switch aborted or unnecessary: mapInstance exists: ${!!$map}, map loaded: ${$map ? $map.loaded() : 'N/A'}, currentType: ${$currentType}, newType: ${newType}, types are same: ${$currentType === newType}`
    );
    return false;
  }

  console.log(`Switching visualization from ${$currentType} to ${newType}`);

  isUpdatingVisualization.set(true);
  isProgrammaticSwitching.set(true); // Set flag

  try {
    // Update the visualization type store
    visualizationType.set(newType);

    // Remove existing layers
    if (newType === 'pie-charts') {
      // Switching to pie charts - remove circle layer
      if ($map.getLayer('points-layer')) {
        $map.removeLayer('points-layer');
      }
    } else {
      // Switching to dots - remove pie chart layers
      removePieChartLayers($map);
      cleanupPieChartImages($map);
    }

    // Add new layers
    const $filteredData = get(filteredPointsData);
    let dataToUse = $filteredData;

    if (newType === 'pie-charts') {
      dataToUse = getSeparatePieChartData($filteredData) as any;

      // Update source data
      const source = $map.getSource('points-source') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData(dataToUse);
      }

      // Generate pie chart symbols
      await generatePieChartSymbols($map, $filteredData, (loading) => {
        isLoading.set(loading);
        loadingMessage.set(loading ? 'Generating pie charts...' : 'Loading...');
      });

      // Add pie chart layers
      createPieChartLayers($map, $filteredData);
    } else {
      // Update source data
      const source = $map.getSource('points-source') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData(dataToUse);
      }

      // Add circle layer
      $map.addLayer({
        id: 'points-layer',
        type: 'circle',
        source: 'points-source',
        paint: {
          'circle-radius': 7,
          'circle-color': generateDesignColorExpression() as any,
          'circle-opacity': 0.9,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });
    }

    ensurePointsOnTop($map);
    console.log(`Successfully switched to ${newType} visualization`);
    return true;

  } catch (error) {
    console.error('Error switching visualization type:', error);
    return false;
  } finally {
    isProgrammaticSwitching.set(false); // Clear flag
    isUpdatingVisualization.set(false);
  }
}

// Function to force a visualization update (bypassing some checks)
export async function forceVisualizationUpdate(): Promise<boolean> {
  console.log('Forcing visualization update...');

  // Temporarily disable auto-updates to prevent conflicts
  const wasAutoEnabled = get(autoUpdateEnabled);
  autoUpdateEnabled.set(false);

  try {
    const result = await updateMapVisualization();
    // visualizationUpdateTrigger was removed, direct update is preferred
    return result;
  } finally {
    // Re-enable auto-updates
    autoUpdateEnabled.set(wasAutoEnabled);
  }
}

// Centralized function to handle any map content change (filters, visualization type, etc.)
// This function will now incorporate debouncing.
const debouncedUpdate = debounce(async () => {
  const $map = get(mapInstance);
  const $pointsAdded = get(pointsAddedToMap);

  console.log('Debounced map content change detected:', {
    mapReady: !!$map && $map.loaded(),
    pointsAdded: $pointsAdded
  });

  if (!$pointsAdded) {
    const initSuccess = await addInitialPointsToMap();
    if (initSuccess) {
      console.log('Debounced: Successfully initialized map with new content');
    } else {
      console.log('Debounced: Failed to initialize map with new content');
    }
    return; // Return after attempting init
  }

  // If points are already added, update the visualization
  const updateSuccess = await updateMapVisualization();
  console.log('Debounced: Map content update result:', updateSuccess);
}, 150); // 150ms debounce time, adjust as needed

export async function handleMapContentChange(): Promise<boolean> {
  console.log('handleMapContentChange called, triggering debounced update.');
  debouncedUpdate();
  // Since debouncedUpdate is async and we're not awaiting it here,
  // this function's boolean return type might not be immediately meaningful
  // for the success of the debounced operation.
  // Consider if this function still needs to return a Promise<boolean>
  // or if its role is purely to trigger the debounced action.
  // For now, returning true to indicate the trigger was initiated.
  return true;
}

// Helper function to generate design color expression
function generateDesignColorExpression() {
  const designColors = getDesignColors();
  const matchExpression: any[] = ['match', ['get', 'design']];

  Object.entries(designColors).forEach(([design, color]) => {
    matchExpression.push(design);
    matchExpression.push(color);
  });

  matchExpression.push(getDefaultColor());
  return matchExpression;
}
