import type { Map as MaplibreMap } from 'maplibre-gl';
import type { FeatureCollection, Feature, Point } from 'geojson';

// Design type color mapping (consistent with dots)
const DESIGN_COLORS: { [key: string]: string } = {
  'Surveillance': '#FFE5B4',         // Pastel Orange
  'Intervention Trial': '#B7EFC5',   // Pastel Green
  'Case control': '#FFB3C6',         // Pastel Red
  'Cohort': '#9197FF'                // Pastel Blue
};

const DEFAULT_COLOR = '#808080';

/**
 * Helper function to convert hex color to rgba with specified opacity
 */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Helper function to create a darker version of a hex color
 */
function darkenColor(hex: string, factor: number = 0.6): string {
  const r = Math.floor(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.floor(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.floor(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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

  // Clear canvas
  ctx.clearRect(0, 0, size, size);

  // Get design color
  const baseColor = DESIGN_COLORS[design] || DEFAULT_COLOR;

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


  // Create two distinct pie segments
  const startAngle = -Math.PI / 2; // Start at top
  const prevalenceEndAngle = startAngle + 2 * Math.PI * prevalenceFraction;

  // Draw prevalence segment (bright color)
  if (prevalenceFraction > 0) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, prevalenceEndAngle);
    ctx.closePath();
    ctx.fillStyle = baseColor; // Full bright color for prevalence
    ctx.fill();
  }

  // Draw non-prevalence segment (darker color)
  if (prevalenceFraction < 1) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, prevalenceEndAngle, startAngle + 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = darkenColor(baseColor); // Darker version for non-prevalence
    ctx.fill();
  }

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

  // Generate pie chart images for each unique combination of prevalence, samples, and design
  const uniqueCombinations = new Map<
    string,
    { prevalenceValue: number; samples: number; design: string }
  >();

  filteredPointsData.features.forEach((feature) => {
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
  const expression: any[] = ['case'];

  // For each feature, create a case that maps to the appropriate pie chart image
  filteredPointsData.features.forEach((feature) => {
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
