/**
 * Utility functions for processing raster layer data
 */

/**
 * Extract pathogen, age group, and syndrome information from a layer name
 * @param layerName The name of the raster layer
 * @returns An object with pathogen, ageGroup, and syndrome
 */
export function extractLayerInfo(layerName: string): {
  pathogen: string;
  ageGroup: string;
  syndrome: string;
} {
  // Default values - empty strings indicate no match found
  let pathogen = '';
  let ageGroup = '';
  let syndrome = '';

  // Example layer name: "SHIG 0-11 Asym Pr"
  // Parse the layer name to extract information

  // Extract pathogen - use cleaned data format without markdown
  if (layerName.includes('SHIG')) {
    pathogen = 'Shigella';
  } else if (layerName.includes('ROTA')) {
    pathogen = 'Rotavirus';
  } else if (layerName.includes('NORO')) {
    pathogen = 'Norovirus';
  } else if (layerName.includes('CAMP')) {
    pathogen = 'Campylobacter';
  }

  // Extract age group
  if (layerName.includes('0011') || layerName.includes('0-11')) {
    ageGroup = '0-11 months';
  } else if (layerName.includes('1223') || layerName.includes('12-23')) {
    ageGroup = '12-23 months';
  } else if (layerName.includes('2459') || layerName.includes('24-59')) {
    ageGroup = '24-59 months';
  }

  // Extract syndrome
  if (layerName.includes('Asym')) {
    syndrome = 'Asymptomatic';
  } else if (layerName.includes('Comm')) {
    syndrome = 'Community';
  } else if (layerName.includes('Medi')) {
    syndrome = 'Medical';
  }

  return { pathogen, ageGroup, syndrome };
}
