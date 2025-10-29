/**
 * Unit tests for GeoJSON converter
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { convertCsvToGeoJson } from '$lib/components/Map/utils/geoJsonConverter';
import { samplePointDataRows } from '../../fixtures/csv/sample-points';
import { get } from 'svelte/store';
import { pathogenIndex, ageGroupIndex, syndromeIndex } from '$lib/stores/filter.store';

describe('geoJsonConverter', () => {
	beforeEach(() => {
		// Clear indices before each test
		pathogenIndex.set(new Map());
		ageGroupIndex.set(new Map());
		syndromeIndex.set(new Map());
	});

	describe('convertCsvToGeoJson', () => {
		test('converts CSV data to GeoJSON format', () => {
			const result = convertCsvToGeoJson(samplePointDataRows);

			expect(result.type).toBe('FeatureCollection');
			expect(result.features).toBeArray();
			expect(result.features.length).toBe(samplePointDataRows.length);
		});

		test('creates Point features with correct geometry', () => {
			const result = convertCsvToGeoJson(samplePointDataRows);

			result.features.forEach((feature, index) => {
				expect(feature.type).toBe('Feature');
				expect(feature.geometry.type).toBe('Point');
				expect(feature.geometry.coordinates).toBeArray();
				expect(feature.geometry.coordinates.length).toBe(2);

				// Verify coordinates are numbers (lon, lat order)
				const [lon, lat] = feature.geometry.coordinates;
				expect(typeof lon).toBe('number');
				expect(typeof lat).toBe('number');

				// Verify coordinates match source data
				const sourceRow = samplePointDataRows[index];
				expect(lon).toBe(parseFloat(sourceRow.SITE_LON));
				expect(lat).toBe(parseFloat(sourceRow.SITE_LAT));
			});
		});

		test('correctly maps CSV properties to GeoJSON properties', () => {
			const result = convertCsvToGeoJson(samplePointDataRows);
			const firstFeature = result.features[0];
			const firstRow = samplePointDataRows[0];

			expect(firstFeature.properties.id).toBe(firstRow.EST_ID);
			expect(firstFeature.properties.pathogen).toBe(firstRow.Pathogen);
			expect(firstFeature.properties.ageGroup).toBe(firstRow.AGE_LAB);
			expect(firstFeature.properties.ageGroupVal).toBe(firstRow.AGE_VAL);
			expect(firstFeature.properties.syndrome).toBe(firstRow.SYNDROME_LAB);
			expect(firstFeature.properties.syndromeVal).toBe(firstRow.SYNDROME_VAL);
			expect(firstFeature.properties.design).toBe(firstRow.Design);
			expect(firstFeature.properties.location).toBe(firstRow.Location);
			expect(firstFeature.properties.prevalence).toBe(firstRow.Prevalence);
		});

		test('parses numeric fields correctly', () => {
			const result = convertCsvToGeoJson(samplePointDataRows);
			const firstFeature = result.features[0];

			expect(firstFeature.properties.cases).toBe(153);
			expect(firstFeature.properties.samples).toBe(1000);
			expect(firstFeature.properties.prevalenceValue).toBe(0.153);
			expect(firstFeature.properties.standardError).toBe(0.011);
		});

		test('filters out rows with invalid coordinates', () => {
			const invalidData = [
				...samplePointDataRows,
				{
					...samplePointDataRows[0],
					EST_ID: 'INVALID_001',
					SITE_LAT: 'invalid',
					SITE_LON: 'invalid'
				}
			];

			const result = convertCsvToGeoJson(invalidData);

			// Should only include valid rows
			expect(result.features.length).toBe(samplePointDataRows.length);
			expect(result.features.every((f) => !f.properties.id.startsWith('INVALID'))).toBe(true);
		});

		test('creates and populates pathogen index', () => {
			convertCsvToGeoJson(samplePointDataRows);

			const pIndex = get(pathogenIndex);
			expect(pIndex.size).toBeGreaterThan(0);

			// Check that Shigella is indexed
			expect(pIndex.has('Shigella')).toBe(true);
			const shigellaIndices = pIndex.get('Shigella');
			expect(shigellaIndices).toBeDefined();
			expect(shigellaIndices!.size).toBeGreaterThan(0);
		});

		test('creates and populates age group index', () => {
			convertCsvToGeoJson(samplePointDataRows);

			const aIndex = get(ageGroupIndex);
			expect(aIndex.size).toBeGreaterThan(0);

			// Check that age groups are indexed by VAL
			expect(aIndex.has('01_Age_PSAC')).toBe(true);
		});

		test('creates and populates syndrome index', () => {
			convertCsvToGeoJson(samplePointDataRows);

			const sIndex = get(syndromeIndex);
			expect(sIndex.size).toBeGreaterThan(0);

			// Check that syndromes are indexed by VAL
			expect(sIndex.has('02_Synd_Diar')).toBe(true);
		});

		test('assigns sequential IDs to features', () => {
			const result = convertCsvToGeoJson(samplePointDataRows);

			result.features.forEach((feature, index) => {
				expect(feature.id).toBe(index);
			});
		});

		test('handles empty CSV data', () => {
			const result = convertCsvToGeoJson([]);

			expect(result.type).toBe('FeatureCollection');
			expect(result.features).toBeArray();
			expect(result.features.length).toBe(0);
		});

		test('handles missing optional fields gracefully', () => {
			const dataWithMissing = [
				{
					EST_ID: 'TEST_001',
					Design: '',
					Pathogen: 'Shigella',
					AGE_VAL: '01_Age_PSAC',
					AGE_LAB: 'Pre-school age children (<5 years)',
					SYNDROME_VAL: '02_Synd_Diar',
					SYNDROME_LAB: 'Diarrhea (any severity)',
					Heading: '',
					Subheading: '',
					Prevalence: '',
					Age_range: '',
					Location: '',
					Duration: '',
					Source: '',
					Hyperlink: '',
					Footnote: '',
					CASES: '0',
					SAMPLES: '0',
					PREV: '0',
					SE: '0',
					SITE_LAT: '0',
					SITE_LON: '0'
				}
			];

			const result = convertCsvToGeoJson(dataWithMissing);

			expect(result.features.length).toBe(1);
			expect(result.features[0].properties.design).toBe('');
			expect(result.features[0].properties.cases).toBe(0);
		});
	});
});
