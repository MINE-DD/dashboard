import type { Map as MaplibreMap } from 'maplibre-gl';
import type { FeatureCollection, Feature, Point, Polygon } from 'geojson';
import type { PointProperties } from '$lib/types';
import { get } from 'svelte/store';
import { barThickness } from '$lib/stores/map.store';

// Design type color mapping (consistent with existing visualizations)
const DESIGN_COLORS: { [key: string]: string } = {
  'Surveillance': '#FFE5B4',               // Pastel Orange
  'Intervention Trial': '#B7EFC5',         // Pastel Green
  'Case-Control': '#FFB3C6',               // Pastel Red
  'Cohort': '#9197FF'                      // Pastel Blue
};

const DEFAULT_COLOR = '#808080';

/**
 * Convert point data to polygon data for 3D bar extrusions
 */
export function convertPointsToPolygons(
  pointsData: FeatureCollection<Point, PointProperties>
): FeatureCollection<Polygon, PointProperties & { extrusionHeight: number; color: string }> {
  const polygonFeatures: Feature<Polygon, PointProperties & { extrusionHeight: number; color: string }>[] = [];

  pointsData.features.forEach((pointFeature, index) => {
    const [lng, lat] = pointFeature.geometry.coordinates;
    const properties = pointFeature.properties!;

    // Calculate extrusion height based on prevalence value
    // Scale prevalence (0-1 or 0-100) to a reasonable height in meters
    let height = 50; // Default minimum height to ensure visibility

    if (properties.prevalenceValue !== undefined && properties.prevalenceValue !== null) {
      // If prevalence is between 0-1, multiply by 100 to get percentage
      const prevalencePercent = properties.prevalenceValue <= 1
        ? properties.prevalenceValue * 100
        : properties.prevalenceValue;

      // Scale to height: 1% = 20 meters for better visibility (much smaller scale)
      height = Math.max(50, prevalencePercent * 20);
    }

    // Also consider sample size for additional height scaling
    if (properties.samples && properties.samples > 0) {
      // Add bonus height based on sample size (logarithmic scaling)
      const sampleBonus = Math.log10(Math.max(1, properties.samples)) * 10;
      height += sampleBonus;
    }

    // Ensure minimum height for visibility but keep it reasonable
    height = Math.max(100, Math.min(height, 1000)); // Cap at 1000 meters

    // Get color based on design type
    const color = DESIGN_COLORS[properties.design] || DEFAULT_COLOR;


    // Create a square polygon around the point with data-driven thickness
    // Calculate thickness based on sample size (like pie chart diameter)
    // Base thickness from store, scaled by sample size
    const baseThickness = get(barThickness);

    // Scale thickness based on sample size (similar to pie chart sizing)
    // Use square root scaling like pie charts: sqrt(samples) * scale_factor
    const sampleScaleFactor = properties.samples > 0 ? Math.sqrt(properties.samples) * 0.01 : 1;
    const minScale = 0.5; // Minimum 50% of base thickness
    const maxScale = 3.0; // Maximum 300% of base thickness
    const scaledThickness = Math.max(minScale, Math.min(maxScale, sampleScaleFactor));

    const size = baseThickness * scaledThickness;
    const halfSize = size / 2;

    const polygonCoordinates = [[
      [lng - halfSize, lat - halfSize], // Bottom-left
      [lng + halfSize, lat - halfSize], // Bottom-right
      [lng + halfSize, lat + halfSize], // Top-right
      [lng - halfSize, lat + halfSize], // Top-left
      [lng - halfSize, lat - halfSize]  // Close the polygon
    ]];

    const polygonFeature: Feature<Polygon, PointProperties & { extrusionHeight: number; color: string }> = {
      type: 'Feature',
      id: properties.id,
      geometry: {
        type: 'Polygon',
        coordinates: polygonCoordinates
      },
      properties: {
        ...properties,
        extrusionHeight: height,
        color: color
      }
    };


    polygonFeatures.push(polygonFeature);
  });

  return {
    type: 'FeatureCollection',
    features: polygonFeatures
  };
}

/**
 * Create 3D bar extrusion layer
 */
export function create3DBarLayer(map: MaplibreMap): void {
  if (!map) return;


  // Use actual data values for colors and heights
  map.addLayer({
    id: '3d-bars-layer',
    type: 'fill-extrusion',
    source: 'points-source',
    paint: {
      // Use the color property from the converted polygon data
      'fill-extrusion-color': ['get', 'color'],
      // Use scaled height based on data (multiply by 1000 for visibility)
      'fill-extrusion-height': ['*', ['get', 'extrusionHeight'], 1000],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.8
    }
  });

  console.log('✅ 3D bar layer created successfully');
}

/**
 * Remove 3D bar extrusion layer
 */
export function remove3DBarLayer(map: MaplibreMap): void {
  if (!map) return;

  if (map.getLayer('3d-bars-layer')) {
    map.removeLayer('3d-bars-layer');
  }
}

/**
 * Get design type colors (for consistency)
 */
export function getDesignColors(): { [key: string]: string } {
  return { ...DESIGN_COLORS };
}

/**
 * Get the default color
 */
export function getDefaultColor(): string {
  return DEFAULT_COLOR;
}

/**
 * Calculate optimal camera settings for 3D view
 */
export function get3DCameraSettings() {
  return {
    pitch: 60, // Higher angle to view 3D extrusions better
    bearing: 0  // North-up orientation
  };
}

/**
 * Generate MapLibre expression for dynamic height calculation
 * This allows for real-time height adjustments based on zoom level or other factors
 */
export function generateHeightExpression(): any {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    10, ['*', ['get', 'extrusionHeight'], 0.1], // At zoom 10, show 10% of height
    15, ['get', 'extrusionHeight'],             // At zoom 15, show full height
    20, ['*', ['get', 'extrusionHeight'], 2]    // At zoom 20, show 200% of height
  ];
}

/**
 * Generate MapLibre expression for dynamic color based on height
 * This creates a gradient effect where taller bars have different colors
 */
export function generateColorExpression(): any {
  return [
    'case',
    ['>', ['get', 'extrusionHeight'], 1000],
    '#FF4444', // Red for very high values
    ['>', ['get', 'extrusionHeight'], 500],
    '#FF8844', // Orange for high values
    ['>', ['get', 'extrusionHeight'], 100],
    ['get', 'color'], // Use design color for medium values
    '#CCCCCC' // Gray for low values
  ];
}
