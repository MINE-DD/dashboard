import { derived, get, writable } from 'svelte/store';
import type { FilterToRasterMapping } from '$lib/types';
import {
  selectedPathogens,
  selectedAgeGroups,
  selectedSyndromes,
  ageGroupValToLab,
  syndromeValToLab
} from '$lib/stores/filter.store';
import {
  rasterLayers,
  updateRasterLayerVisibility,
  updateRasterLayerIsActive
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
  [selectedPathogens, selectedAgeGroups, selectedSyndromes, ageGroupValToLab, syndromeValToLab],
  ([$selectedPathogens, $selectedAgeGroups, $selectedSyndromes, $ageGroupValToLab, $syndromeValToLab]) => {
    // If no filters are selected, no layers should be auto-shown
    if ($selectedPathogens.size === 0 && $selectedAgeGroups.size === 0 && $selectedSyndromes.size === 0) {
      return new Set<string>();
    }

    // Find all layer IDs that match the current filter selections
    const matchingLayerIds = new Set<string>();

    // Convert selected VAL values to LAB values for comparison
    const selectedAgeGroupLabs = new Set<string>();
    $selectedAgeGroups.forEach(val => {
      const lab = $ageGroupValToLab.get(val);
      if (lab) {
        // Remove ^^ prefix if present for comparison
        selectedAgeGroupLabs.add(lab.replace('^^', ''));
      }
    });

    const selectedSyndromeLabs = new Set<string>();
    $selectedSyndromes.forEach(val => {
      const lab = $syndromeValToLab.get(val);
      if (lab) {
        // Remove ^^ prefix if present for comparison
        selectedSyndromeLabs.add(lab.replace('^^', ''));
      }
    });

    // Check each mapping against the current filter selections
    filterToRasterMappings.forEach(mapping => {
      const pathogenMatch = $selectedPathogens.has(mapping.pathogen);
      
      // Check for age group match using LAB values
      const ageGroupMatch = selectedAgeGroupLabs.has(mapping.ageGroup);
      
      // Check for syndrome match using LAB values
      const syndromeMatch = selectedSyndromeLabs.has(mapping.syndrome);

      // A layer should be visible if all of its corresponding filters are selected
      if (pathogenMatch && ageGroupMatch && syndromeMatch) {
        matchingLayerIds.add(mapping.layerId);
      }
    });

    return matchingLayerIds;
  }
);

// Controls whether auto-matched raster layers are shown on the map
export const rasterVisualizationEnabled = writable(true);

// Subscribe to changes in the autoVisibleRasterLayers store and update layer visibility
let previousAutoShownLayers = new Set<string>();

// This function will be called whenever the autoVisibleRasterLayers store changes
export function initFilterRasterConnection() {
  return autoVisibleRasterLayers.subscribe(($autoVisibleRasterLayers) => {
    const enabled = get(rasterVisualizationEnabled);
    const currentLayers = get(rasterLayers);

    // Deactivate layers that are no longer matched by the current filter selection
    previousAutoShownLayers.forEach(layerId => {
      if (!$autoVisibleRasterLayers.has(layerId)) {
        const layer = currentLayers.get(layerId);
        if (layer && layer.autoShown) {
          updateRasterLayerVisibility(layerId, false);
          updateRasterLayerIsActive(layerId, false);
          rasterLayers.update(layers => {
            const l = layers.get(layerId);
            if (l) l.autoShown = false;
            return new Map(layers);
          });
        }
      }
    });

    // Activate newly matched layers; only show on map if the toggle is on
    $autoVisibleRasterLayers.forEach(layerId => {
      const layer = currentLayers.get(layerId);
      if (layer && !layer.autoShown) {
        if (enabled) updateRasterLayerVisibility(layerId, true);
        updateRasterLayerIsActive(layerId, true);
        rasterLayers.update(layers => {
          const l = layers.get(layerId);
          if (l) l.autoShown = true;
          return new Map(layers);
        });
      }
    });

    previousAutoShownLayers = new Set($autoVisibleRasterLayers);
  });
}
