import type { Map as MaplibreMap } from 'maplibre-gl';
import type { PointFeatureCollection } from '$lib/types';

/**
 * Create a heatmap layer on the map
 */
export function createHeatmapLayer(map: MaplibreMap): void {
  if (map.getLayer('heatmap-layer')) {
    console.warn('Heatmap layer already exists');
    return;
  }

  map.addLayer({
    id: 'heatmap-layer',
    type: 'heatmap',
    source: 'points-source',
    maxzoom: 15,
    paint: getHeatmapPaintProperties()
  });

  console.log('Heatmap layer created');
}

/**
 * Remove the heatmap layer from the map
 */
export function removeHeatmapLayer(map: MaplibreMap): void {
  if (map.getLayer('heatmap-layer')) {
    map.removeLayer('heatmap-layer');
    console.log('Heatmap layer removed');
  }
}

/**
 * Get paint properties for the heatmap layer
 * Configures weight, intensity, color gradient, radius, and opacity
 */
export function getHeatmapPaintProperties(): any {
  return {
    // Weight based on prevalence value (0-100 scale)
    'heatmap-weight': [
      'interpolate',
      ['linear'],
      ['get', 'prevalenceValue'],
      0, 0,
      10, 0.3,
      50, 0.7,
      100, 1
    ],
    
    // Increase intensity as zoom level increases
    'heatmap-intensity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, 1,
      9, 3,
      12, 5
    ],
    
    // Color ramp for heatmap density
    // Blue (low) -> Cyan -> Yellow -> Orange -> Red (high)
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0, 'rgba(33,102,172,0)',
      0.2, 'rgb(103,169,207)',
      0.4, 'rgb(209,229,240)',
      0.6, 'rgb(253,219,199)',
      0.8, 'rgb(239,138,98)',
      1, 'rgb(178,24,43)'
    ],
    
    // Radius of influence increases with zoom
    // Smaller radius at low zoom for overview, larger at high zoom for detail
    'heatmap-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, 10,    // Small radius at world view
      5, 15,    // Medium radius at country view
      9, 25,    // Larger radius at city view
      12, 35,   // Even larger at neighborhood view
      15, 50    // Maximum radius at street level
    ],
    
    // Opacity decreases at very high zoom to allow transition to other views
    'heatmap-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, 0.6,   // Lower opacity at world view
      7, 0.8,   // Higher opacity at optimal viewing distance
      12, 0.6,  // Start fading at high zoom
      15, 0.3   // Mostly transparent at street level
    ]
  };
}

/**
 * Update heatmap paint properties dynamically
 * Can be used to adjust heatmap based on data or user preferences
 */
export function updateHeatmapProperties(
  map: MaplibreMap,
  property: string,
  value: any
): void {
  if (map.getLayer('heatmap-layer')) {
    map.setPaintProperty('heatmap-layer', property, value);
    console.log(`Updated heatmap property ${property}`);
  }
}


/**
 * Check if the data is suitable for heatmap visualization
 * Heatmaps work best with dense point data
 */
export function isDataSuitableForHeatmap(data: PointFeatureCollection): boolean {
  const featureCount = data.features.length;
  
  // Heatmap needs at least a few points to be meaningful
  if (featureCount < 3) {
    console.warn(`Only ${featureCount} features available - heatmap may not be meaningful`);
    return false;
  }
  
  // Check if prevalence values are available
  const hasPrevalenceValues = data.features.some(
    feature => feature.properties?.prevalenceValue !== undefined && 
               feature.properties?.prevalenceValue !== null
  );
  
  if (!hasPrevalenceValues) {
    console.warn('No prevalence values found in data - heatmap will use uniform weights');
  }
  
  return true;
}