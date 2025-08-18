import { get } from 'svelte/store';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { PointFeatureCollection } from '$lib/types';
import { visualizationType, type VisualizationType } from '$lib/stores/map.store';
import { isLoading, loadingMessage } from '$lib/stores/data.store';
import { filteredPointsData } from '$lib/stores/filter.store';
import { 
  mapInstance,
  pointsAddedToMap,
  isUpdatingVisualization,
  isProgrammaticSwitching,
  isAdjustingLayerOrder,
  setPointsAddedToMap
} from '$lib/stores/mapState.store';
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
import {
  convertPointsToPolygons,
  create3DBarLayer,
  remove3DBarLayer,
  get3DCameraSettings
} from '../utils/barExtrusionUtils';
import {
  createHeatmapLayer,
  removeHeatmapLayer,
  isDataSuitableForHeatmap
} from '../utils/heatmapUtils';
import { debounce } from '../utils/urlParams'; // Assuming debounce is here
import { dataPointsVisible, applyDataPointsVisibility } from '$lib/stores/dataPointsVisibility.store';

// Note: setMapInstance and setPointsAddedToMap are imported from mapState.store.ts

// Main function to update the map visualization
export async function updateMapVisualization(
  map: MaplibreMap | null,
  filteredData: PointFeatureCollection,
  vizType: VisualizationType,
  pointsAdded: boolean
): Promise<boolean> {

  // Prevent concurrent updates
  if (get(isUpdatingVisualization)) {
    console.log('Skipping visualization update: already updating');
    return false;
  }

  if (!map || !map.isStyleLoaded()) {
    console.log('Skipping visualization update: map not ready', {
      mapExists: !!map,
      mapLoaded: map?.loaded()
    });
    return false;
  }

  if (!pointsAdded) {
    console.log('Skipping visualization update: points not yet added to map', {
      pointsAdded: pointsAdded
    });
    return false;
  }

  isUpdatingVisualization.set(true);

  try {
    console.log('Updating map visualization for', vizType);

    // Check if source exists
    let sourceExists = false;
    try {
      sourceExists = !!map.getSource('points-source');
    } catch (e) {
      console.warn('Source check failed:', e);
      sourceExists = false;
    }

    if (!sourceExists) {
      console.warn('Points source does not exist, attempting to recreate...');
      // Try to add initial points again
      const success = await addInitialPointsToMap(map, filteredData, vizType);
      if (!success) {
        console.error('Failed to recreate points source');
        return false;
      }
      return true; // Successfully recreated, no need to continue
    }

    // Prepare data based on visualization type
    let dataToUpdate = filteredData;
    if (vizType === 'pie-charts') {
      dataToUpdate = getSeparatePieChartData(filteredData) as any;
    } else if (vizType === '3d-bars') {
      dataToUpdate = convertPointsToPolygons(filteredData) as any;
    }
    // Heatmap uses point data directly, no conversion needed

    // Update the source data
    const source = map.getSource('points-source') as maplibregl.GeoJSONSource;
    if (source && source.setData) {
      source.setData(dataToUpdate);
      console.log('Updated map source with filtered data');
    } else {
      console.error('Source does not have setData method');
      return false;
    }

    // Handle pie chart specific updates
    if (vizType === 'pie-charts') {
      console.log('Updating pie chart visualization...');

      // Clean up existing pie chart images
      cleanupPieChartImages(map);

      // Regenerate pie chart symbols for the new filtered data
      await generatePieChartSymbols(map, filteredData, (loading) => {
        isLoading.set(loading);
        loadingMessage.set(loading ? 'Generating pie charts...' : 'Loading...');
      });

      // Update the layer's icon expression for each pie chart layer
      const pieChartLayerIds = ['pie-charts-large', 'pie-charts-medium', 'pie-charts-small'];
      const iconExpression = generatePieChartIconExpression(filteredData) as any;

      pieChartLayerIds.forEach(layerId => {
        try {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'icon-image', iconExpression);
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
    ensurePointsOnTop(map);

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

  // For 3D bars visualization
  if (map.getLayer('3d-bars-layer')) {
    map.moveLayer('3d-bars-layer');
  }

  // For heatmap visualization
  if (map.getLayer('heatmap-layer')) {
    map.moveLayer('heatmap-layer');
  }
}

// Function to add initial points to map (called once when map is ready)
export async function addInitialPointsToMap(
  map: MaplibreMap | null,
  filteredData: PointFeatureCollection,
  vizType: VisualizationType,
  checkPointsAdded: boolean = true
): Promise<boolean> {

  console.log('Adding initial points to map...');

  if (!map) {
    console.log('No map instance available');
    return false;
  }

  if (!map.isStyleLoaded()) {
    console.log('Map not loaded yet');
    return false;
  }

  // Check if we should verify points are not already added
  if (checkPointsAdded && get(pointsAddedToMap)) {
    console.log('Points already added to map');
    return false;
  }

  if (filteredData.features.length === 0) {
    console.log('No filtered data features available');
    return false;
  }

  try {
    // Check if source already exists
    let sourceExists = false;
    try {
      sourceExists = !!map.getSource('points-source');
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
    let dataToUse = filteredData;
    if (vizType === 'pie-charts') {
      dataToUse = getSeparatePieChartData(filteredData) as any;
      console.log('📊 Using separate pie chart data:', dataToUse.features.length, 'features');
    } else if (vizType === '3d-bars') {
      dataToUse = convertPointsToPolygons(filteredData) as any;
      console.log('🏗️ Using 3D bar polygon data:', dataToUse.features.length, 'features');
    } else if (vizType === 'heatmap') {
      // Heatmap uses point data directly
      console.log('🔥 Using point data for heatmap:', dataToUse.features.length, 'features');
    }

    console.log('🎯 Adding source to map with data:', {
      features: dataToUse.features.length,
      firstFeature: dataToUse.features[0]
    });
    // Add the source
    map.addSource('points-source', {
      type: 'geojson',
      data: dataToUse
    });

    console.log('🎨 Adding layers based on visualization type:', vizType);

    // Add layers based on visualization type
    if (vizType === 'pie-charts') {
      // Generate pie chart symbols first
      await generatePieChartSymbols(map, filteredData, (loading) => {
        isLoading.set(loading);
        loadingMessage.set(loading ? 'Generating pie charts...' : 'Loading...');
      });

      // Add symbol layers for pie charts
      createPieChartLayers(map, filteredData);
    } else if (vizType === '3d-bars') {
      // Add 3D bar extrusion layer
      create3DBarLayer(map);

      // Set optimal camera angle for 3D viewing
      const cameraSettings = get3DCameraSettings();
      map.easeTo({
        pitch: cameraSettings.pitch,
        bearing: cameraSettings.bearing,
        duration: 1000
      });
    } else if (vizType === 'heatmap') {
      // Add heatmap layer
      createHeatmapLayer(map);

      // Don't change the camera position for heatmap
      // Heatmap should work at any zoom level
    } else {
      // Add circle layer for dots
      map.addLayer({
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
    
    // Apply visibility setting from store
    const visible = get(dataPointsVisible);
    applyDataPointsVisibility(map, visible);
    
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
export async function switchVisualizationType(
  map: MaplibreMap | null,
  currentType: VisualizationType,
  newType: VisualizationType,
  filteredData: PointFeatureCollection
): Promise<boolean> {

  if (!map || !map.isStyleLoaded() || currentType === newType) {
    console.warn(
      `Switch aborted or unnecessary: mapInstance exists: ${!!map}, map loaded: ${map ? map.isStyleLoaded() : 'N/A'}, currentType: ${currentType}, newType: ${newType}, types are same: ${currentType === newType}`
    );
    return false;
  }

  console.log(`Switching visualization from ${currentType} to ${newType}`);

  isUpdatingVisualization.set(true);
  isProgrammaticSwitching.set(true); // Set flag

  try {
    // Update the visualization type store
    visualizationType.set(newType);

    // Remove existing layers based on current type
    if (currentType === 'pie-charts') {
      // Remove pie chart layers
      removePieChartLayers(map);
      cleanupPieChartImages(map);
    } else if (currentType === '3d-bars') {
      // Remove 3D bar layer
      remove3DBarLayer(map);
    } else if (currentType === 'heatmap') {
      // Remove heatmap layer
      removeHeatmapLayer(map);
    } else {
      // Remove circle layer (dots)
      if (map.getLayer('points-layer')) {
        map.removeLayer('points-layer');
      }
    }

    // Add new layers
    let dataToUse = filteredData;

    if (newType === 'pie-charts') {
      dataToUse = getSeparatePieChartData(filteredData) as any;

      // Update source data
      const source = map.getSource('points-source') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData(dataToUse);
      }

      // Generate pie chart symbols
      await generatePieChartSymbols(map, filteredData, (loading) => {
        isLoading.set(loading);
        loadingMessage.set(loading ? 'Generating pie charts...' : 'Loading...');
      });

      // Add pie chart layers
      createPieChartLayers(map, filteredData);
    } else if (newType === '3d-bars') {
      dataToUse = convertPointsToPolygons(filteredData) as any;

      // Update source data
      const source = map.getSource('points-source') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData(dataToUse);
      }

      // Add 3D bar extrusion layer
      create3DBarLayer(map);

      // Set optimal camera angle for 3D viewing
      const cameraSettings = get3DCameraSettings();
      map.easeTo({
        pitch: cameraSettings.pitch,
        bearing: cameraSettings.bearing,
        duration: 1000
      });
    } else if (newType === 'heatmap') {
      // Heatmap uses point data directly

      // Update source data
      const source = map.getSource('points-source') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData(dataToUse);
      }

      // Add heatmap layer
      createHeatmapLayer(map);

      // Don't change the camera position for heatmap
      // Heatmap should work at any zoom level
    } else {
      // Update source data for dots
      const source = map.getSource('points-source') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData(dataToUse);
      }

      // Add circle layer
      map.addLayer({
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

    ensurePointsOnTop(map);
    
    // Apply visibility setting from store after switching
    const visible = get(dataPointsVisible);
    applyDataPointsVisibility(map, visible);
    
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
export async function forceVisualizationUpdate(
  map: MaplibreMap | null,
  filteredData: PointFeatureCollection,
  vizType: VisualizationType,
  pointsAdded: boolean
): Promise<boolean> {
  console.log('Forcing visualization update...');

  const result = await updateMapVisualization(map, filteredData, vizType, pointsAdded);
  return result;
}

// Create a debounced update function that will be called with parameters
let debouncedUpdateFunction: ((map: MaplibreMap, filteredData: PointFeatureCollection, vizType: VisualizationType, pointsAdded: boolean) => void) | null = null;

export async function handleMapContentChange(
  map: MaplibreMap | null,
  filteredData: PointFeatureCollection,
  vizType: VisualizationType,
  pointsAdded: boolean
): Promise<boolean> {
  console.log('handleMapContentChange called');
  
  if (!map || !filteredData) {
    return false;
  }

  // Create debounced function if not exists
  if (!debouncedUpdateFunction) {
    debouncedUpdateFunction = debounce(async (
      mapParam: MaplibreMap,
      dataParam: PointFeatureCollection,
      vizParam: VisualizationType,
      pointsParam: boolean
    ) => {
      console.log('Debounced map content change detected:', {
        mapReady: mapParam.loaded(),
        pointsAdded: pointsParam
      });

      if (!pointsParam) {
        const initSuccess = await addInitialPointsToMap(mapParam, dataParam, vizParam);
        if (initSuccess) {
          console.log('Debounced: Successfully initialized map with new content');
        } else {
          console.log('Debounced: Failed to initialize map with new content');
        }
        return;
      }

      // If points are already added, update the visualization
      const updateSuccess = await updateMapVisualization(mapParam, dataParam, vizParam, pointsParam);
      console.log('Debounced: Map content update result:', updateSuccess);
    }, 150);
  }

  // Call the debounced function with parameters
  debouncedUpdateFunction(map, filteredData, vizType, pointsAdded);
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
