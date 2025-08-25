import { pathogenIndex, ageGroupIndex, syndromeIndex } from '$lib/stores/filter.store';
import type { PointDataRow, PointFeature, PointFeatureCollection, FeatureIndex } from '$lib/types';

// Helper function to convert CSV data to GeoJSON with indexed structure
export function convertCsvToGeoJson(csvData: PointDataRow[]): PointFeatureCollection {
  // For indices
  const pathogenIdx = new Map<string, Set<number>>();
  const ageGroupIdx = new Map<string, Set<number>>();
  const syndromeIdx = new Map<string, Set<number>>();

  const features: PointFeature[] = csvData
    .filter(row => {
      // Ensure coordinates are valid numbers
      const lat = parseFloat(row.SITE_LAT);
      const long = parseFloat(row.SITE_LON);
      return !isNaN(lat) && !isNaN(long);
    })
    .map((row, index) => {
      const lat = parseFloat(row.SITE_LAT);
      const long = parseFloat(row.SITE_LON);

      // Update indices
      const updateIndex = (map: Map<string, Set<number>>, key: string, idx: number) => {
        if (!map.has(key)) {
          map.set(key, new Set<number>());
        }
        map.get(key)!.add(idx);
      };

      updateIndex(pathogenIdx, row.Pathogen, index);
      updateIndex(ageGroupIdx, row.AGE_VAL, index);  // Index by VAL for filtering
      updateIndex(syndromeIdx, row.SYNDROME_VAL, index);  // Index by VAL for filtering

      return {
        type: 'Feature',
        id: index, // Use index as feature ID for performance
        geometry: {
          type: 'Point',
          coordinates: [long, lat] // GeoJSON uses [longitude, latitude]
        },
        properties: {
          id: row.EST_ID || '',
          pathogen: row.Pathogen || '',
          ageGroup: row.AGE_LAB || '',
          ageGroupVal: row.AGE_VAL || '', // For sorting
          ageGroupLab: row.AGE_LAB || '', // Display label
          syndrome: row.SYNDROME_LAB || '',
          syndromeVal: row.SYNDROME_VAL || '', // For sorting
          syndromeLab: row.SYNDROME_LAB || '', // Display label
          design: row.Design || '',
          location: row.Location || '',
          heading: row.Heading || '',
          subheading: row.Subheading || '',
          footnote: row.Footnote || '',
          prevalence: row.Prevalence || '',
          ageRange: row.Age_range || '',
          duration: row.Duration || '',
          source: row.Source || '',
          hyperlink: row.Hyperlink || '',
          cases: parseInt(row.CASES) || 0,
          samples: parseInt(row.SAMPLES) || 0,
          // Parse prevalence value from string like "42.4 (39.2, 45.6)"
          prevalenceValue: row.Prevalence ? parseFloat(row.Prevalence.split(' ')[0]) || 0 : 0,
          standardError: parseFloat(row.SE) || 0
        }
      };
    });

  // Special case handling for Campylobacter spp. is now in filterManager.ts

  // Update indices stores
  pathogenIndex.set(pathogenIdx);
  ageGroupIndex.set(ageGroupIdx);
  syndromeIndex.set(syndromeIdx);
  
  // Debug log to verify indices
  console.log('Index Debug:', {
    pathogenKeys: Array.from(pathogenIdx.keys()).slice(0, 3),
    ageGroupKeys: Array.from(ageGroupIdx.keys()).slice(0, 10),
    syndromeKeys: Array.from(syndromeIdx.keys()).slice(0, 10),
    totalFeatures: features.length,
    sampleAgeVal: features[0]?.properties?.ageGroupVal,
    sampleSyndromeVal: features[0]?.properties?.syndromeVal
  });

  return {
    type: 'FeatureCollection',
    features
  };
}
