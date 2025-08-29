/**
 * Runtime utility to read the data manifest generated at build time
 */

const R2_BASE_URL = import.meta.env.VITE_R2_POINTS_BASE_URL || 'https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/01_Points';

export interface DataFile {
  date: string;
  fileName: string;
  size: number;
  lastModified: string;
}

export interface DataManifest {
  generated: string;
  source: string;
  latestFile?: DataFile;
  files: DataFile[];
}

let manifestCache: DataManifest | null = null;

/**
 * Load the data manifest generated at build time
 */
export async function loadDataManifest(): Promise<DataManifest> {
  if (manifestCache) {
    return manifestCache;
  }

  try {
    const response = await fetch('/data-manifest.json');
    if (response.ok) {
      manifestCache = await response.json();
      console.log('Loaded data manifest:', manifestCache);
      return manifestCache;
    }
  } catch (error) {
    console.error('Failed to load data manifest:', error);
  }

  // Fallback if manifest is not available
  const fallbackManifest: DataManifest = {
    generated: new Date().toISOString(),
    source: 'fallback',
    files: [{
      date: import.meta.env.VITE_LATEST_DATA_DATE || '2025-08-25',
      fileName: `${import.meta.env.VITE_LATEST_DATA_DATE || '2025-08-25'}_Plan-EO_Dashboard_point_data.csv`,
      size: 0,
      lastModified: ''
    }]
  };
  
  manifestCache = fallbackManifest;
  return fallbackManifest;
}

/**
 * Get the latest data file URL from the manifest
 */
export async function getLatestDataFromManifest(): Promise<{ url: string; date: string }> {
  const manifest = await loadDataManifest();
  const latestFile = manifest.latestFile || manifest.files[0];
  
  if (!latestFile) {
    // Ultimate fallback
    const date = '2025-08-25';
    return {
      url: `${R2_BASE_URL}/${date}_Plan-EO_Dashboard_point_data.csv`,
      date
    };
  }
  
  return {
    url: `${R2_BASE_URL}/${latestFile.fileName}`,
    date: latestFile.date
  };
}

/**
 * Get all available data files from the manifest
 */
export async function getAvailableDataFiles(): Promise<DataFile[]> {
  const manifest = await loadDataManifest();
  return manifest.files;
}