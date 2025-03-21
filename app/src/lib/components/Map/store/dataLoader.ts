import {
  isLoading,
  dataError,
  pointsData,
  pathogens,
  ageGroups,
  syndromes,
  pathogenColors
} from './stores';
import { convertCsvToGeoJson } from './geoJsonConverter';
import { generateColors } from './colorManager';
import { Papa } from './csvLoader';
import type { PointDataRow, PointFeatureCollection } from './types';

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
