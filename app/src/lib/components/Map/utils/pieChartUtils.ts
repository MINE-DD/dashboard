import type { Map as MaplibreMap } from 'maplibre-gl';
import type { FeatureCollection, Feature, Point } from 'geojson';

// Design type color mapping (consistent with dots)
const DESIGN_COLORS: { [key: string]: string } = {
  'Surveillance': '#FFE5B490',               // Pastel Orange
  'Surveillance_dark': '#7A4F0060',          // Even Darker Pastel Orange
  'Intervention Trial': '#B7EFC590',         // Pastel Green
  'Intervention Trial_dark': '#18513A60',    // Even Darker Pastel Green
  'Case-Control': '#FFB3C690',               // Pastel Red
  'Case-Control_dark': '#5A1E2960',          // Even Darker Pastel Red
  'Cohort': '#9197FF90',                     // Pastel Blue
  'Cohort_dark': '#10163A60'                 // Even Darker Pastel Blue
};

const DEFAULT_COLOR = '#808080';

/**
 * Aggregate data points by location to avoid overlapping pie charts
 */
function aggregatePointsByLocation(filteredPointsData: FeatureCollection<Point>): FeatureCollection<Point> {
  const locationGroups = new Map<string, Feature<Point>[]>();

  // Group features by coordinates
  filteredPointsData.features.forEach((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const locationKey = `${lng.toFixed(6)},${lat.toFixed(6)}`;

    if (!locationGroups.has(locationKey)) {
      locationGroups.set(locationKey, []);
    }
    locationGroups.get(locationKey)!.push(feature);
  });

  // Create aggregated features
  const aggregatedFeatures: Feature<Point>[] = [];

  locationGroups.forEach((features, locationKey) => {
    if (features.length === 1) {
      // Single feature at this location, use as-is
      aggregatedFeatures.push(features[0]);
    } else {
      // Multiple features at same location, aggregate them
      const [lng, lat] = features[0].geometry.coordinates;

      // Calculate weighted average prevalence and total samples
      let totalSamples = 0;
      let weightedPrevalenceSum = 0;
      const designCounts = new Map<string, number>();

      features.forEach((feature) => {
        const samples = feature.properties!.samples || 0;
        const prevalenceValue = feature.properties!.prevalenceValue || 0;
        const design = feature.properties!.design || 'Unknown';

        totalSamples += samples;
        weightedPrevalenceSum += prevalenceValue * samples;

        // Count design types
        designCounts.set(design, (designCounts.get(design) || 0) + 1);
      });

      // Use the most common design type
      let mostCommonDesign = 'Mixed';
      let maxCount = 0;
      designCounts.forEach((count, design) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonDesign = design;
        }
      });

      // Calculate weighted average prevalence
      const avgPrevalence = totalSamples > 0 ? weightedPrevalenceSum / totalSamples : 0;

      // Create aggregated feature
      const aggregatedFeature: Feature<Point> = {
        type: 'Feature',
        id: `aggregated-${locationKey}`,
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        properties: {
          id: `aggregated-${locationKey}`,
          pathogen: features.map(f => f.properties!.pathogen).join(', '),
          ageGroup: features.map(f => f.properties!.ageGroup).join(', '),
          syndrome: features.map(f => f.properties!.syndrome).join(', '),
          design: mostCommonDesign,
          location: features[0].properties!.location,
          prevalence: `${avgPrevalence.toFixed(2)}%`,
          study: `${features.length} studies`,
          samples: totalSamples,
          prevalenceValue: avgPrevalence,
          standardError: 0, // Could calculate combined SE if needed
          cases: features.reduce((sum, f) => sum + (f.properties!.cases || 0), 0)
        }
      };

      aggregatedFeatures.push(aggregatedFeature);
    }
  });

  return {
    type: 'FeatureCollection',
    features: aggregatedFeatures
  };
}

/**
 * Create a pie chart image for a data point
 */
export function createPieChartImage(
  prevalenceValue: number,
  samples: number,
  design: string
): string {
  const canvas = document.createElement('canvas');
  const size = Math.max(20, Math.min(60, Math.sqrt(samples) * 3)); // Scale size based on samples
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 2; // Leave 2px margin for stroke

  // Clear canvas completely
  ctx.clearRect(0, 0, size, size);

  // Reset any existing paths and styles
  ctx.beginPath();

  // Get design color
  const baseColor = DESIGN_COLORS[design] || DEFAULT_COLOR;
  const darkenBaseColor = DESIGN_COLORS[design + '_dark'] || DEFAULT_COLOR;

  // Convert prevalence to fraction
  // If prevalenceValue is a decimal (0.0-1.0), use it directly
  // If prevalenceValue is a percentage (0-100), divide by 100
  let prevalenceFraction: number;

  if (prevalenceValue <= 1) {
    // Assume it's already a decimal fraction (0.0-1.0)
    prevalenceFraction = Math.max(0, Math.min(1, prevalenceValue));
  } else {
    // Assume it's a percentage (0-100), convert to fraction
    prevalenceFraction = Math.max(0, Math.min(100, prevalenceValue)) / 100;
  }

  // Define angles
  const startAngle = -Math.PI / 2; // Start at top
  const prevalenceEndAngle = startAngle + 2 * Math.PI * prevalenceFraction;

  // First, draw the complete background circle (non-prevalence)
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.fillStyle = baseColor;
  ctx.fill();

  // Then, draw the prevalence segment on top (if any prevalence exists)
  if (prevalenceFraction > 0) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, prevalenceEndAngle);
    ctx.closePath();
    ctx.fillStyle = darkenBaseColor;
    ctx.fill();
  }

  // Add a subtle border to make the pie chart more defined
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  return canvas.toDataURL();
}

/**
 * Clean up existing pie chart images from the map
 */
export function cleanupPieChartImages(map: MaplibreMap): void {
  const loadedImages = map.listImages();
  loadedImages.forEach((imageId) => {
    if (imageId.startsWith('pie-chart-') && map.hasImage(imageId)) {
      try {
        map.removeImage(imageId);
      } catch (e) {
        // Ignore errors if image doesn't exist or can't be removed
      }
    }
  });
}

/**
 * Generate pie chart symbols for all points and add them to the map
 */
export async function generatePieChartSymbols(
  map: MaplibreMap,
  filteredPointsData: FeatureCollection<Point>
): Promise<void> {
  if (!map) return;

  // Clean up existing pie chart images
  cleanupPieChartImages(map);

  // Aggregate points by location to avoid overlapping pie charts
  const aggregatedData = aggregatePointsByLocation(filteredPointsData);

  // Generate pie chart images for each unique combination of prevalence, samples, and design
  const uniqueCombinations = new Map<
    string,
    { prevalenceValue: number; samples: number; design: string }
  >();

  aggregatedData.features.forEach((feature) => {
    const { prevalenceValue, samples, design } = feature.properties!;
    const key = `${prevalenceValue}-${samples}-${design}`;
    if (!uniqueCombinations.has(key)) {
      uniqueCombinations.set(key, { prevalenceValue, samples, design });
    }
  });

  // Add pie chart images to map
  const imagePromises: Promise<void>[] = [];
  uniqueCombinations.forEach(({ prevalenceValue, samples, design }, key) => {
    const imageUrl = createPieChartImage(prevalenceValue, samples, design);
    const imageId = `pie-chart-${key}`;

    const promise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          map.addImage(imageId, img);
          resolve();
        } catch (error) {
          console.error('Error adding pie chart image to map:', error);
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = imageUrl;
    });

    imagePromises.push(promise);
  });

  await Promise.all(imagePromises);
}

/**
 * Generate MapLibre expression for pie chart icon selection
 */
export function generatePieChartIconExpression(
  filteredPointsData: FeatureCollection<Point>
): any[] {
  // Aggregate points by location first
  const aggregatedData = aggregatePointsByLocation(filteredPointsData);

  const expression: any[] = ['case'];

  // For each aggregated feature, create a case that maps to the appropriate pie chart image
  aggregatedData.features.forEach((feature) => {
    const { prevalenceValue, samples, design } = feature.properties!;
    const key = `${prevalenceValue}-${samples}-${design}`;
    const imageId = `pie-chart-${key}`;

    // Add condition: if this specific feature, use this image
    expression.push(['==', ['get', 'id'], feature.properties!.id], imageId);
  });

  // Default fallback (should not be reached)
  expression.push('pie-chart-default');

  return expression;
}

/**
 * Get aggregated data for use in map layers
 */
export function getAggregatedPointsData(filteredPointsData: FeatureCollection<Point>): FeatureCollection<Point> {
  return aggregatePointsByLocation(filteredPointsData);
}

/**
 * Get design type colors (for consistency with pie charts)
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
