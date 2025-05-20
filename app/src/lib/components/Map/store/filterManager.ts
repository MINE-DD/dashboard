import { derived, get } from 'svelte/store';
import {
  pointsData,
  selectedPathogens,
  selectedAgeGroups,
  selectedSyndromes,
  pathogenIndex,
  ageGroupIndex,
  syndromeIndex
} from './stores';
import type { PointFeatureCollection } from './types';

// Cache for previously filtered results
const filterCache = new Map<string, number[]>();

// Helper to get cache key for current filters
function getFilterCacheKey(pathogens: Set<string>, ageGroups: Set<string>, syndromes: Set<string>): string {
  return JSON.stringify({
    p: Array.from(pathogens).sort(),
    a: Array.from(ageGroups).sort(),
    s: Array.from(syndromes).sort()
  });
}

// Filtered indices based on selections
export const filteredIndices = derived(
  [selectedPathogens, selectedAgeGroups, selectedSyndromes, pathogenIndex, ageGroupIndex, syndromeIndex],
  ([$selectedPathogens, $selectedAgeGroups, $selectedSyndromes, $pathogenIndex, $ageGroupIndex, $syndromeIndex]) => {
    // If no filters are selected, return all indices
    const noPathogenFilter = $selectedPathogens.size === 0;
    const noAgeGroupFilter = $selectedAgeGroups.size === 0;
    const noSyndromeFilter = $selectedSyndromes.size === 0;

    // Debug information about current filters and indices
    console.log('Filter state:', {
      pathogens: Array.from($selectedPathogens),
      ageGroups: Array.from($selectedAgeGroups),
      syndromes: Array.from($selectedSyndromes),
      noPathogenFilter,
      noAgeGroupFilter,
      noSyndromeFilter,
      pathogenIndexKeys: Array.from($pathogenIndex.keys())
    });

    if (noPathogenFilter && noAgeGroupFilter && noSyndromeFilter) {
      return null; // Null means "all features"
    }

    // Check cache first
    const cacheKey = getFilterCacheKey($selectedPathogens, $selectedAgeGroups, $selectedSyndromes);
    if (filterCache.has(cacheKey)) {
      console.log('Using cached filter results for:', Array.from($selectedPathogens));
      return filterCache.get(cacheKey)!;
    }

    // Calculate filtered indices using our index structures
    let matchingIndices: Set<number> | null = null;

    // Apply pathogen filter
    if (!noPathogenFilter) {
      matchingIndices = new Set<number>();
      for (const pathogen of $selectedPathogens) {
        // Special case for Campylobacter spp. - use Campylobacter indices if needed
        let indices: Set<number> | undefined;

        // Enhanced handling for Campylobacter spp.
        if (pathogen === 'Campylobacter spp.') {
          // Try different variations of Campylobacter
          if ($pathogenIndex.has('Campylobacter spp.')) {
            indices = $pathogenIndex.get('Campylobacter spp.');
            console.log('Found exact match for Campylobacter spp.');
          } else if ($pathogenIndex.has('Campylobacter')) {
            indices = $pathogenIndex.get('Campylobacter');
            console.log('Using Campylobacter indices for Campylobacter spp.');
          } else {
            // Try to find any key that contains Campylobacter
            const campyKey = Array.from($pathogenIndex.keys()).find(k =>
              k.toLowerCase().includes('campylobacter'));

            if (campyKey) {
              indices = $pathogenIndex.get(campyKey);
              console.log(`Using ${campyKey} indices for Campylobacter spp.`);
            } else {
              console.warn('No Campylobacter-related indices found in pathogen index');
            }
          }
        } else {
          indices = $pathogenIndex.get(pathogen);
        }

        if (indices) {
          const beforeCount = matchingIndices.size;
          for (const idx of indices) {
            matchingIndices.add(idx);
          }
          console.log(`Added ${matchingIndices.size - beforeCount} indices for pathogen: ${pathogen}`);
        } else {
          console.warn(`No indices found for pathogen: ${pathogen}`);
        }
      }

      console.log(`Total matching indices after pathogen filter: ${matchingIndices.size}`);
    }

    // Apply age group filter
    if (!noAgeGroupFilter) {
      const ageGroupMatches = new Set<number>();
      for (const ageGroup of $selectedAgeGroups) {
        const indices = $ageGroupIndex.get(ageGroup);
        if (indices) {
          for (const idx of indices) {
            ageGroupMatches.add(idx);
          }
        }
      }

      if (matchingIndices === null) {
        matchingIndices = ageGroupMatches;
      } else {
        // Intersection: keep only indices that are in both sets
        matchingIndices = new Set([...matchingIndices].filter(i => ageGroupMatches.has(i)));
      }
    }

    // Apply syndrome filter
    if (!noSyndromeFilter) {
      const syndromeMatches = new Set<number>();
      for (const syndrome of $selectedSyndromes) {
        const indices = $syndromeIndex.get(syndrome);
        if (indices) {
          for (const idx of indices) {
            syndromeMatches.add(idx);
          }
        }
      }

      if (matchingIndices === null) {
        matchingIndices = syndromeMatches;
      } else {
        // Intersection: keep only indices that are in both sets
        matchingIndices = new Set([...matchingIndices].filter(i => syndromeMatches.has(i)));
      }
    }

    // Convert to array and cache the result
    const result = matchingIndices ? Array.from(matchingIndices) : [];
    filterCache.set(cacheKey, result);
    return result;
  }
);

// Filtered data based on indices - this should be faster than re-filtering the entire collection
export const filteredPointsData = derived(
  [pointsData, filteredIndices],
  ([$pointsData, $filteredIndices]) => {
    // If no filters are applied (null indices), return the full dataset
    if ($filteredIndices === null) {
      return $pointsData;
    }

    // Return a new FeatureCollection with only the filtered features
    return {
      type: 'FeatureCollection',
      features: $filteredIndices.map(idx => $pointsData.features[idx])
    } as PointFeatureCollection;
  }
);

// Function to clear filter cache when filters change significantly
export function clearFilterCache(): void {
  filterCache.clear();
}
