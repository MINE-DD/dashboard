import { derived, get } from 'svelte/store';
import type { FilterToRasterMapping } from '$lib/types';
import {
  selectedPathogens,
  selectedAgeGroups,
  selectedSyndromes
} from '$lib/stores/filter.store';
import {
  rasterLayers,
  updateRasterLayerVisibility
} from '$lib/stores/raster.store';

// Base URL for R2 storage
const baseR2url = 'https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/';

// Define mappings between filter values and raster layer IDs
// This maps the filter selections to the corresponding raster layers
export const filterToRasterMappings: FilterToRasterMapping[] = [
  // Shigella mappings
  // Age group 0-11 months
  { pathogen: '__Shigella__', ageGroup: '0-11 months', syndrome: 'Asymptomatic', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_0011_Asym_Pr-tif`.replace(/[\/\.]/g, '-') },
  { pathogen: '__Shigella__', ageGroup: '0-11 months', syndrome: 'Community detected diarrhea', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_0011_Comm_Pr-tif`.replace(/[\/\.]/g, '-') },
  { pathogen: '__Shigella__', ageGroup: '0-11 months', syndrome: 'Medically attended diarrhea - inpatient', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_0011_Medi_Pr-tif`.replace(/[\/\.]/g, '-') },
  { pathogen: '__Shigella__', ageGroup: '0-11 months', syndrome: 'Medically attended diarrhea - outpatient', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_0011_Medi_Pr-tif`.replace(/[\/\.]/g, '-') },

  // Age group 12-23 months
  { pathogen: '__Shigella__', ageGroup: '12-23 months', syndrome: 'Asymptomatic', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_1223_Asym_Pr-tif`.replace(/[\/\.]/g, '-') },
  { pathogen: '__Shigella__', ageGroup: '12-23 months', syndrome: 'Community detected diarrhea', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_1223_Comm_Pr-tif`.replace(/[\/\.]/g, '-') },
  { pathogen: '__Shigella__', ageGroup: '12-23 months', syndrome: 'Medically attended diarrhea - inpatient', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_1223_Medi_Pr-tif`.replace(/[\/\.]/g, '-') },
  { pathogen: '__Shigella__', ageGroup: '12-23 months', syndrome: 'Medically attended diarrhea - outpatient', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_1223_Medi_Pr-tif`.replace(/[\/\.]/g, '-') },

  // Age group 24-59 months
  { pathogen: '__Shigella__', ageGroup: '24-59 months', syndrome: 'Asymptomatic', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_2459_Asym_Pr-tif`.replace(/[\/\.]/g, '-') },
  { pathogen: '__Shigella__', ageGroup: '24-59 months', syndrome: 'Community detected diarrhea', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_2459_Comm_Pr-tif`.replace(/[\/\.]/g, '-') },
  { pathogen: '__Shigella__', ageGroup: '24-59 months', syndrome: 'Medically attended diarrhea - inpatient', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_2459_Medi_Pr-tif`.replace(/[\/\.]/g, '-') },
  { pathogen: '__Shigella__', ageGroup: '24-59 months', syndrome: 'Medically attended diarrhea - outpatient', layerId: `cog-${baseR2url}01_Pathogens-SHIG-SHIG_2459_Medi_Pr-tif`.replace(/[\/\.]/g, '-') },
];

// Create a derived store that calculates which raster layers should be visible based on filter selections
export const autoVisibleRasterLayers = derived(
  [selectedPathogens, selectedAgeGroups, selectedSyndromes, rasterLayers],
  ([$selectedPathogens, $selectedAgeGroups, $selectedSyndromes, $rasterLayers]) => {
    // If no filters are selected, no layers should be auto-shown
    if ($selectedPathogens.size === 0 && $selectedAgeGroups.size === 0 && $selectedSyndromes.size === 0) {
      return new Set<string>();
    }

    // Find all layer IDs that match the current filter selections
    const matchingLayerIds = new Set<string>();

    // Check each mapping against the current filter selections
    filterToRasterMappings.forEach(mapping => {
      const pathogenMatch = $selectedPathogens.has(mapping.pathogen);
      const ageGroupMatch = $selectedAgeGroups.has(mapping.ageGroup);
      const syndromeMatch = $selectedSyndromes.has(mapping.syndrome);

      // A layer should be visible if all of its corresponding filters are selected
      if (pathogenMatch && ageGroupMatch && syndromeMatch) {
        matchingLayerIds.add(mapping.layerId);
      }
    });

    return matchingLayerIds;
  }
);

// Subscribe to changes in the autoVisibleRasterLayers store and update layer visibility
let previousAutoShownLayers = new Set<string>();

// This function will be called whenever the autoVisibleRasterLayers store changes
export function initFilterRasterConnection() {
  return autoVisibleRasterLayers.subscribe(($autoVisibleRasterLayers) => {
    // Get the current state of all raster layers
    const currentLayers = get(rasterLayers);

    // First, handle layers that should no longer be auto-shown
    previousAutoShownLayers.forEach(layerId => {
      if (!$autoVisibleRasterLayers.has(layerId)) {
        const layer = currentLayers.get(layerId);
        if (layer && layer.autoShown) {
          // Only hide the layer if it was auto-shown (not manually toggled)
          updateRasterLayerVisibility(layerId, false);

          // Update the layer in the store to remove the autoShown flag
          rasterLayers.update(layers => {
            const layer = layers.get(layerId);
            if (layer) {
              layer.autoShown = false;
            }
            return layers;
          });
        }
      }
    });

    // Then, handle layers that should be newly auto-shown
    $autoVisibleRasterLayers.forEach(layerId => {
      const layer = currentLayers.get(layerId);
      if (layer) {
        // Only update if the layer exists and isn't already visible
        if (!layer.isVisible) {
          updateRasterLayerVisibility(layerId, true);

          // Mark this layer as auto-shown
          rasterLayers.update(layers => {
            const layer = layers.get(layerId);
            if (layer) {
              layer.autoShown = true;
            }
            return layers;
          });
        }
      }
    });

    // Update our tracking of auto-shown layers
    previousAutoShownLayers = new Set($autoVisibleRasterLayers);
  });
}
