import { writable, derived, get } from 'svelte/store';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { filteredPointsData, selectedPathogens, selectedAgeGroups, selectedSyndromes } from './filter.store';
import { visualizationType } from './map.store';

// Core map instance
export const mapInstance = writable<MaplibreMap | null>(null);

// Track map readiness explicitly
export const mapIsReady = writable<boolean>(false);

// Initialization state machine
export type InitializationState = 'idle' | 'initializing' | 'ready' | 'error';
export const initializationState = writable<InitializationState>('idle');

// Track if points have been added to the map
export const pointsAddedToMap = writable<boolean>(false);

// Track if we're updating visualization
export const isUpdatingVisualization = writable<boolean>(false);

// Track programmatic switching
export const isProgrammaticSwitching = writable<boolean>(false);

// Track layer order adjustment
export const isAdjustingLayerOrder = writable<boolean>(false);

// Error state
export const mapError = writable<string | null>(null);

// Derived store: Is map loaded and ready?
export const mapLoaded = derived(
  [mapInstance, mapIsReady],
  ([$map, $ready]) => {
    return !!$map && $ready;
  }
);

// Derived store: Is map ready for operations?
export const mapReady = derived(
  [mapInstance, mapLoaded, initializationState],
  ([$map, $loaded, $state]) => {
    return !!$map && $loaded && $state === 'ready';
  }
);

// Derived store: Do we have data to display?
export const hasData = derived(
  filteredPointsData,
  ($data) => $data?.features?.length > 0
);

// Derived store: Can we initialize the map?
export const canInitializeMap = derived(
  [mapLoaded, hasData, pointsAddedToMap, initializationState],
  ([$loaded, $hasData, $pointsAdded, $state]) => {
    return $loaded && $hasData && !$pointsAdded && $state !== 'initializing';
  }
);

// Derived store: Should we update the visualization?
export const shouldUpdateVisualization = derived(
  [mapReady, hasData, pointsAddedToMap, isUpdatingVisualization],
  ([$ready, $hasData, $pointsAdded, $updating]) => {
    return $ready && $hasData && $pointsAdded && !$updating;
  }
);

// Derived store: Is any programmatic operation happening?
export const isProgrammaticOperation = derived(
  [isProgrammaticSwitching, isAdjustingLayerOrder, isUpdatingVisualization],
  ([$switching, $adjusting, $updating]) => {
    return $switching || $adjusting || $updating;
  }
);

// Import visualization management functions dynamically
let mapVisualizationManager: any = null;

async function getMapVisualizationManager() {
  if (!mapVisualizationManager) {
    mapVisualizationManager = await import('../components/Map/store/mapVisualizationManager');
  }
  return mapVisualizationManager;
}

// Action functions to update state
export function setMapInstance(map: MaplibreMap | null) {
  mapInstance.set(map);
  if (!map) {
    initializationState.set('idle');
    pointsAddedToMap.set(false);
    mapIsReady.set(false);
  }
}

function setMapReady(ready: boolean) {
  console.log('Setting map ready:', ready);
  mapIsReady.set(ready);
  
  // Check if we should initialize
  if (ready) {
    checkAndInitialize();
  }
}

export function setInitializationState(state: InitializationState) {
  initializationState.set(state);
}

export function setPointsAddedToMap(added: boolean) {
  pointsAddedToMap.set(added);
}

export function setMapError(error: string | null) {
  mapError.set(error);
  if (error) {
    initializationState.set('error');
  }
}

// Export setMapReady for use in components
export { setMapReady };

export function resetMapState() {
  mapInstance.set(null);
  mapIsReady.set(false);
  initializationState.set('idle');
  pointsAddedToMap.set(false);
  isUpdatingVisualization.set(false);
  isProgrammaticSwitching.set(false);
  isAdjustingLayerOrder.set(false);
  mapError.set(null);
}

// Centralized initialization check
export async function checkAndInitialize() {
  const map = get(mapInstance);
  const ready = get(mapIsReady);
  const hasData = get(filteredPointsData)?.features?.length > 0;
  const pointsAdded = get(pointsAddedToMap);
  const state = get(initializationState);
  const vizType = get(visualizationType);
  
  console.log('Checking initialization conditions:', {
    hasMap: !!map,
    mapReady: ready,
    hasData,
    pointsAdded,
    state,
    vizType
  });
  
  // Check if all conditions are met
  if (map && ready && hasData && !pointsAdded && state === 'idle') {
    console.log('All conditions met, initializing visualization...');
    
    const { addInitialPointsToMap } = await getMapVisualizationManager();
    initializationState.set('initializing');
    const data = get(filteredPointsData);
    const type = get(visualizationType);
    const success = await addInitialPointsToMap(map, data, type, true);
    if (success) {
      initializationState.set('ready');
      pointsAddedToMap.set(true);
    } else {
      initializationState.set('error');
    }
  }
}

// Handle filter changes
export async function handleFilterChange() {
  const map = get(mapInstance);
  const ready = get(mapIsReady);
  const pointsAdded = get(pointsAddedToMap);
  const state = get(initializationState);
  const hasData = get(filteredPointsData)?.features?.length > 0;
  const vizType = get(visualizationType);
  const updating = get(isUpdatingVisualization);
  
  console.log('Filter change detected:', {
    hasMap: !!map,
    mapReady: ready,
    pointsAdded,
    state,
    hasData,
    vizType,
    updating
  });
  
  // If not initialized yet, just wait for initialization
  if (!pointsAdded || state !== 'ready' || !map || !ready) {
    console.log('Not ready for filter update, waiting for initialization');
    return;
  }
  
  // If already updating, skip
  if (updating) {
    console.log('Already updating, skipping filter change');
    return;
  }
  
  // Update the visualization with new filtered data
  console.log('Updating visualization with filtered data...');
  
  try {
    const { updateMapVisualization } = await getMapVisualizationManager();
    const data = get(filteredPointsData);
    const success = await updateMapVisualization(map, data, vizType, pointsAdded);
    
    if (success) {
      console.log('Filter update successful');
    } else {
      console.error('Filter update failed');
    }
  } catch (error) {
    console.error('Error updating filters:', error);
  }
}

// Handle visualization type changes
export async function handleVisualizationTypeChange(oldType: string, newType: string) {
  const map = get(mapInstance);
  const ready = get(mapIsReady);
  const pointsAdded = get(pointsAddedToMap);
  const state = get(initializationState);
  const updating = get(isUpdatingVisualization);
  
  console.log('Visualization type change detected:', {
    oldType,
    newType,
    hasMap: !!map,
    mapReady: ready,
    pointsAdded,
    state,
    updating
  });
  
  // If not initialized yet or already updating, skip
  if (!pointsAdded || state !== 'ready' || !map || !ready || updating) {
    console.log('Not ready for visualization type change');
    return;
  }
  
  console.log(`Switching visualization from ${oldType} to ${newType}`);
  
  try {
    const { switchVisualizationType } = await getMapVisualizationManager();
    const data = get(filteredPointsData);
    const success = await switchVisualizationType(map, oldType, newType, data);
    
    if (success) {
      console.log('Visualization type switch successful');
    } else {
      console.error('Visualization type switch failed');
    }
  } catch (error) {
    console.error('Error switching visualization type:', error);
  }
}

// Watch for data changes
let previousDataLength = 0;
let previousFilterState = '';

filteredPointsData.subscribe((data) => {
  const hasData = data?.features?.length > 0;
  const currentDataLength = data?.features?.length || 0;
  const pointsAdded = get(pointsAddedToMap);
  const ready = get(mapIsReady);
  const state = get(initializationState);
  
  // Create a fingerprint of the current filter state
  const selectedP = get(selectedPathogens);
  const selectedA = get(selectedAgeGroups); 
  const selectedS = get(selectedSyndromes);
  const currentFilterState = JSON.stringify({
    p: Array.from(selectedP).sort(),
    a: Array.from(selectedA).sort(),
    s: Array.from(selectedS).sort()
  });
  
  // console.log('Filtered data changed:', {
  //   hasData,
  //   currentDataLength,
  //   previousDataLength,
  //   pointsAdded,
  //   ready,
  //   state,
  //   filterStateChanged: currentFilterState !== previousFilterState
  // });
  
  if (hasData) {
    if (!pointsAdded && ready) {
      // First load or reinitialization needed
      console.log('Data available, checking initialization...');
      checkAndInitialize();
    } else if (pointsAdded && ready && state === 'ready' && 
              (currentDataLength !== previousDataLength || currentFilterState !== previousFilterState)) {
      // Data changed after initialization (filter change)
      console.log('Filter data changed, updating visualization...');
      handleFilterChange();
    }
    previousDataLength = currentDataLength;
    previousFilterState = currentFilterState;
  }
});

// Watch for visualization type changes
let previousVizType: string | null = null;
visualizationType.subscribe((newType) => {
  if (previousVizType && previousVizType !== newType) {
    handleVisualizationTypeChange(previousVizType, newType);
  }
  previousVizType = newType;
});