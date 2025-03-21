import { get } from 'svelte/store';
import { selectedPathogens, selectedAgeGroups, selectedSyndromes } from './stores';

// Helper function to get MapLibre filter expression based on current filter state
export function getMaplibreFilterExpression(): any[] {
  const $selectedPathogens = get(selectedPathogens);
  const $selectedAgeGroups = get(selectedAgeGroups);
  const $selectedSyndromes = get(selectedSyndromes);

  const noPathogenFilter = $selectedPathogens.size === 0;
  const noAgeGroupFilter = $selectedAgeGroups.size === 0;
  const noSyndromeFilter = $selectedSyndromes.size === 0;

  // If no filters are selected, return a filter that matches everything
  if (noPathogenFilter && noAgeGroupFilter && noSyndromeFilter) {
    return ['all'];
  }

  const filters = [];

  // Add pathogen filter
  if (!noPathogenFilter) {
    filters.push(['in', ['get', 'pathogen'], ['literal', Array.from($selectedPathogens)]]);
  }

  // Add age group filter
  if (!noAgeGroupFilter) {
    filters.push(['in', ['get', 'ageGroup'], ['literal', Array.from($selectedAgeGroups)]]);
  }

  // Add syndrome filter
  if (!noSyndromeFilter) {
    filters.push(['in', ['get', 'syndrome'], ['literal', Array.from($selectedSyndromes)]]);
  }

  // Combine all filters with 'all' operator
  return ['all', ...filters];
}
