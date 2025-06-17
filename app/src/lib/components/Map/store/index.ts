// Re-export all public facing types
// export * from './types'; // Types are now in $lib/types.ts and should be imported directly

// Re-export stores from new locations
export {
  pointsData,
  isLoading,
  loadingMessage,
  dataError,
  pathogenColors
} from '$lib/stores/data.store';
export {
  pathogenIndex,
  ageGroupIndex,
  syndromeIndex,
  pathogens,
  ageGroups,
  syndromes,
  selectedPathogens,
  selectedAgeGroups,
  selectedSyndromes
} from '$lib/stores/filter.store';
export {
  visualizationType,
  switchVisualization,
  type VisualizationType // This type is also in map.store.ts
} from '$lib/stores/map.store'; // Ensure VisualizationType is exported there
export {
  rasterLayers,
  addRasterLayerFromUrl,
  updateRasterLayerVisibility,
  updateRasterLayerOpacity,
  updateAllRasterLayersOpacity,
  removeRasterLayer,
  fetchAndSetLayerBounds
} from '$lib/stores/raster.store';

// Re-export filter-to-raster mapping functionality
export {
  autoVisibleRasterLayers,
  initFilterRasterConnection
} from './filterRasterMapping';

// Re-export the filter manager functions from the new filter store
export {
  filteredIndices,
  filteredPointsData,
  clearFilterCache,
  pathogenCounts,
  ageGroupCounts,
  syndromeCounts
} from '$lib/stores/filter.store';

// Re-export the data loader
export { loadPointsData } from '../utils/dataLoader';

// Re-export the GeoJSON converter
export { convertCsvToGeoJson } from '../utils/geoJsonConverter';

// Re-export the color manager
export { generateColors } from '../utils/colorManager';

// Re-export the maplibre helpers
export { getMaplibreFilterExpression } from '../utils/maplibreHelpers';

// Re-export the map visualization manager
export {
  mapInstance,
  pointsAddedToMap,
  isUpdatingVisualization,
  // visualizationUpdateTrigger, // Removed as part of refactor
  // mapUpdateSignal, // Removed as part of refactor
  autoUpdateEnabled, // Kept as it might be used by components
  // autoMapUpdater, // Removed as part of refactor
  // triggerVisualizationUpdate, // Removed as part of refactor
  setMapInstance,
  setPointsAddedToMap,
  updateMapVisualization,
  forceVisualizationUpdate,
  handleMapContentChange,
  addInitialPointsToMap,
  switchVisualizationType
} from './mapVisualizationManager';
