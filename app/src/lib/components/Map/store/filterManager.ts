import { derived, get } from 'svelte/store';
import {
  pointsData,
  selectedPathogens,
  selectedAgeGroups,
  selectedSyndromes,
  pathogenIndex,
  ageGroupIndex,
  syndromeIndex,
  pathogens, // Import all filter options
  ageGroups,
  syndromes
} from './stores';
import type { FeatureIndex, PointFeatureCollection } from './types';

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

// Debug function to log cache status
function logCacheStatus(action: string, key: string, hit: boolean = false): void {
  // console.log(`Filter Cache ${action}:`, {
  //   key,
  //   hit,
  //   cacheSize: filterCache.size,
  //   cacheKeys: Array.from(filterCache.keys())
  // });
}

// Filtered indices based on selections
// Function to apply filters and get matching indices
function applyFilters(
  currentPathogens: Set<string>,
  currentAgeGroups: Set<string>,
  currentSyndromes: Set<string>,
  pIndex: FeatureIndex,
  aIndex: FeatureIndex,
  sIndex: FeatureIndex
): Set<number> | null {
  const noPathogenFilter = currentPathogens.size === 0;
  const noAgeGroupFilter = currentAgeGroups.size === 0;
  const noSyndromeFilter = currentSyndromes.size === 0;

  if (noPathogenFilter && noAgeGroupFilter && noSyndromeFilter) {
    return null; // Null means "all features"
  }

  let matchingIndices: Set<number> | null = null;

  // Apply pathogen filter
  if (!noPathogenFilter) {
    matchingIndices = new Set<number>();
    for (const pathogen of currentPathogens) {
      let indices: Set<number> | undefined;
      if (pathogen === 'Campylobacter spp.') {
        if (pIndex.has('Campylobacter spp.')) {
          indices = pIndex.get('Campylobacter spp.');
        } else if (pIndex.has('Campylobacter')) {
          indices = pIndex.get('Campylobacter');
        } else {
          const campyKey = Array.from(pIndex.keys()).find(k =>
            k.toLowerCase().includes('campylobacter'));
          if (campyKey) {
            indices = pIndex.get(campyKey);
          }
        }
      } else {
        indices = pIndex.get(pathogen);
      }
      if (indices) {
        for (const idx of indices) {
          matchingIndices.add(idx);
        }
      }
    }
  }

  // Apply age group filter
  if (!noAgeGroupFilter) {
    const ageGroupMatches = new Set<number>();
    for (const ageGroup of currentAgeGroups) {
      const indices = aIndex.get(ageGroup);
      if (indices) {
        for (const idx of indices) {
          ageGroupMatches.add(idx);
        }
      }
    }
    if (matchingIndices === null) {
      matchingIndices = ageGroupMatches;
    } else {
      matchingIndices = new Set([...matchingIndices].filter(i => ageGroupMatches.has(i)));
    }
  }

  // Apply syndrome filter
  if (!noSyndromeFilter) {
    const syndromeMatches = new Set<number>();
    for (const syndrome of currentSyndromes) {
      const indices = sIndex.get(syndrome);
      if (indices) {
        for (const idx of indices) {
          syndromeMatches.add(idx);
        }
      }
    }
    if (matchingIndices === null) {
      matchingIndices = syndromeMatches;
    } else {
      matchingIndices = new Set([...matchingIndices].filter(i => syndromeMatches.has(i)));
    }
  }
  return matchingIndices;
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
    // console.log('Filter state:', {
    //   pathogens: Array.from($selectedPathogens),
    //   ageGroups: Array.from($selectedAgeGroups),
    //   syndromes: Array.from($selectedSyndromes),
    //   noPathogenFilter,
    //   noAgeGroupFilter,
    //   noSyndromeFilter,
    //   pathogenIndexKeys: Array.from($pathogenIndex.keys())
    // });

    if (noPathogenFilter && noAgeGroupFilter && noSyndromeFilter) {
      return null; // Null means "all features"
    }

    // Check cache first
    const cacheKey = getFilterCacheKey($selectedPathogens, $selectedAgeGroups, $selectedSyndromes);
    if (filterCache.has(cacheKey)) {
      // console.log('Using cached filter results for:', {
      //   pathogens: Array.from($selectedPathogens),
      //   ageGroups: Array.from($selectedAgeGroups),
      //   syndromes: Array.from($selectedSyndromes)
      // });
      logCacheStatus('HIT', cacheKey, true);
      return filterCache.get(cacheKey)!;
    }

    logCacheStatus('MISS', cacheKey);

    // Calculate filtered indices using our index structures
    const resultIndices = applyFilters(
      $selectedPathogens,
      $selectedAgeGroups,
      $selectedSyndromes,
      $pathogenIndex,
      $ageGroupIndex,
      $syndromeIndex
    );

    // Convert to array and cache the result
    const result = resultIndices ? Array.from(resultIndices) : [];
    filterCache.set(cacheKey, result);
    logCacheStatus('SET', cacheKey);
    // console.log(`Final filtered result: ${result.length} points`);
    return result;
  }
);

// Function to get the count for a specific filter option
function getOptionCount(
  category: 'pathogen' | 'ageGroup' | 'syndrome',
  option: string,
  currentPathogens: Set<string>,
  currentAgeGroups: Set<string>,
  currentSyndromes: Set<string>,
  pIndex: FeatureIndex,
  aIndex: FeatureIndex,
  sIndex: FeatureIndex
): number {
  let tempPathogens = new Set(currentPathogens);
  let tempAgeGroups = new Set(currentAgeGroups);
  let tempSyndromes = new Set(currentSyndromes);

  // Temporarily add the option to its respective set
  if (category === 'pathogen') {
    tempPathogens.add(option);
  } else if (category === 'ageGroup') {
    tempAgeGroups.add(option);
  } else if (category === 'syndrome') {
    tempSyndromes.add(option);
  }

  // Apply filters with the modified sets
  const matchingIndices = applyFilters(
    tempPathogens,
    tempAgeGroups,
    tempSyndromes,
    pIndex,
    aIndex,
    sIndex
  );

  return matchingIndices ? matchingIndices.size : 0;
}

// Derived stores for counts of each filter option
export const pathogenCounts = derived(
  [pathogens, selectedPathogens, selectedAgeGroups, selectedSyndromes, pathogenIndex, ageGroupIndex, syndromeIndex],
  ([$pathogens, $selectedPathogens, $selectedAgeGroups, $selectedSyndromes, $pathogenIndex, $ageGroupIndex, $syndromeIndex]) => {
    const counts = new Map<string, number>();
    for (const pathogen of $pathogens) {
      const count = getOptionCount(
        'pathogen',
        pathogen,
        $selectedPathogens,
        $selectedAgeGroups,
        $selectedSyndromes,
        $pathogenIndex,
        $ageGroupIndex,
        $syndromeIndex
      );
      counts.set(pathogen, count);
    }
    return counts;
  }
);

export const ageGroupCounts = derived(
  [ageGroups, selectedPathogens, selectedAgeGroups, selectedSyndromes, pathogenIndex, ageGroupIndex, syndromeIndex],
  ([$ageGroups, $selectedPathogens, $selectedAgeGroups, $selectedSyndromes, $pathogenIndex, $ageGroupIndex, $syndromeIndex]) => {
    const counts = new Map<string, number>();
    for (const ageGroup of $ageGroups) {
      const count = getOptionCount(
        'ageGroup',
        ageGroup,
        $selectedPathogens,
        $selectedAgeGroups,
        $selectedSyndromes,
        $pathogenIndex,
        $ageGroupIndex,
        $syndromeIndex
      );
      counts.set(ageGroup, count);
    }
    return counts;
  }
);

export const syndromeCounts = derived(
  [syndromes, selectedPathogens, selectedAgeGroups, selectedSyndromes, pathogenIndex, ageGroupIndex, syndromeIndex],
  ([$syndromes, $selectedPathogens, $selectedAgeGroups, $selectedSyndromes, $pathogenIndex, $ageGroupIndex, $syndromeIndex]) => {
    const counts = new Map<string, number>();
    for (const syndrome of $syndromes) {
      const count = getOptionCount(
        'syndrome',
        syndrome,
        $selectedPathogens,
        $selectedAgeGroups,
        $selectedSyndromes,
        $pathogenIndex,
        $ageGroupIndex,
        $syndromeIndex
      );
      counts.set(syndrome, count);
    }
    return counts;
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
  const cacheSize = filterCache.size;
  filterCache.clear();
  // console.log(`Filter cache cleared (removed ${cacheSize} entries)`);
}
