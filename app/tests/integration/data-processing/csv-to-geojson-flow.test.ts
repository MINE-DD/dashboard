/**
 * Integration tests for CSV to GeoJSON to Filtering workflow
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { get } from 'svelte/store';
import { convertCsvToGeoJson } from '$lib/components/Map/utils/geoJsonConverter';
import {
	selectedPathogens,
	selectedAgeGroups,
	selectedSyndromes,
	filteredPointsData,
	pathogenIndex,
	ageGroupIndex,
	syndromeIndex,
	clearFilterCache
} from '$lib/stores/filter.store';
import { pointsData } from '$lib/stores/data.store';
import { samplePointDataRows } from '../../fixtures/csv/sample-points';

describe('CSV to GeoJSON to Filtering Integration', () => {
	beforeEach(() => {
		// Reset stores
		selectedPathogens.set(new Set());
		selectedAgeGroups.set(new Set());
		selectedSyndromes.set(new Set());
		pathogenIndex.set(new Map());
		ageGroupIndex.set(new Map());
		syndromeIndex.set(new Map());
		pointsData.set({ type: 'FeatureCollection', features: [] });
		clearFilterCache();
	});

	test('complete workflow: CSV → GeoJSON → Index → Filter', () => {
		// Step 1: Convert CSV to GeoJSON
		const geoJsonData = convertCsvToGeoJson(samplePointDataRows);

		expect(geoJsonData.type).toBe('FeatureCollection');
		expect(geoJsonData.features.length).toBe(samplePointDataRows.length);

		// Step 2: Store in pointsData
		pointsData.set(geoJsonData);

		// Step 3: Verify indices were created
		const pIndex = get(pathogenIndex);
		const aIndex = get(ageGroupIndex);
		const sIndex = get(syndromeIndex);

		expect(pIndex.size).toBeGreaterThan(0);
		expect(aIndex.size).toBeGreaterThan(0);
		expect(sIndex.size).toBeGreaterThan(0);

		// Step 4: Apply filters
		selectedPathogens.update((s) => {
			s.add('Shigella');
			return s;
		});

		// Step 5: Get filtered data
		const filtered = get(filteredPointsData);

		expect(filtered.type).toBe('FeatureCollection');
		expect(filtered.features.length).toBeGreaterThan(0);
		expect(filtered.features.length).toBeLessThanOrEqual(geoJsonData.features.length);

		// Verify all filtered features match the filter
		filtered.features.forEach((feature) => {
			expect(feature.properties.pathogen).toBe('Shigella');
		});
	});

	test('filtering preserves GeoJSON structure and properties', () => {
		const geoJsonData = convertCsvToGeoJson(samplePointDataRows);
		pointsData.set(geoJsonData);

		selectedPathogens.update((s) => {
			s.add('Shigella');
			return s;
		});

		const filtered = get(filteredPointsData);

		filtered.features.forEach((feature) => {
			// Verify GeoJSON structure
			expect(feature.type).toBe('Feature');
			expect(feature.geometry.type).toBe('Point');
			expect(feature.geometry.coordinates).toBeArray();
			expect(feature.geometry.coordinates.length).toBe(2);

			// Verify essential properties exist
			expect(feature.properties.id).toBeDefined();
			expect(feature.properties.pathogen).toBeDefined();
			expect(feature.properties.prevalenceValue).toBeNumber();
			expect(feature.properties.samples).toBeNumber();
		});
	});

	test('applying multiple filters sequentially works correctly', () => {
		const geoJsonData = convertCsvToGeoJson(samplePointDataRows);
		pointsData.set(geoJsonData);

		// Initial state: no filters
		let filtered = get(filteredPointsData);
		const initialCount = filtered.features.length;

		// Apply first filter: pathogen
		selectedPathogens.update((s) => {
			s.add('Shigella');
			return s;
		});
		filtered = get(filteredPointsData);
		const afterFirstFilter = filtered.features.length;

		expect(afterFirstFilter).toBeLessThanOrEqual(initialCount);

		// Apply second filter: age group
		selectedAgeGroups.update((s) => {
			s.add('01_Age_PSAC');
			return s;
		});
		filtered = get(filteredPointsData);
		const afterSecondFilter = filtered.features.length;

		expect(afterSecondFilter).toBeLessThanOrEqual(afterFirstFilter);

		// Verify both filters are applied
		filtered.features.forEach((feature) => {
			expect(feature.properties.pathogen).toBe('Shigella');
			expect(feature.properties.ageGroupVal).toBe('01_Age_PSAC');
		});
	});

	test('removing filters restores data progressively', () => {
		const geoJsonData = convertCsvToGeoJson(samplePointDataRows);
		pointsData.set(geoJsonData);

		// Apply both filters
		selectedPathogens.update((s) => {
			s.add('Shigella');
			return s;
		});
		selectedAgeGroups.update((s) => {
			s.add('01_Age_PSAC');
			return s;
		});

		let filtered = get(filteredPointsData);
		const withBothFilters = filtered.features.length;

		// Remove age group filter
		selectedAgeGroups.set(new Set());

		filtered = get(filteredPointsData);
		const withOneFilter = filtered.features.length;

		expect(withOneFilter).toBeGreaterThanOrEqual(withBothFilters);

		// Remove all filters
		selectedPathogens.set(new Set());

		filtered = get(filteredPointsData);
		const withNoFilters = filtered.features.length;

		expect(withNoFilters).toBe(geoJsonData.features.length);
	});

	test('filtering with no matches returns empty feature collection', () => {
		const geoJsonData = convertCsvToGeoJson(samplePointDataRows);
		pointsData.set(geoJsonData);

		selectedPathogens.update((s) => {
			s.add('NonExistentPathogen');
			return s;
		});

		const filtered = get(filteredPointsData);

		expect(filtered.type).toBe('FeatureCollection');
		expect(filtered.features).toBeArray();
		expect(filtered.features.length).toBe(0);
	});

	test('indices are correctly populated from CSV data', () => {
		const geoJsonData = convertCsvToGeoJson(samplePointDataRows);
		pointsData.set(geoJsonData);

		const pIndex = get(pathogenIndex);
		const aIndex = get(ageGroupIndex);
		const sIndex = get(syndromeIndex);

		// Verify pathogen index
		expect(pIndex.has('Shigella')).toBe(true);
		expect(pIndex.has('Campylobacter')).toBe(true);

		// Verify indices contain feature numbers
		const shigellaIndices = pIndex.get('Shigella');
		expect(shigellaIndices).toBeDefined();
		expect(shigellaIndices!.size).toBeGreaterThan(0);

		// Verify indexed features actually have that pathogen
		shigellaIndices!.forEach((idx) => {
			expect(geoJsonData.features[idx].properties.pathogen).toBe('Shigella');
		});
	});

	test('filtering performance: handles multiple filter changes efficiently', () => {
		const geoJsonData = convertCsvToGeoJson(samplePointDataRows);
		pointsData.set(geoJsonData);

		const iterations = 10;
		const startTime = Date.now();

		for (let i = 0; i < iterations; i++) {
			// Toggle filter on and off
			selectedPathogens.update((s) => {
				s.add('Shigella');
				return s;
			});
			get(filteredPointsData);

			selectedPathogens.set(new Set());
			get(filteredPointsData);
		}

		const endTime = Date.now();
		const duration = endTime - startTime;

		// Should complete within reasonable time (< 1 second for 10 iterations)
		expect(duration).toBeLessThan(1000);
	});

	test('data integrity: filtering does not mutate original data', () => {
		const geoJsonData = convertCsvToGeoJson(samplePointDataRows);
		const originalFeatureCount = geoJsonData.features.length;
		const originalFirstFeature = { ...geoJsonData.features[0] };

		pointsData.set(geoJsonData);

		// Apply filters
		selectedPathogens.update((s) => {
			s.add('Shigella');
			return s;
		});
		get(filteredPointsData);

		// Original data should be unchanged
		const storedData = get(pointsData);
		expect(storedData.features.length).toBe(originalFeatureCount);
		expect(storedData.features[0].type).toBe(originalFirstFeature.type);
	});
});
