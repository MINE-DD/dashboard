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
  filteredPointsData: FeatureCollection<Point>,
  setLoading?: (loading: boolean) => void,
  setLoadingMessage?: (message: string) => void
): Promise<void> {
  if (!map) return;

  // Set loading state and message when pie chart generation starts
  if (setLoading) {
    setLoading(true);
  }
  if (setLoadingMessage) {
    setLoadingMessage('Generating pie charts...');
  }

  try {
    // Clean up existing pie chart images
    cleanupPieChartImages(map);

    // Use all points separately (no aggregation)
    const separateData = getSeparatePieChartData(filteredPointsData);

    // Generate pie chart images for each unique combination of prevalence, samples, and design
    const uniqueCombinations = new Map<
      string,
      { prevalenceValue: number; samples: number; design: string }
    >();

    separateData.features.forEach((feature) => {
      const { prevalenceValue, samples, design } = feature.properties!;
      const key = `${prevalenceValue}-${samples}-${design}`;
      if (!uniqueCombinations.has(key)) {
        uniqueCombinations.set(key, { prevalenceValue, samples, design });
      }
    });

    // Create default pie chart image for fallback
    const defaultImageUrl = createPieChartImage(0.5, 100, 'Study Design');
    const defaultImg = new Image();
    await new Promise<void>((resolve, reject) => {
      defaultImg.onload = () => {
        try {
          map.addImage('pie-chart-default', defaultImg);
          resolve();
        } catch (error) {
          console.error('Error adding default pie chart image to map:', error);
          reject(error);
        }
      };
      defaultImg.onerror = reject;
      defaultImg.src = defaultImageUrl;
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
  } finally {
    // Clear loading state when pie chart generation completes (success or failure)
    if (setLoading) {
      setLoading(false);
    }
    if (setLoadingMessage) {
      setLoadingMessage('Loading...');
    }
  }
}

/**
 * Generate MapLibre expression for pie chart icon selection
 */
export function generatePieChartIconExpression(
  filteredPointsData: FeatureCollection<Point>
): any {
  // Use separate data (no aggregation)
  const separateData = getSeparatePieChartData(filteredPointsData);

  // If no features, return default image
  if (!separateData.features || separateData.features.length === 0) {
    return 'pie-chart-default';
  }

  const expression: any[] = ['case'];

  // For each separate feature, create a case that maps to the appropriate pie chart image
  separateData.features.forEach((feature) => {
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
 * Get data for pie charts without aggregation (shows all pie charts separately)
 */
export function getSeparatePieChartData(filteredPointsData: FeatureCollection<Point>): FeatureCollection<Point> {
  // Add an id to each feature if it doesn't have one, ensuring unique IDs
  const featuresWithIds = filteredPointsData.features.map((feature, index) => ({
    ...feature,
    properties: {
      ...feature.properties,
      id: feature.properties?.id || `pie-chart-${index}-${Date.now()}`
    }
  }));

  return {
    type: 'FeatureCollection',
    features: featuresWithIds
  };
}

/**
 * Get aggregated data for use in map layers (legacy function, kept for compatibility)
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

/**
 * Create multiple pie chart layers ordered by size (larger to smaller, with smaller on top)
 */
export function createPieChartLayers(map: MaplibreMap, filteredPointsData: FeatureCollection<Point>): void {
  if (!map) return;

  // Get separate data
  const separateData = getSeparatePieChartData(filteredPointsData);

  // Determine size ranges based on sample counts
  const sampleCounts = separateData.features.map(f => f.properties?.samples || 0);
  const maxSamples = Math.max(...sampleCounts);
  const minSamples = Math.min(...sampleCounts);

  // Create 3 size categories: large, medium, small
  const largeCutoff = minSamples + (maxSamples - minSamples) * 0.67;
  const mediumCutoff = minSamples + (maxSamples - minSamples) * 0.33;

  // Define layer configurations (larger layers first, smaller on top)
  const layerConfigs = [
    {
      id: 'pie-charts-large',
      filter: ['>=', ['get', 'samples'], largeCutoff],
      zIndex: 1
    },
    {
      id: 'pie-charts-medium',
      filter: ['all', ['>=', ['get', 'samples'], mediumCutoff], ['<', ['get', 'samples'], largeCutoff]],
      zIndex: 2
    },
    {
      id: 'pie-charts-small',
      filter: ['<', ['get', 'samples'], mediumCutoff],
      zIndex: 3
    }
  ];

  // Create layers in order (large to small, so small appears on top)
  layerConfigs.forEach(config => {
    map.addLayer({
      id: config.id,
      type: 'symbol',
      source: 'points-source',
      filter: config.filter as any,
      layout: {
        'icon-image': generatePieChartIconExpression(filteredPointsData),
        'icon-size': 1,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    });
  });
}

/**
 * Remove all pie chart layers
 */
export function removePieChartLayers(map: MaplibreMap): void {
  if (!map) return;

  const layerIds = ['pie-charts-large', 'pie-charts-medium', 'pie-charts-small'];

  layerIds.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  });
}
