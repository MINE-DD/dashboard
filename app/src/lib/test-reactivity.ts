// Test script to verify store reactivity
import { get } from 'svelte/store';
import { 
  mapInstance, 
  initializationState, 
  pointsAddedToMap,
  canInitializeMap,
  mapReady,
  hasData
} from '$lib/stores/mapState.store';
import { filteredPointsData } from '$lib/stores/filter.store';

export function testReactivity() {
  console.log('=== Testing Store Reactivity ===');
  
  // Subscribe to derived stores
  const unsubCanInit = canInitializeMap.subscribe(value => {
    console.log('canInitializeMap changed:', value);
  });
  
  const unsubMapReady = mapReady.subscribe(value => {
    console.log('mapReady changed:', value);
  });
  
  const unsubHasData = hasData.subscribe(value => {
    console.log('hasData changed:', value);
  });
  
  const unsubFiltered = filteredPointsData.subscribe(value => {
    console.log('filteredPointsData changed:', value?.features?.length || 0, 'features');
  });
  
  const unsubInitState = initializationState.subscribe(value => {
    console.log('initializationState changed:', value);
  });
  
  // Log initial state
  console.log('Initial state:', {
    mapInstance: get(mapInstance),
    initializationState: get(initializationState),
    pointsAddedToMap: get(pointsAddedToMap),
    canInitializeMap: get(canInitializeMap),
    mapReady: get(mapReady),
    hasData: get(hasData)
  });
  
  // Return cleanup function
  return () => {
    unsubCanInit();
    unsubMapReady();
    unsubHasData();
    unsubFiltered();
    unsubInitState();
    console.log('=== Reactivity Test Cleanup ===');
  };
}