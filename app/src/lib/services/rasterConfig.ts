import type { RasterLayerMetadata } from '$lib/types';

export interface RasterLayerConfig {
  name: string;
  path: string;
  type: 'Pathogen' | 'Risk Factor';
  // Pathogen-specific fields (used for filter mapping)
  pathogen?: string;
  ageGroup?: string;
  syndrome?: string;
  // Risk factor categorization
  category?: 'Housing' | 'Animal Intervention' | string;
  // Metadata fields
  indicator?: string;
  definition?: string;
  period?: string;
  study?: string;
  source?: string;
  hyperlink?: string;
}

export interface RasterConfig {
  layers: RasterLayerConfig[];
}

const baseRasterUrl = import.meta.env.VITE_RASTER_BASE_URL || 'https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/';

let cachedConfig: RasterConfig | null = null;

/**
 * Fetch and parse raster-layers.json from the data directory.
 * Returns cached result on subsequent calls within the same page load.
 */
export async function loadRasterConfig(): Promise<RasterConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const response = await fetch(`${baseRasterUrl}raster-layers.json`);
    if (!response.ok) {
      console.warn(`Failed to load raster-layers.json (${response.status}). No raster layers will be available.`);
      cachedConfig = { layers: [] };
      return cachedConfig;
    }
    cachedConfig = await response.json();
    return cachedConfig!;
  } catch (err) {
    console.warn('Could not fetch raster-layers.json:', err);
    cachedConfig = { layers: [] };
    return cachedConfig;
  }
}

/** Build a full source URL from a layer's relative path */
export function getLayerSourceUrl(layerPath: string): string {
  return `${baseRasterUrl}${layerPath}`;
}

/** Generate a stable layer ID from a layer's relative path */
export function getLayerId(layerPath: string): string {
  const sourceUrl = getLayerSourceUrl(layerPath);
  return `cog-${sourceUrl.replace(/[\/\.]/g, '-')}`;
}

/** Convert a RasterLayerConfig to RasterLayerMetadata */
export function configToMetadata(config: RasterLayerConfig): RasterLayerMetadata {
  return {
    type: config.type,
    variableName: config.pathogen || config.category || config.name,
    fileName: config.path.split('/').pop()?.replace(/\.tif$/i, '') || config.name,
    ageGroup: config.ageGroup,
    syndrome: config.syndrome,
    indicator: config.indicator,
    definition: config.definition,
    period: config.period,
    study: config.study,
    source: config.study,
    hyperlink: config.hyperlink
  };
}
