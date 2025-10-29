/**
 * Unit tests for filter store
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { get } from 'svelte/store';
import {
	pathogens,
	ageGroups,
	syndromes,
	selectedPathogens,
	selectedAgeGroups,
	selectedSyndromes,
	pathogenIndex,
	ageGroupIndex,
	syndromeIndex,
	filteredIndices,
	pathogenCounts,
	ageGroupCounts,
	syndromeCounts,
	clearFilterCache
} from '$lib/stores/filter.store';
import { pointsData } from '$lib/stores/data.store';
import { convertCsvToGeoJson } from '$lib/components/Map/utils/geoJsonConverter';
import { samplePointDataRows } from '../../fixtures/csv/sample-points';

describe('filter.store', () => {
	beforeEach(() => {
		// Reset all stores
		pathogens.set(new Set());
		ageGroups.set(new Set());
		syndromes.set(new Set());
		selectedPathogens.set(new Set());
		selectedAgeGroups.set(new Set());
		selectedSyndromes.set(new Set());
		pathogenIndex.set(new Map());
		ageGroupIndex.set(new Map());
		syndromeIndex.set(new Map());
		pointsData.set({ type: 'FeatureCollection', features: [] });
		clearFilterCache();

		// Setup test data
		const geoJsonData = convertCsvToGeoJson(samplePointDataRows);
		pointsData.set(geoJsonData);

		// Extract unique values for filter options
		const pathogenSet = new Set(samplePointDataRows.map((r) => r.Pathogen));
		const ageGroupSet = new Set(samplePointDataRows.map((r) => r.AGE_VAL));
		const syndromeSet = new Set(samplePointDataRows.map((r) => r.SYNDROME_VAL));

		pathogens.set(pathogenSet);
		ageGroups.set(ageGroupSet);
		syndromes.set(syndromeSet);
	});

	describe('filter option stores', () => {
		test('pathogens store contains unique pathogen values', () => {
			const pathogenSet = get(pathogens);

			expect(pathogenSet.size).toBeGreaterThan(0);
			expect(pathogenSet.has('Shigella')).toBe(true);
			expect(pathogenSet.has('Campylobacter')).toBe(true);
		});

		test('ageGroups store contains unique age group values', () => {
			const ageGroupSet = get(ageGroups);

			expect(ageGroupSet.size).toBeGreaterThan(0);
			expect(ageGroupSet.has('01_Age_PSAC')).toBe(true);
		});

		test('syndromes store contains unique syndrome values', () => {
			const syndromeSet = get(syndromes);

			expect(syndromeSet.size).toBeGreaterThan(0);
			expect(syndromeSet.has('02_Synd_Diar')).toBe(true);
		});
	});

	describe('selected filter stores', () => {
		test('selectedPathogens starts empty', () => {
			const selected = get(selectedPathogens);
			expect(selected.size).toBe(0);
		});

		test('can add pathogens to selection', () => {
			selectedPathogens.update((s) => {
				s.add('Shigella');
				return s;
			});

			const selected = get(selectedPathogens);
			expect(selected.has('Shigella')).toBe(true);
		});

		test('can remove pathogens from selection', () => {
			selectedPathogens.update((s) => {
				s.add('Shigella');
				return s;
			});
			selectedPathogens.update((s) => {
				s.delete('Shigella');
				return s;
			});

			const selected = get(selectedPathogens);
			expect(selected.has('Shigella')).toBe(false);
		});

		test('can select multiple pathogens', () => {
			selectedPathogens.update((s) => {
				s.add('Shigella');
				s.add('Campylobacter');
				return s;
			});

			const selected = get(selectedPathogens);
			expect(selected.size).toBe(2);
		});
	});

	describe('filteredIndices derived store', () => {
		test('returns null when no filters are selected', () => {
			const indices = get(filteredIndices);
			expect(indices).toBeNull();
		});

		test('filters by pathogen correctly', () => {
			selectedPathogens.update((s) => {
				s.add('Shigella');
				return s;
			});

			const indices = get(filteredIndices);

			expect(indices).toBeArray();
			expect(indices!.length).toBeGreaterThan(0);

			// Verify all filtered features have Shigella
			const data = get(pointsData);
			indices!.forEach((idx) => {
				expect(data.features[idx].properties.pathogen).toBe('Shigella');
			});
		});

		test('filters by age group correctly', () => {
			selectedAgeGroups.update((s) => {
				s.add('01_Age_PSAC');
				return s;
			});

			const indices = get(filteredIndices);

			expect(indices).toBeArray();
			expect(indices!.length).toBeGreaterThan(0);

			// Verify all filtered features have correct age group
			const data = get(pointsData);
			indices!.forEach((idx) => {
				expect(data.features[idx].properties.ageGroupVal).toBe('01_Age_PSAC');
			});
		});

		test('filters by syndrome correctly', () => {
			selectedSyndromes.update((s) => {
				s.add('02_Synd_Diar');
				return s;
			});

			const indices = get(filteredIndices);

			expect(indices).toBeArray();
			expect(indices!.length).toBeGreaterThan(0);

			// Verify all filtered features have correct syndrome
			const data = get(pointsData);
			indices!.forEach((idx) => {
				expect(data.features[idx].properties.syndromeVal).toBe('02_Synd_Diar');
			});
		});

		test('applies multiple filters with AND logic', () => {
			selectedPathogens.update((s) => {
				s.add('Shigella');
				return s;
			});
			selectedAgeGroups.update((s) => {
				s.add('01_Age_PSAC');
				return s;
			});

			const indices = get(filteredIndices);

			expect(indices).toBeArray();

			// Verify all filtered features match BOTH filters
			const data = get(pointsData);
			indices!.forEach((idx) => {
				const feature = data.features[idx];
				expect(feature.properties.pathogen).toBe('Shigella');
				expect(feature.properties.ageGroupVal).toBe('01_Age_PSAC');
			});
		});

		test('returns empty array when filters match nothing', () => {
			selectedPathogens.update((s) => {
				s.add('NonExistentPathogen');
				return s;
			});

			const indices = get(filteredIndices);

			expect(indices).toBeArray();
			expect(indices!.length).toBe(0);
		});

		test('uses cache for repeated filter combinations', () => {
			selectedPathogens.update((s) => {
				s.add('Shigella');
				return s;
			});

			const indices1 = get(filteredIndices);

			// Same filter again
			const indices2 = get(filteredIndices);

			// Should return same array reference (from cache)
			expect(indices1).toBe(indices2);
		});

		test('cache invalidates when filters change', () => {
			selectedPathogens.update((s) => {
				s.add('Shigella');
				return s;
			});

			const indices1 = get(filteredIndices);

			selectedPathogens.update((s) => {
				s.add('Campylobacter');
				return s;
			});

			const indices2 = get(filteredIndices);

			// Should be different results
			expect(indices1!.length).not.toBe(indices2!.length);
		});
	});

	describe('filter count stores', () => {
		test('pathogenCounts shows count for each pathogen', () => {
			const counts = get(pathogenCounts);

			expect(counts.size).toBeGreaterThan(0);

			// Each pathogen should have a count
			const pathogenSet = get(pathogens);
			pathogenSet.forEach((pathogen) => {
				expect(counts.has(pathogen)).toBe(true);
				expect(counts.get(pathogen)).toBeGreaterThan(0);
			});
		});

		test('ageGroupCounts shows count for each age group', () => {
			const counts = get(ageGroupCounts);

			expect(counts.size).toBeGreaterThan(0);
		});

		test('syndromeCounts shows count for each syndrome', () => {
			const counts = get(syndromeCounts);

			expect(counts.size).toBeGreaterThan(0);
		});

		test('counts update when filters are applied', () => {
			const initialCounts = get(pathogenCounts);
			const initialTotal = Array.from(initialCounts.values()).reduce((a, b) => a + b, 0);

			// Apply a filter
			selectedAgeGroups.update((s) => {
				s.add('01_Age_PSAC');
				return s;
			});

			const filteredCounts = get(pathogenCounts);
			const filteredTotal = Array.from(filteredCounts.values()).reduce((a, b) => a + b, 0);

			// Filtered counts should be <= initial counts
			expect(filteredTotal).toBeLessThanOrEqual(initialTotal);
		});
	});

	describe('clearFilterCache', () => {
		test('clears the filter cache', () => {
			// Apply filters to populate cache
			selectedPathogens.update((s) => {
				s.add('Shigella');
				return s;
			});
			get(filteredIndices);

			// Clear cache
			clearFilterCache();

			// This should work without errors
			expect(() => clearFilterCache()).not.toThrow();
		});
	});
});
