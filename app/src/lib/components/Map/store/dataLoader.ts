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
import Papa from 'papaparse';
import type { ParseResult, ParseConfig } from 'papaparse';
import type { PointDataRow, PointFeatureCollection } from './types';

// Helper function to load CSV data with caching
let dataCache: PointFeatureCollection | null = null;

export async function loadPointsData(url: string, forceReload: boolean = false): Promise<void> {
  isLoading.set(true);
  dataError.set(null);

  try {
    // Use cached data if available and not forcing reload
    if (dataCache && !forceReload) {
      pointsData.set(dataCache);
      isLoading.set(false);
      return;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const csvText = await response.text();

    // Configure standard Papa Parse with proper typing
    const parseConfig: ParseConfig<PointDataRow> = {
      header: true,
      skipEmptyLines: true,
      delimiter: ',',
      quoteChar: '"',
      dynamicTyping: true, // Convert numerical values
      transform: (value) => (typeof value === 'string' ? value.trim() : value)
    };

    // Parse the CSV data using standard parsing
    // console.log("Parsing CSV file...");
    const result: ParseResult<PointDataRow> = Papa.parse(csvText, parseConfig);

    // Log any parsing warnings but continue processing
    if (result.errors && result.errors.length > 0) {
      console.warn(`CSV parsing warnings: ${result.errors.length} issues found`);

      // Log a sample of errors for debugging
      if (result.errors.length > 0) {
        console.warn('Sample errors:', result.errors.slice(0, 3));
      }
    }

    if (result.data && result.data.length > 0) {
      // console.log(`Successfully loaded ${result.data.length} data points`);

      // Convert to GeoJSON (this also builds indices)
      const geoData = convertCsvToGeoJson(result.data as PointDataRow[]);
      pointsData.set(geoData);
      dataCache = geoData; // Cache the data

      // Extract unique filter values with validation
      const pathogenSet = new Set<string>();
      const ageGroupSet = new Set<string>();
      const syndromeSet = new Set<string>();

      // Validate data before adding to sets
      result.data.forEach((row: any) => {
        // Check if this is actually CSV data (has expected fields) and not CSS/HTML/other content
        if (row && typeof row === 'object') {
          // Check if fields exist and look like valid data (not CSS/HTML)
          if (row.Pathogen && typeof row.Pathogen === 'string') {
            pathogenSet.add(row.Pathogen);
          }

          if (row.Age_group && typeof row.Age_group === 'string') {
            ageGroupSet.add(row.Age_group);
          }

          if (row.Syndrome && typeof row.Syndrome === 'string') {
            syndromeSet.add(row.Syndrome);
          }
        }
      });

      // If we have no valid data, the CSV parsing is probably not working correctly
      if (pathogenSet.size === 0 && ageGroupSet.size === 0 && syndromeSet.size === 0) {
        console.error('No valid data found in parsed CSV. Parser may have misinterpreted the file format.');
        throw new Error('Failed to parse valid data from CSV file');
      }

      // Ensure Shigella is always available as a pathogen option
      // since we have raster layers for it
      pathogenSet.add('Shigella spp.');
      console.log('Added Shigella spp. to pathogens set. Current pathogens:', Array.from(pathogenSet));

      // Don't add duplicate age groups, we'll handle this in the UI
      // console.log('Current age groups from data:', Array.from(ageGroupSet));

      // Ensure syndromes needed for raster layers are available
      syndromeSet.add('Asymptomatic');
      syndromeSet.add('Community');
      syndromeSet.add('Medical');
      // console.log('Added syndromes for raster layers. Current syndromes:', Array.from(syndromeSet));

      // Update stores
      pathogens.set(pathogenSet);
      ageGroups.set(ageGroupSet);
      syndromes.set(syndromeSet);

      // Generate colors for pathogens
      const colorMap = generateColors(pathogenSet);
      pathogenColors.set(colorMap);

      console.log(`Data loaded with ${pathogenSet.size} pathogens, ${ageGroupSet.size} age groups, and ${syndromeSet.size} syndromes`);
      console.log('All pathogens:', Array.from(pathogenSet));
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
