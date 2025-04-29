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

    if (noPathogenFilter && noAgeGroupFilter && noSyndromeFilter) {
      return null; // Null means "all features"
    }

    // Check cache first
    const cacheKey = getFilterCacheKey($selectedPathogens, $selectedAgeGroups, $selectedSyndromes);
    if (filterCache.has(cacheKey)) {
      return filterCache.get(cacheKey)!;
    }

    // Calculate filtered indices using our index structures
    let matchingIndices: Set<number> | null = null;

    // Apply pathogen filter
    if (!noPathogenFilter) {
      matchingIndices = new Set<number>();
      for (const pathogen of $selectedPathogens) {
        const indices = $pathogenIndex.get(pathogen);
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
  console.log('Filter cache cleared');
  filterCache.clear();
}

// Debug function to log filter state
export function debugFilters(): void {
  const $selectedPathogens = get(selectedPathogens);
  const $selectedAgeGroups = get(selectedAgeGroups);
  const $selectedSyndromes = get(selectedSyndromes);
  const $pathogenIndex = get(pathogenIndex);
  const $ageGroupIndex = get(ageGroupIndex);
  const $syndromeIndex = get(syndromeIndex);
  const $filteredIndices = get(filteredIndices);
  const $pointsData = get(pointsData);
  const $filteredPointsData = get(filteredPointsData);

  console.group('Filter Debug Information');
  console.log('Selected Pathogens:', Array.from($selectedPathogens));
  console.log('Selected Age Groups:', Array.from($selectedAgeGroups));
  console.log('Selected Syndromes:', Array.from($selectedSyndromes));
  console.log('Pathogen Index Size:', $pathogenIndex.size);
  console.log('Age Group Index Size:', $ageGroupIndex.size);
  console.log('Syndrome Index Size:', $syndromeIndex.size);
  console.log('Filtered Indices:', $filteredIndices);
  console.log('Total Points:', $pointsData.features.length);
  console.log('Filtered Points:', $filteredPointsData.features.length);
  console.log('Filter Cache Size:', filterCache.size);
  console.groupEnd();
}
