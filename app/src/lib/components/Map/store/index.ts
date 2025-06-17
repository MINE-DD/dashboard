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
  loadingMessage,
  dataError,
  pathogenColors,
  visualizationType,
  switchVisualization,
  type VisualizationType,
  // New Raster Layer Store and Helpers
  rasterLayers,
  addRasterLayerFromUrl,
  updateRasterLayerVisibility,
  updateRasterLayerOpacity,
  updateAllRasterLayersOpacity,
  removeRasterLayer,
  fetchAndSetLayerBounds // Add the missing export
} from './stores';

// Re-export filter-to-raster mapping functionality
export {
  autoVisibleRasterLayers,
  initFilterRasterConnection
} from './filterRasterMapping';

// Re-export the filter manager functions
export {
  filteredIndices,
  filteredPointsData,
  clearFilterCache,
  pathogenCounts,
  ageGroupCounts,
  syndromeCounts
} from '../utils/filterManager';

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
  visualizationUpdateTrigger,
  mapUpdateSignal,
  autoUpdateEnabled,
  autoMapUpdater,
  triggerVisualizationUpdate,
  setMapInstance,
  setPointsAddedToMap,
  updateMapVisualization,
  forceVisualizationUpdate,
  handleMapContentChange,
  addInitialPointsToMap,
  switchVisualizationType
} from './mapVisualizationManager';
