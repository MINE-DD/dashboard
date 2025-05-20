import { pathogenIndex, ageGroupIndex, syndromeIndex } from './stores';
import type { PointDataRow, PointFeature, PointFeatureCollection, FeatureIndex } from './types';

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
      const long = parseFloat(row.SITE_LONG);
      return !isNaN(lat) && !isNaN(long);
    })
    .map((row, index) => {
      const lat = parseFloat(row.SITE_LAT);
      const long = parseFloat(row.SITE_LONG);

      // Update indices
      const updateIndex = (map: Map<string, Set<number>>, key: string, idx: number) => {
        if (!map.has(key)) {
          map.set(key, new Set<number>());
        }
        map.get(key)!.add(idx);
      };

      updateIndex(pathogenIdx, row.Pathogen, index);
      updateIndex(ageGroupIdx, row.Age_group, index);
      updateIndex(syndromeIdx, row.Syndrome, index);

      return {
        type: 'Feature',
        id: index, // Use index as feature ID for performance
        geometry: {
          type: 'Point',
          coordinates: [long, lat] // GeoJSON uses [longitude, latitude]
        },
        properties: {
          id: row.EST_ID,
          pathogen: row.Pathogen,
          ageGroup: row.Age_group,
          syndrome: row.Syndrome,
          design: row.Design,
          location: row.Site_Location,
          prevalence: row.Prevalence,
          ageRange: row.Age_range,
          study: row.Study,
          duration: row.Duration,
          source: row.Source,
          hyperlink: row.Hyperlink,
          cases: parseInt(row.CASES) || 0,
          samples: parseInt(row.SAMPLES) || 0,
          prevalenceValue: parseFloat(row.PREV) || 0,
          standardError: parseFloat(row.SE) || 0
        }
      };
    });

  // Special case handling for Campylobacter spp. is now in filterManager.ts

  // Update indices stores
  pathogenIndex.set(pathogenIdx);
  ageGroupIndex.set(ageGroupIdx);
  syndromeIndex.set(syndromeIdx);

  return {
    type: 'FeatureCollection',
    features
  };
}
