import { writable, derived } from 'svelte/store';
import type { FeatureIndex, PointFeatureCollection } from './types';

// Indices for fast filtering
export const pathogenIndex = writable<FeatureIndex>(new Map());
export const ageGroupIndex = writable<FeatureIndex>(new Map());
export const syndromeIndex = writable<FeatureIndex>(new Map());

// Filter options stores
export const pathogens = writable<Set<string>>(new Set());
export const ageGroups = writable<Set<string>>(new Set());
export const syndromes = writable<Set<string>>(new Set());

// Selected filters stores
export const selectedPathogens = writable<Set<string>>(new Set());
export const selectedAgeGroups = writable<Set<string>>(new Set());
export const selectedSyndromes = writable<Set<string>>(new Set());

// GeoJSON data store
export const pointsData = writable<PointFeatureCollection>({
  type: 'FeatureCollection',
  features: []
});

// Loading and error states
export const isLoading = writable<boolean>(false);
export const dataError = writable<string | null>(null);

// Color mapping for pathogens
export const pathogenColors = writable<Map<string, string>>(new Map());

// --- Raster Layer Stores ---

// Visibility state for the example COG layer
export const isExampleCogVisible = writable<boolean>(true); // Set to true to be visible by default

// Opacity state for the example COG layer (0 to 1)
export const exampleCogOpacity = writable<number>(0.8); // Default to 80% opacity

// URL for the example COG layer (using Cloudflare R2 public endpoint)
export const exampleCogUrl = writable<string>(
  // '/data/TCI.tif',
  // 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/36/Q/WD/2020/7/S2A_36QWD_20200701_0_L2A/TCI.tif'
  'https://pub-62f092641a504c70a213fec807d20190.r2.dev/cogs/TCI.tif'
)
