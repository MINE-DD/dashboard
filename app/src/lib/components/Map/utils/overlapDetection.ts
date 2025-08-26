import type { Map as MaplibreMap } from 'maplibre-gl';

/**
 * Detects overlapping features at a specific coordinate
 * @param map - MapLibre map instance
 * @param coordinates - The clicked coordinates [lng, lat]
 * @param clickPoint - The click point in pixels
 * @returns Array of features at this location
 */
export function detectOverlappingFeatures(
  map: MaplibreMap,
  coordinates: [number, number],
  clickPoint: { x: number; y: number }
): maplibregl.MapGeoJSONFeature[] {
  // Query all visualization layers at the click point
  const layers = ['points-layer', 'pie-charts-large', 'pie-charts-medium', 'pie-charts-small', '3d-bars-layer'];
  const buffer = 10; // Small buffer for click detection
  
  const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
    [clickPoint.x - buffer, clickPoint.y - buffer],
    [clickPoint.x + buffer, clickPoint.y + buffer]
  ];
  
  const allFeatures: maplibregl.MapGeoJSONFeature[] = [];
  const seenIds = new Set<string>();
  
  layers.forEach(layerId => {
    if (map.getLayer(layerId)) {
      const features = map.queryRenderedFeatures(bbox, {
        layers: [layerId]
      });
      
      features.forEach(feature => {
        // Create unique key for deduplication
        const uniqueKey = `${feature.properties?.pathogen}_${feature.properties?.age_group}_${feature.properties?.syndrome}_${feature.properties?.prevalence_value}`;
        
        if (!seenIds.has(uniqueKey)) {
          seenIds.add(uniqueKey);
          allFeatures.push(feature);
        }
      });
    }
  });
  
  // Filter to only features at the exact clicked coordinates
  const exactMatches = allFeatures.filter(feature => {
    if (feature.geometry.type === 'Point') {
      const coords = feature.geometry.coordinates;
      return Math.abs(coords[0] - coordinates[0]) < 0.000001 && 
             Math.abs(coords[1] - coordinates[1]) < 0.000001;
    }
    return false;
  });
  
  return exactMatches;
}