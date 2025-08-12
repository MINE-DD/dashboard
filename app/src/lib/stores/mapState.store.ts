import { writable, derived } from 'svelte/store';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { filteredPointsData } from './filter.store';

// Core map instance
export const mapInstance = writable<MaplibreMap | null>(null);

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
  mapInstance,
  ($map) => {
    if (!$map) return false;
    try {
      return $map.loaded() || $map.isStyleLoaded();
    } catch {
      return false;
    }
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

// Action functions to update state
export function setMapInstance(map: MaplibreMap | null) {
  mapInstance.set(map);
  if (!map) {
    initializationState.set('idle');
    pointsAddedToMap.set(false);
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

export function resetMapState() {
  mapInstance.set(null);
  initializationState.set('idle');
  pointsAddedToMap.set(false);
  isUpdatingVisualization.set(false);
  isProgrammaticSwitching.set(false);
  isAdjustingLayerOrder.set(false);
  mapError.set(null);
}