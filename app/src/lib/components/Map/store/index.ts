// Re-export all public facing types
export * from './types';

// Re-export stores
export {
  pointsData,
  pathogenIndex,
  ageGroupIndex,
  syndromeIndex,
  pathogens,
  ageGroups,
  syndromes,
  selectedPathogens,
  selectedAgeGroups,
  selectedSyndromes,
  isLoading,
  dataError,
  pathogenColors,
  // New Raster Layer Store and Helpers
  rasterLayers,
  addRasterLayerFromUrl,
  updateRasterLayerVisibility,
  updateRasterLayerOpacity,
  removeRasterLayer
} from './stores';

// Re-export the filter manager functions
export {
  filteredIndices,
  filteredPointsData,
  clearFilterCache
} from './filterManager';

// Re-export the data loader
export { loadPointsData } from './dataLoader';

// Re-export the GeoJSON converter
export { convertCsvToGeoJson } from './geoJsonConverter';

// Re-export the color manager
export { generateColors } from './colorManager';

// Re-export the maplibre helpers
export { getMaplibreFilterExpression } from './maplibreHelpers';
