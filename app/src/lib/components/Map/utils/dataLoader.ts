import { isLoading, dataError, pointsData, pathogenColors } from '$lib/stores/data.store';
import {
  pathogens,
  ageGroups,
  syndromes,
  selectedPathogens,
  selectedAgeGroups,
  selectedSyndromes
} from '$lib/stores/filter.store';
import { convertCsvToGeoJson } from './geoJsonConverter';
import { generateColors } from './colorManager';
import Papa from 'papaparse';
import type { ParseResult, ParseConfig } from 'papaparse';
import type { PointDataRow, PointFeatureCollection } from '$lib/types';

// Helper function to load CSV data with caching
let dataCache: PointFeatureCollection | null = null;

export async function loadPointsData(url: string, forceReload: boolean = false): Promise<void> {
  // console.log('loadPointsData called with URL:', url);
  isLoading.set(true);
  dataError.set(null);

  try {
    // Log the current state of filters before loading data
    // console.log('Loading data with filters:', {
    //   pathogens: Array.from(get(selectedPathogens)),
    //   ageGroups: Array.from(get(selectedAgeGroups)),
    //   syndromes: Array.from(get(selectedSyndromes))
    // });

    // Use cached data if available and not forcing reload
    if (dataCache && !forceReload) {
      console.log('Using cached data');
      pointsData.set(dataCache);
      isLoading.set(false);
      return;
    }

    // console.log('Fetching fresh data from:', url);

    // console.log('Fetching from URL:', url);
    const response = await fetch(url);
    // console.log('Response status:', response.status, response.ok);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    let csvText = await response.text();
    // console.log('CSV text length:', csvText.length);
    
    // Remove BOM if present
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
      // console.log('Removed BOM from CSV');
    }
    
    // Detect delimiter by checking first line
    const firstLine = csvText.split('\n')[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

    // Configure standard Papa Parse with proper typing
    const parseConfig: ParseConfig<PointDataRow> = {
      header: true,
      skipEmptyLines: true,
      delimiter: delimiter,
      quoteChar: '"',
      dynamicTyping: true, // Convert numerical values
      transform: (value, field) => {
        if (typeof value === 'string') {
          // Keep markdown formatting for display purposes
          // The __ markers will be converted to italics in the UI
          return value.trim();
        }
        return value;
      }
    };

    // Parse the CSV data using standard parsing
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

      // Extract unique filter values with validation and sorting info
      const pathogenSet = new Set<string>();
      const ageGroupMap = new Map<string, string>(); // label -> val for sorting
      const syndromeMap = new Map<string, string>(); // label -> val for sorting

      // Debug: Log first few rows to see actual data (disabled)
      // console.log('First 3 rows of CSV data:', result.data.slice(0, 3));

      // Validate data before adding to sets
      result.data.forEach((row: any) => {
        // Check if this is actually CSV data (has expected fields)
        if (row && typeof row === 'object') {
          
          // Extract pathogen
          if (row.Pathogen && typeof row.Pathogen === 'string') {
            pathogenSet.add(row.Pathogen);
          }

          // Extract age group with sorting value
          if (row.AGE_LAB && typeof row.AGE_LAB === 'string') {
            ageGroupMap.set(row.AGE_LAB, row.AGE_VAL || '');
          }

          // Extract syndrome with sorting value
          if (row.SYNDROME_LAB && typeof row.SYNDROME_LAB === 'string') {
            syndromeMap.set(row.SYNDROME_LAB, row.SYNDROME_VAL || '');
          }
        }
      });
      
      // Sort age groups and syndromes based on VAL field
      const sortByVal = (map: Map<string, string>): Set<string> => {
        const sorted = Array.from(map.entries()).sort((a, b) => {
          const valA = a[1]; // VAL field
          const valB = b[1];
          
          // Extract numeric prefix if present (e.g., "01" from "01_Age_PSAC")
          const numA = valA ? parseInt(valA.split('_')[0]) || 999 : 999;
          const numB = valB ? parseInt(valB.split('_')[0]) || 999 : 999;
          
          if (numA !== numB) {
            return numA - numB;
          }
          
          // If no VAL fields or equal, sort alphabetically by label
          return a[0].localeCompare(b[0]);
        });
        
        return new Set(sorted.map(entry => entry[0]));
      };
      
      const ageGroupSet = sortByVal(ageGroupMap);
      const syndromeSet = sortByVal(syndromeMap);

      // console.log('Extracted unique values from data:', {
      //   pathogens: Array.from(pathogenSet),
      //   ageGroups: Array.from(ageGroupSet),
      //   syndromes: Array.from(syndromeSet)
      // });

      // If we have no valid data, the CSV parsing is probably not working correctly
      if (pathogenSet.size === 0 && ageGroupSet.size === 0 && syndromeSet.size === 0) {
        console.error('No valid data found in parsed CSV. Parser may have misinterpreted the file format.');
        throw new Error('Failed to parse valid data from CSV file');
      }

      // Ensure Shigella and Campylobacter are always available as pathogen options
      // since we have raster layers for them
      // Use the same format as in the data (with __ markers for italics)
      pathogenSet.add('__Shigella__');
      pathogenSet.add('__Campylobacter__');

      // Check if Campylobacter (without spp.) exists in the data
      const hasCampylobacter = Array.from(pathogenSet).some(p =>
        p.toLowerCase().includes('campylobacter') && p !== 'Campylobacter spp.');

      // console.log('Campylobacter check:', {
      //   hasCampylobacter,
      //   campylobacterVariants: Array.from(pathogenSet).filter(p => p.toLowerCase().includes('campylobacter'))
      // });

      // console.log('Added Shigella spp. and Campylobacter spp. to pathogens set. Current pathogens:', Array.from(pathogenSet));

      // Don't add duplicate age groups, we'll handle this in the UI
      // console.log('Current age groups from data:', Array.from(ageGroupSet));

      // Ensure syndromes needed for raster layers are available
      syndromeSet.add('Asymptomatic');
      // console.log('Added syndromes for raster layers. Current syndromes:', Array.from(syndromeSet));

      // Update stores
      // console.log('Setting stores with:', {
      //   pathogens: Array.from(pathogenSet),
      //   ageGroups: Array.from(ageGroupSet),
      //   syndromes: Array.from(syndromeSet)
      // });
      pathogens.set(pathogenSet);
      ageGroups.set(ageGroupSet);
      syndromes.set(syndromeSet);

      // Generate colors for pathogens
      const colorMap = generateColors(pathogenSet);
      pathogenColors.set(colorMap);

      // Check for Campylobacter variants in the data
      if (!hasCampylobacter) {
        // Find any Campylobacter variant in the data
        const campyVariant = Array.from(pathogenSet).find(p =>
          p.toLowerCase().includes('campylobacter') && p !== 'Campylobacter spp.');
        
        if (campyVariant) {
          console.log(`Found Campylobacter variant in data: ${campyVariant}`);
          // The filter store will handle mapping between variants
        }
      }

      // console.log(`Data loaded with ${pathogenSet.size} pathogens, ${ageGroupSet.size} age groups, and ${syndromeSet.size} syndromes`);
      // console.log('All pathogens:', Array.from(pathogenSet));
    } else {
      dataError.set('No data found in CSV file');
    }
  } catch (error) {
    console.error('Error loading point data:', error);
    console.error('Full error details:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    dataError.set(error instanceof Error ? error.message : 'Unknown error loading data');
  } finally {
    isLoading.set(false);
  }
}
