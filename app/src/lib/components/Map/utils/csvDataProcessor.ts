/**
 * Utility functions for processing CSV data for the raster layer popup
 */

import { get } from 'svelte/store';
import { pointsData } from '../store'; // Assuming pointsData is in store/index.ts or data.store.ts
import type { PointFeature, PointProperties } from '$lib/types';

// calculateDistance can remain as it's a generic utility
/**
 * Calculate the distance between two points using the Haversine formula
 * @param lng1 Longitude of point 1
 * @param lat1 Latitude of point 1
 * @param lng2 Longitude of point 2
 * @param lat2 Latitude of point 2
 * @returns The distance in kilometers
 */
function calculateDistance(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

/**
 * Calculate confidence interval for a prevalence value
 * @param prevalence The prevalence value (0-100)
 * @param standardError The standard error value (0-100)
 * @returns An object with lower and upper bounds
 */
export function calculateConfidenceInterval(prevalence: number, standardError: number): {
  lower: number,
  upper: number
} {
  // Calculate 95% confidence interval (1.96 * SE)
  const margin = 1.96 * standardError;

  // Calculate lower and upper bounds
  let lower = prevalence - margin;
  let upper = prevalence + margin;

  // Ensure bounds are within 0-100 range
  lower = Math.max(0, lower);
  upper = Math.min(100, upper);

  return { lower, upper };
}

/**
 * Find the closest point feature from the main data store.
 * @param allPointFeatures Array of PointFeature from the pointsData store.
 * @param coordinates The clicked coordinates [lng, lat].
 * @param targetPathogen The pathogen to filter by.
 * @param targetAgeGroup The age group to filter by.
 * @returns The properties of the closest matching point, or null.
 */
function findClosestPointFeature(
  allPointFeatures: PointFeature[],
  coordinates: [number, number],
  targetPathogen: string,
  targetAgeGroup: string
): PointProperties | null {
  if (!allPointFeatures || allPointFeatures.length === 0) {
    return null;
  }

  const [lng, lat] = coordinates;
  let closestPointProps: PointProperties | null = null;
  let minDistance = Infinity;

  for (const feature of allPointFeatures) {
    if (
      feature.properties &&
      feature.geometry &&
      feature.geometry.type === 'Point' &&
      feature.properties.pathogen === targetPathogen &&
      feature.properties.ageGroup === targetAgeGroup
    ) {
      const pointLng = feature.geometry.coordinates[0];
      const pointLat = feature.geometry.coordinates[1];
      const distance = calculateDistance(lng, lat, pointLng, pointLat);

      if (distance < minDistance) {
        minDistance = distance;
        closestPointProps = feature.properties;
      }
    }
  }
  return closestPointProps;
}


/**
 * Process pathogen data for a specific location
 * @param pathogen The pathogen name
 * @param coordinates The coordinates [lng, lat]
 * @param ageRange The age range (maps to ageGroup in PointProperties)
 * @param syndrome The syndrome (currently unused in this revised logic but kept for signature consistency)
 * @returns The processed data for the popup
 */
export async function processPathogenData(
  pathogen: string,
  coordinates: [number, number],
  ageRange: string,
  syndrome: string // Parameter kept for signature consistency, though not used in this logic
): Promise<{
  prevalence: number;
  lowerBound: number;
  upperBound: number;
  ageRange: string;
  study: string;
  duration: string;
  source: string;
  sourceUrl: string;
}> {
  try {
    const pointsDataStore = get(pointsData);
    const allPointFeatures = pointsDataStore?.features;

    if (!allPointFeatures || allPointFeatures.length === 0) {
      console.warn('No point data loaded in store for estimations.');
      throw new Error('Point data not available for estimations.');
    }

    // Find the closest point feature matching pathogen and age group
    // 'ageRange' from the function argument corresponds to 'ageGroup' in PointProperties
    const relevantPointProps = findClosestPointFeature(
      allPointFeatures,
      coordinates,
      pathogen,
      ageRange // This is the target ageGroup for filtering
    );

    if (!relevantPointProps) {
      throw new Error(
        `No matching data point found for pathogen "${pathogen}" and age group "${ageRange}" near the clicked location.`
      );
    }

    // Extract data from the found PointProperties
    // Ensure prevalenceValue and standardError are treated as decimals (0-1) before multiplying by 100
    const prevalence = relevantPointProps.prevalenceValue * 100; // Convert to percentage
    const standardError = relevantPointProps.standardError * 100; // Convert to percentage

    const { lower, upper } = calculateConfidenceInterval(prevalence, standardError);

    return {
      prevalence,
      lowerBound: lower,
      upperBound: upper,
      ageRange: relevantPointProps.ageGroup, // Use the ageGroup from the matched point
      study: relevantPointProps.study,
      duration: relevantPointProps.duration,
      source: relevantPointProps.source,
      sourceUrl: relevantPointProps.hyperlink
    };
  } catch (error) {
    console.error('Error processing pathogen data from pointsData store:', error);
    // Return default values if data processing fails, or rethrow if preferred
    // For now, matching the old behavior of returning defaults:
    return {
      prevalence: 10.96, // Default placeholder
      lowerBound: 8.65,  // Default placeholder
      upperBound: 13.27, // Default placeholder
      ageRange: ageRange || '0-11 months', // Use input or a default
      study: `Spatiotemporal model of ${pathogen}`, // Placeholder
      duration: 'annual average for 2018', // Placeholder
      source: 'Badr, Colston et al. 2023 Lancet Glob Health', // Placeholder
      sourceUrl: 'https://www.thelancet.com/journals/langlo/article/PIIS2214-109X(23)00126-2/fulltext' // Placeholder
    };
  }
}

// The old loadCsvData, SourceInfo, SiteInfo, PathogenData, dataCache, and findClosestSite
// are removed as they were part of the logic fetching from excel_csv_exports.
// If loadCsvData is used elsewhere for other CSVs, it should be kept or moved.
// For this specific task, they are assumed to be replaced by the pointsData store logic.
// PapaParse import is also removed if loadCsvData is fully removed.
// For now, to minimize disruption if loadCsvData IS used elsewhere, I will comment out the old unused parts
// instead of fully deleting them. A follow-up cleanup could remove them if confirmed unused.

/*
import Papa from 'papaparse';
import type { ParseResult, ParseConfig } from 'papaparse';

// Define interfaces for the CSV data
interface SourceInfo {
  SOURCE_ID: string;
  SOURCE_NAME: string;
  SOURCE_AUTHOR: string;
  SOURCE_YEAR: string;
  SOURCE_PUB: string;
  SOURCE_URL: string;
  SOURCE_DESIGN: string;
}

interface SiteInfo {
  SITE_ID: string;
  SITE_COUNTRY: string;
  SITE_ADMIN1: string;
  SITE_LAT: number;
  SITE_LONG: number;
  SITE_START: string;
  SITE_END: string;
}

interface PathogenData {
  SITE_ID: string;
  SOURCE_ID: string;
  [key: string]: any; // For dynamic pathogen-specific fields
}

// Cache for loaded CSV data
const dataCache: Record<string, any[]> = {};

// Load CSV data from a file
// @param url The URL of the CSV file
// @returns The parsed CSV data
export async function loadCsvData<T>(url: string, forceReload: boolean = false): Promise<T[]> {
  // Use cached data if available and not forcing reload
  if (dataCache[url] && !forceReload) {
    return dataCache[url] as T[];
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const csvText = await response.text();

    // Configure Papa Parse
    const parseConfig: ParseConfig = {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true, // Convert numerical values
      transform: (value) => (typeof value === 'string' ? value.trim() : value)
    };

    // Parse the CSV data
    const result: ParseResult<T> = Papa.parse(csvText, parseConfig);

    if (result.errors && result.errors.length > 0) {
      console.warn(`CSV parsing warnings: ${result.errors.length} issues found`);
      console.warn('Sample errors:', result.errors.slice(0, 3));
    }

    if (result.data && result.data.length > 0) {
      // Cache the data
      dataCache[url] = result.data as any[];
      return result.data as T[];
    } else {
      throw new Error('No data found in CSV file');
    }
  } catch (error) {
    console.error('Error loading CSV data:', error);
    throw error;
  }
}
*/
