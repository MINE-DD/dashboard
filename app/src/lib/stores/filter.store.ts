import { derived, writable, get } from 'svelte/store';
import { pointsData } from '$lib/stores/data.store';
import type { FeatureIndex, PointFeatureCollection } from '$lib/types';

// Filter options stores
export const pathogens = writable<Set<string>>(new Set());
export const ageGroups = writable<Set<string>>(new Set());
export const syndromes = writable<Set<string>>(new Set());

// Selected filters stores
export const selectedPathogens = writable<Set<string>>(new Set(['Campylobacter']));
export const selectedAgeGroups = writable<Set<string>>(new Set(['Pre-school age children (<5 years)']));
export const selectedSyndromes = writable<Set<string>>(new Set(['Diarrhea (any severity)']));

// Indices for fast filtering
export const pathogenIndex = writable<FeatureIndex>(new Map());
export const ageGroupIndex = writable<FeatureIndex>(new Map());
export const syndromeIndex = writable<FeatureIndex>(new Map());

// --- Filtering Logic (migrated from filterManager.ts) ---

// Cache for previously filtered results
const filterCache = new Map<string, number[]>();

// Helper to get cache key for current filters
function getFilterCacheKey(
  currentSelectedPathogens: Set<string>,
  currentSelectedAgeGroups: Set<string>,
  currentSelectedSyndromes: Set<string>
): string {
  return JSON.stringify({
    p: Array.from(currentSelectedPathogens).sort(),
    a: Array.from(currentSelectedAgeGroups).sort(),
    s: Array.from(currentSelectedSyndromes).sort()
  });
}

// Debug function to log cache status (can be uncommented if needed)
// function logCacheStatus(action: string, key: string, hit: boolean = false): void {
//   console.log(`Filter Cache ${action}:`, {
//     key,
//     hit,
//     cacheSize: filterCache.size,
//     cacheKeys: Array.from(filterCache.keys())
//   });
// }

// Function to apply filters and get matching indices
function applyFilters(
  currentSelectedPathogens: Set<string>,
  currentSelectedAgeGroups: Set<string>,
  currentSelectedSyndromes: Set<string>,
  pIndex: FeatureIndex,
  aIndex: FeatureIndex,
  sIndex: FeatureIndex
): Set<number> | null {
  const noPathogenFilter = currentSelectedPathogens.size === 0;
  const noAgeGroupFilter = currentSelectedAgeGroups.size === 0;
  const noSyndromeFilter = currentSelectedSyndromes.size === 0;

  if (noPathogenFilter && noAgeGroupFilter && noSyndromeFilter) {
    return null; // Null means "all features"
  }

  let matchingIndices: Set<number> | null = null;

  // Apply pathogen filter
  if (!noPathogenFilter) {
    matchingIndices = new Set<number>();
    for (const pathogen of currentSelectedPathogens) {
      let indices: Set<number> | undefined;
      // Direct lookup since we've cleaned the pathogen names
      indices = pIndex.get(pathogen);
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
    for (const ageGroup of currentSelectedAgeGroups) {
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
      matchingIndices = new Set([...matchingIndices].filter((i) => ageGroupMatches.has(i)));
    }
  }

  // Apply syndrome filter
  if (!noSyndromeFilter) {
    const syndromeMatches = new Set<number>();
    for (const syndrome of currentSelectedSyndromes) {
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
      matchingIndices = new Set([...matchingIndices].filter((i) => syndromeMatches.has(i)));
    }
  }
  return matchingIndices;
}

// Filtered indices based on selections
export const filteredIndices = derived(
  [selectedPathogens, selectedAgeGroups, selectedSyndromes, pathogenIndex, ageGroupIndex, syndromeIndex],
  ([
    $selectedPathogens,
    $selectedAgeGroups,
    $selectedSyndromes,
    $pathogenIndex,
    $ageGroupIndex,
    $syndromeIndex
  ]) => {
    const noPathogenFilter = $selectedPathogens.size === 0;
    const noAgeGroupFilter = $selectedAgeGroups.size === 0;
    const noSyndromeFilter = $selectedSyndromes.size === 0;

    if (noPathogenFilter && noAgeGroupFilter && noSyndromeFilter) {
      return null; // Null means "all features"
    }

    const cacheKey = getFilterCacheKey($selectedPathogens, $selectedAgeGroups, $selectedSyndromes);
    if (filterCache.has(cacheKey)) {
      // logCacheStatus('HIT', cacheKey, true);
      return filterCache.get(cacheKey)!;
    }

    // logCacheStatus('MISS', cacheKey);

    const resultIndicesSet = applyFilters(
      $selectedPathogens,
      $selectedAgeGroups,
      $selectedSyndromes,
      $pathogenIndex,
      $ageGroupIndex,
      $syndromeIndex
    );

    const result = resultIndicesSet ? Array.from(resultIndicesSet) : [];
    filterCache.set(cacheKey, result);
    // logCacheStatus('SET', cacheKey);
    return result;
  }
);

// Function to get the count for a specific filter option
function getOptionCount(
  category: 'pathogen' | 'ageGroup' | 'syndrome',
  option: string,
  currentSelectedPathogens: Set<string>,
  currentSelectedAgeGroups: Set<string>,
  currentSelectedSyndromes: Set<string>,
  pIndex: FeatureIndex,
  aIndex: FeatureIndex,
  sIndex: FeatureIndex
): number {
  // Create temporary sets for applying the option being counted
  const tempPathogens = category === 'pathogen' ? new Set([...currentSelectedPathogens, option]) : new Set(currentSelectedPathogens);
  const tempAgeGroups = category === 'ageGroup' ? new Set([...currentSelectedAgeGroups, option]) : new Set(currentSelectedAgeGroups);
  const tempSyndromes = category === 'syndrome' ? new Set([...currentSelectedSyndromes, option]) : new Set(currentSelectedSyndromes);

  // Apply filters with the modified sets
  const matchingIndices = applyFilters(
    tempPathogens,
    tempAgeGroups,
    tempSyndromes,
    pIndex,
    aIndex,
    sIndex
  );

  return matchingIndices ? matchingIndices.size : get(pointsData).features.length; // if no filters, count all
}


// Derived stores for counts of each filter option
export const pathogenCounts = derived(
  [pathogens, selectedPathogens, selectedAgeGroups, selectedSyndromes, pathogenIndex, ageGroupIndex, syndromeIndex],
  ([
    $pathogens,
    $selectedPathogens,
    $selectedAgeGroups,
    $selectedSyndromes,
    $pathogenIndex,
    $ageGroupIndex,
    $syndromeIndex
  ]) => {
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
  ([
    $ageGroups,
    $selectedPathogens,
    $selectedAgeGroups,
    $selectedSyndromes,
    $pathogenIndex,
    $ageGroupIndex,
    $syndromeIndex
  ]) => {
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
  ([
    $syndromes,
    $selectedPathogens,
    $selectedAgeGroups,
    $selectedSyndromes,
    $pathogenIndex,
    $ageGroupIndex,
    $syndromeIndex
  ]) => {
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

// Filtered data based on indices
export const filteredPointsData = derived(
  [pointsData, filteredIndices],
  ([$pointsData, $filteredIndices]) => {
    if ($filteredIndices === null) {
      return $pointsData; // No filters applied, return all data
    }

    return {
      type: 'FeatureCollection',
      features: $filteredIndices.map((idx) => $pointsData.features[idx]).filter(Boolean) // Ensure no undefined features
    } as PointFeatureCollection;
  }
);

// Function to clear filter cache
export function clearFilterCache(): void {
  const cacheSize = filterCache.size;
  filterCache.clear();
  // console.log(`Filter cache cleared (removed ${cacheSize} entries)`);
}
