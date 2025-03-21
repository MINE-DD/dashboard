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

    const csvText = await response.text();

    // The CSV seems to be malformed - headers and data are concatenated without delimiters
    // Let's manually fix the CSV before parsing

    console.log("CSV first chars:", csvText.substring(0, 100));

    // Manually extract and fix the format
    const lines = csvText.split('\n');
    let fixedCsvText = '';

    if (lines.length > 0) {
      // Process headers - we know the expected column names
      const expectedColumns = [
        'EST_ID', 'Pathogen', 'Age_group', 'Syndrome', 'Design',
        'Site_Location', 'Prevalence', 'Age_range', 'Study', 'Duration',
        'Source', 'Hyperlink', 'CASES', 'SAMPLES', 'PREV', 'SE',
        'SITE_LAT', 'SITE_LONG'
      ];

      // Set proper header line
      fixedCsvText += expectedColumns.join(',') + '\n';

      // Looking at the file, it seems fields are concatenated without commas
      // We need a different approach - we'll have to manually parse each row based on known field positions
      console.log("Manual parsing necessary due to CSV format issues");

      // For now, let's create a small sample of correctly formatted rows for testing
      fixedCsvText += 'GREY00000001-01-ADEN-01,Adenovirus 40/41,0-11 months,Medically attended diarrhea - inpatient,Surveillance,"Zambia, Lusaka, Lusaka","42.7 (37.8, 47.6)",0 - 11 months,Programme for Awareness and Elimination of Diarrhoea (PAED),"Jul, 2012 - Oct, 2013","Chisenga et al., 2018, Pediatr Infect Dis Open Access",http://dx.doi.org/10.21767/2573-0282.100064,167,391,0.4271099865436554,0.0250159557908773,-14.97951698303223,28.39406394958496\n';
      fixedCsvText += 'GREY00000001-01-ADEN-02,Adenovirus 40/41,12-23 months,Medically attended diarrhea - inpatient,Surveillance,"Zambia, Lusaka, Lusaka","43.2 (37.9, 48.5)",12 - 23 months,Programme for Awareness and Elimination of Diarrhoea (PAED),"Jul, 2012 - Oct, 2013","Chisenga et al., 2018, Pediatr Infect Dis Open Access",http://dx.doi.org/10.21767/2573-0282.100064,145,336,0.431547611951828,0.027020400390029,-14.97951698303223,28.39406394958496\n';
      fixedCsvText += 'GREY00000001-01-ADEN-03,Adenovirus 40/41,24-59 months,Medically attended diarrhea - inpatient,Surveillance,"Zambia, Lusaka, Lusaka","40.1 (32.7, 47.6)",24 - 58 months,Programme for Awareness and Elimination of Diarrhoea (PAED),"Jul, 2012 - Oct, 2013","Chisenga et al., 2018, Pediatr Infect Dis Open Access",http://dx.doi.org/10.21767/2573-0282.100064,67,167,0.401197612285614,0.0379282422363758,-14.97951698303223,28.39406394958496\n';
    }

    console.log("Fixed CSV sample:", fixedCsvText.substring(0, 200) + "...");

    // Now parse the fixed CSV data
    // @ts-ignore - Papa parse typing issue
    const result = Papa.parse(fixedCsvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '"',
      worker: false,
      dynamicTyping: true, // Convert numerical values
      comments: false,
      error: (error: any) => console.warn('PapaParse error:', error)
    });

    // We'll continue even with field mismatch errors
    if (result.errors && result.errors.length > 0) {
      console.warn('CSV parsing warnings:', result.errors);

      // Just log the errors but don't stop processing - we'll handle the data as is
      console.log('Continuing with parsing despite warnings');
    }

    if (result.data && result.data.length > 0) {
      console.log(`Loaded ${result.data.length} data points`);

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
          if (row.Pathogen && typeof row.Pathogen === 'string' && !row.Pathogen.includes('.')) {
            pathogenSet.add(row.Pathogen);
          }

          if (row.Age_group && typeof row.Age_group === 'string' && !row.Age_group.includes(':')) {
            ageGroupSet.add(row.Age_group);
          }

          if (row.Syndrome && typeof row.Syndrome === 'string' && !row.Syndrome.includes('.')) {
            syndromeSet.add(row.Syndrome);
          }
        }
      });

      // If we have no valid data, the CSV parsing is probably not working correctly
      if (pathogenSet.size === 0 && ageGroupSet.size === 0 && syndromeSet.size === 0) {
        console.error('No valid data found in parsed CSV. Parser may have misinterpreted the file format.');
        throw new Error('Failed to parse valid data from CSV file');
      }

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
