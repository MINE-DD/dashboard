import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Visualization type for map points
export type VisualizationType = 'dots' | 'pie-charts';

// Create a persistent visualization type store with map updates
function createVisualizationTypeStore() {
  const STORAGE_KEY = 'visualizationType';
  const defaultType: VisualizationType = 'pie-charts';

  // Load initial value from localStorage if available
  const initialValue = browser
    ? (localStorage.getItem(STORAGE_KEY) as VisualizationType) || defaultType
    : defaultType;

  const { subscribe, set, update } = writable<VisualizationType>(initialValue);

  return {
    subscribe,
    set: (value: VisualizationType) => {
      if (browser) {
        localStorage.setItem(STORAGE_KEY, value);
      }
      set(value);

      // Trigger visualization type change through the store
      // The mapVisualizationManager is expected to subscribe to this store
      // or be called by components reacting to this store's change.
      // The direct import and call to switchVisualizationType is a bit of a tight coupling
      // that might be revisited in a future refactor if desired.
      setTimeout(async () => {
        try {
          // Assuming mapVisualizationManager is correctly imported and used
          // where this store's value change is observed.
          // For now, we keep the original dynamic import pattern if it's crucial.
          const { switchVisualizationType } = await import('$lib/components/Map/store/mapVisualizationManager');
          console.log(`Visualization type changed to ${value}, triggering switch`);
          await switchVisualizationType(value);
        } catch (error) {
          console.warn('Failed to switch visualization type via map.store.ts:', error);
        }
      }, 10);
    },
    update
  };
}

export const visualizationType = createVisualizationTypeStore();

// Manual visualization switching function - called explicitly when visualization type changes
// This function seems to primarily update the store, which then triggers the effect in its `set` method.
export function switchVisualization(newType: VisualizationType) {
  // Update the visualization type store
  visualizationType.set(newType);

  // Return a signal that visualization switching is needed
  // This will be used by MapLayer to trigger the actual switching
  // This part might also be re-evaluated in a deeper refactor of the visualization switching logic.
  return { visualizationType: newType, timestamp: Date.now() };
}
