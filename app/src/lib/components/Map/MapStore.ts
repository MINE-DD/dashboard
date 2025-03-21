import { writable, derived, get } from 'svelte/store';
import type { Feature, FeatureCollection, Point } from 'geojson';

// Import Papa Parse with compatibility for different module systems
let Papa: any;
try {
  // @ts-ignore - Special handling for CommonJS/UMD modules in ES context
  Papa = (await import('papaparse')).default;
} catch (e) {
  console.error('Error loading PapaParse:', e);
  // Fallback to a minimal parser for emergency cases
  Papa = {
    parse: (text: string, config: any) => {
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const results: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',');
        const row: any = {};

        headers.forEach((header, index) => {
          row[header] = values[index] ? values[index].trim() : '';
        });

        results.push(row);
      }

      return { data: results, errors: [] };
    }
  };
}

// Define the CSV row interface based on the provided structure
export interface PointDataRow {
  EST_ID: string;
  Pathogen: string;
  Age_group: string;
  Syndrome: string;
  Design: string;
  Site_Location: string;
  Prevalence: string;
  Age_range: string;
  Study: string;
  Duration: string;
  Source: string;
  Hyperlink: string;
  CASES: string;
  SAMPLES: string;
  PREV: string;
  SE: string;
  SITE_LAT: string;
  SITE_LONG: string;
}

// Define the GeoJSON feature properties interface
export interface PointProperties {
  id: string;
  pathogen: string;
  ageGroup: string;
  syndrome: string;
  design: string;
  location: string;
  prevalence: string;
  ageRange: string;
  study: string;
  duration: string;
  source: string;
  hyperlink: string;
  cases: number;
  samples: number;
  prevalenceValue: number;
  standardError: number;
}

export type PointFeature = Feature<Point, PointProperties>;
export type PointFeatureCollection = FeatureCollection<Point, PointProperties>;

// Indices for fast filtering
type FeatureIndex = Map<string, Set<number>>;
export const pathogenIndex = writable<FeatureIndex>(new Map());
export const ageGroupIndex = writable<FeatureIndex>(new Map());
export const syndromeIndex = writable<FeatureIndex>(new Map());

// Filter options stores
export const pathogens = writable<Set<string>>(new Set());
export const ageGroups = writable<Set<string>>(new Set());
export const syndromes = writable<Set<string>>(new Set());

// Selected filters stores
export const selectedPathogens = writable<Set<string>>(new Set());
export const selectedAgeGroups = writable<Set<string>>(new Set());
export const selectedSyndromes = writable<Set<string>>(new Set());

// GeoJSON data store
export const pointsData = writable<PointFeatureCollection>({
  type: 'FeatureCollection',
  features: []
});

// Cache for previously filtered results
const filterCache = new Map<string, number[]>();

// Loading and error states
export const isLoading = writable<boolean>(false);
export const dataError = writable<string | null>(null);

// Helper to get cache key for current filters
function getFilterCacheKey(pathogens: Set<string>, ageGroups: Set<string>, syndromes: Set<string>): string {
  return JSON.stringify({
    p: Array.from(pathogens).sort(),
    a: Array.from(ageGroups).sort(),
    s: Array.from(syndromes).sort()
  });
}

// Filtered indices based on selections
export const filteredIndices = derived(
  [selectedPathogens, selectedAgeGroups, selectedSyndromes, pathogenIndex, ageGroupIndex, syndromeIndex],
  ([$selectedPathogens, $selectedAgeGroups, $selectedSyndromes, $pathogenIndex, $ageGroupIndex, $syndromeIndex]) => {
    // If no filters are selected, return all indices
    const noPathogenFilter = $selectedPathogens.size === 0;
    const noAgeGroupFilter = $selectedAgeGroups.size === 0;
    const noSyndromeFilter = $selectedSyndromes.size === 0;

    if (noPathogenFilter && noAgeGroupFilter && noSyndromeFilter) {
      return null; // Null means "all features"
    }

    // Check cache first
    const cacheKey = getFilterCacheKey($selectedPathogens, $selectedAgeGroups, $selectedSyndromes);
    if (filterCache.has(cacheKey)) {
      return filterCache.get(cacheKey)!;
    }

    // Calculate filtered indices using our index structures
    let matchingIndices: Set<number> | null = null;

    // Apply pathogen filter
    if (!noPathogenFilter) {
      matchingIndices = new Set<number>();
      for (const pathogen of $selectedPathogens) {
        const indices = $pathogenIndex.get(pathogen);
        if (indices) {
          for (const idx of indices) {
            matchingIndices.add(idx);
          }
        }
      }
    }

    // Apply age group filter
    if (!noAgeGroupFilter) {
      const ageGroupMatches = new Set<number>();
      for (const ageGroup of $selectedAgeGroups) {
        const indices = $ageGroupIndex.get(ageGroup);
        if (indices) {
          for (const idx of indices) {
            ageGroupMatches.add(idx);
          }
        }
      }

      if (matchingIndices === null) {
        matchingIndices = ageGroupMatches;
      } else {
        // Intersection: keep only indices that are in both sets
        matchingIndices = new Set([...matchingIndices].filter(i => ageGroupMatches.has(i)));
      }
    }

    // Apply syndrome filter
    if (!noSyndromeFilter) {
      const syndromeMatches = new Set<number>();
      for (const syndrome of $selectedSyndromes) {
        const indices = $syndromeIndex.get(syndrome);
        if (indices) {
          for (const idx of indices) {
            syndromeMatches.add(idx);
          }
        }
      }

      if (matchingIndices === null) {
        matchingIndices = syndromeMatches;
      } else {
        // Intersection: keep only indices that are in both sets
        matchingIndices = new Set([...matchingIndices].filter(i => syndromeMatches.has(i)));
      }
    }

    // Convert to array and cache the result
    const result = matchingIndices ? Array.from(matchingIndices) : [];
    filterCache.set(cacheKey, result);
    return result;
  }
);

// Filtered data based on indices - this should be faster than re-filtering the entire collection
export const filteredPointsData = derived(
  [pointsData, filteredIndices],
  ([$pointsData, $filteredIndices]) => {
    // If no filters are applied (null indices), return the full dataset
    if ($filteredIndices === null) {
      return $pointsData;
    }

    // Return a new FeatureCollection with only the filtered features
    return {
      type: 'FeatureCollection',
      features: $filteredIndices.map(idx => $pointsData.features[idx])
    } as PointFeatureCollection;
  }
);

// Color mapping for pathogens
export const pathogenColors = writable<Map<string, string>>(new Map());

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

  // Update indices stores
  pathogenIndex.set(pathogenIdx);
  ageGroupIndex.set(ageGroupIdx);
  syndromeIndex.set(syndromeIdx);

  return {
    type: 'FeatureCollection',
    features
  };
}

// Generate colors for a dataset
function generateColors(uniqueValues: Set<string>): Map<string, string> {
  const colorMap = new Map<string, string>();
  const colors = [
    '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
    '#ffff33', '#a65628', '#f781bf', '#999999', '#8dd3c7',
    '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69'
  ];

  let colorIndex = 0;
  for (const value of uniqueValues) {
    colorMap.set(value, colors[colorIndex % colors.length]);
    colorIndex++;
  }

  return colorMap;
}

// Helper function to load CSV data with caching
let dataCache: PointFeatureCollection | null = null;
export async function loadPointsData(url: string): Promise<void> {
  isLoading.set(true);
  dataError.set(null);

  try {
    // Use cached data if available
    if (dataCache) {
      pointsData.set(dataCache);
      isLoading.set(false);
      return;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const text = await response.text();

    // Parse CSV data
    // @ts-ignore - Papa parse typing issue
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transform: (value: string) => value.trim()
    });

    if (result.errors && result.errors.length > 0) {
      console.warn('CSV parsing warnings:', result.errors);
    }

    if (result.data && result.data.length > 0) {
      console.log(`Loaded ${result.data.length} data points`);

      // Convert to GeoJSON (this also builds indices)
      const geoData = convertCsvToGeoJson(result.data as PointDataRow[]);
      pointsData.set(geoData);
      dataCache = geoData; // Cache the data

      // Extract unique filter values
      const pathogenSet = new Set<string>();
      const ageGroupSet = new Set<string>();
      const syndromeSet = new Set<string>();

      result.data.forEach((row: any) => {
        if (row.Pathogen) pathogenSet.add(row.Pathogen);
        if (row.Age_group) ageGroupSet.add(row.Age_group);
        if (row.Syndrome) syndromeSet.add(row.Syndrome);
      });

      // Update stores
      pathogens.set(pathogenSet);
      ageGroups.set(ageGroupSet);
      syndromes.set(syndromeSet);

      // Generate colors for pathogens
      const colorMap = generateColors(pathogenSet);
      pathogenColors.set(colorMap);

      console.log(`Data loaded with ${pathogenSet.size} pathogens, ${ageGroupSet.size} age groups, and ${syndromeSet.size} syndromes`);
    } else {
      dataError.set('No data found in CSV file');
    }
  } catch (error) {
    console.error('Error loading point data:', error);
    dataError.set(error instanceof Error ? error.message : 'Unknown error loading data');
  } finally {
    isLoading.set(false);
  }
}

// Function to clear filter cache when filters change significantly
export function clearFilterCache(): void {
  filterCache.clear();
}

// Helper function to get MapLibre filter expression based on current filter state
export function getMaplibreFilterExpression(): any[] {
  const $selectedPathogens = get(selectedPathogens);
  const $selectedAgeGroups = get(selectedAgeGroups);
  const $selectedSyndromes = get(selectedSyndromes);

  const noPathogenFilter = $selectedPathogens.size === 0;
  const noAgeGroupFilter = $selectedAgeGroups.size === 0;
  const noSyndromeFilter = $selectedSyndromes.size === 0;

  // If no filters are selected, return a filter that matches everything
  if (noPathogenFilter && noAgeGroupFilter && noSyndromeFilter) {
    return ['all'];
  }

  const filters = [];

  // Add pathogen filter
  if (!noPathogenFilter) {
    filters.push(['in', ['get', 'pathogen'], ['literal', Array.from($selectedPathogens)]]);
  }

  // Add age group filter
  if (!noAgeGroupFilter) {
    filters.push(['in', ['get', 'ageGroup'], ['literal', Array.from($selectedAgeGroups)]]);
  }

  // Add syndrome filter
  if (!noSyndromeFilter) {
    filters.push(['in', ['get', 'syndrome'], ['literal', Array.from($selectedSyndromes)]]);
  }

  // Combine all filters with 'all' operator
  return ['all', ...filters];
}
