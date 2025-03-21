import type { Feature, FeatureCollection, Point } from 'geojson';

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

// Type for feature indices used in filtering
export type FeatureIndex = Map<string, Set<number>>;
