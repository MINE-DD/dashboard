import { writable } from 'svelte/store';
import type { PointFeatureCollection } from '$lib/types';

// GeoJSON data store
export const pointsData = writable<PointFeatureCollection>({
  type: 'FeatureCollection',
  features: []
});

// Loading and error states
export const isLoading = writable<boolean>(false);
export const loadingMessage = writable<string>('Loading...');
export const dataError = writable<string | null>(null);

// Color mapping for pathogens
export const pathogenColors = writable<Map<string, string>>(new Map());
