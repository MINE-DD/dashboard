import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { MAP_STYLES, type MapStyle } from '$lib/components/Map/MapStyles';

// Initialize with the default style
const defaultStyle = MAP_STYLES[0];

// Create a persistent store to remember the user's map style choice
function createMapStyleStore() {
  // Try to load the previously selected style from localStorage
  let initialStyle = defaultStyle;

  if (browser) {
    const savedStyleId = localStorage.getItem('selectedMapStyle');
    if (savedStyleId) {
      const found = MAP_STYLES.find(style => style.id === savedStyleId);
      if (found) {
        initialStyle = found;
      }
    }
  }

  const { subscribe, set, update } = writable<MapStyle>(initialStyle);

  return {
    subscribe,
    set: (style: MapStyle) => {
      if (browser) {
        localStorage.setItem('selectedMapStyle', style.id);
      }
      set(style);
    },
    // Reset to default style
    reset: () => {
      if (browser) {
        localStorage.removeItem('selectedMapStyle');
      }
      set(defaultStyle);
    }
  };
}

export const selectedMapStyle = createMapStyleStore();
