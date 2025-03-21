import { writable } from 'svelte/store';
import type { MapStyle } from './types';
import { loadStoredStyle, saveStyleToStorage, clearStoredStyle } from './localStorage';

function createMapStyleStore() {
  const initialStyle = loadStoredStyle();
  const { subscribe, set, update } = writable<MapStyle>(initialStyle);

  return {
    subscribe,
    set: (style: MapStyle) => {
      saveStyleToStorage(style);
      set(style);
    },
    reset: () => {
      clearStoredStyle();
      set(loadStoredStyle());
    }
  };
}

export const selectedMapStyle = createMapStyleStore();
