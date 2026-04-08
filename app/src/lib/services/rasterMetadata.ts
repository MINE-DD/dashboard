/**
 * Service for managing raster layer metadata.
 * Metadata is loaded from raster-layers.json via rasterConfig.
 */

export interface RasterMetadata {
  type: 'Pathogen' | 'Risk Factor';
  variableName: string;
  fileName: string;
  ageGroup?: string;
  syndrome?: string;
  indicator: string;
  definition: string;
  period: string;
  study: string;
  source: string;
  hyperlink: string;
}

import { loadRasterConfig, configToMetadata } from '$lib/services/rasterConfig';

// Map of file names (without extension) to metadata
let metadataMap = new Map<string, RasterMetadata>();
let initialized = false;

/**
 * Load metadata from raster-layers.json config.
 * Called once at app startup.
 */
export async function initRasterMetadata(): Promise<void> {
  if (initialized) return;

  const config = await loadRasterConfig();
  metadataMap = new Map();

  for (const layer of config.layers) {
    const meta = configToMetadata(layer) as RasterMetadata;
    const fileName = layer.path.split('/').pop()?.replace(/\.tif$/i, '') || '';
    if (fileName) {
      metadataMap.set(fileName, meta);
    }
  }

  initialized = true;
}

/**
 * Get metadata for a raster layer by file name
 */
export function getRasterMetadata(fileName: string): RasterMetadata | undefined {
  if (metadataMap.has(fileName)) {
    return metadataMap.get(fileName);
  }

  const fileNameMatch = fileName.match(/([^/]+)\.(tif|tiff)$/i);
  if (fileNameMatch) {
    const baseName = fileNameMatch[1];
    return metadataMap.get(baseName);
  }

  return undefined;
}

/**
 * Get metadata by matching the source URL
 */
export function getRasterMetadataByUrl(sourceUrl: string): RasterMetadata | undefined {
  const urlParts = sourceUrl.split('/');
  const fileNameWithExt = urlParts[urlParts.length - 1];
  const fileName = fileNameWithExt.replace(/\.(tif|tiff)$/i, '');
  return getRasterMetadata(fileName);
}
