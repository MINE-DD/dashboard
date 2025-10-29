/**
 * Unit tests for pie chart utilities
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
	createPieChartImage,
	getSeparatePieChartData,
	getDesignColors,
	getDefaultColor
} from '$lib/components/Map/utils/pieChartUtils';
import { setupBrowserMocks, cleanupBrowserMocks } from '../../helpers/mocks/browser';
import { createFeatureCollection } from '../../helpers/factories/point-data';
import type { FeatureCollection, Point } from 'geojson';

describe('pieChartUtils', () => {
	beforeAll(() => {
		setupBrowserMocks();
	});

	afterAll(() => {
		cleanupBrowserMocks();
	});

	describe('createPieChartImage', () => {
		test('creates a data URL for pie chart image', () => {
			const dataUrl = createPieChartImage(0.5, 1000, 'Surveillance');

			expect(dataUrl).toBeString();
			expect(dataUrl).toStartWith('data:image/png;base64,');
		});

		test('creates different sized charts based on sample count', () => {
			const smallUrl = createPieChartImage(0.5, 10, 'Surveillance');
			const largeUrl = createPieChartImage(0.5, 50000, 'Surveillance');

			// Both should be valid data URLs
			expect(smallUrl).toStartWith('data:image/png;base64,');
			expect(largeUrl).toStartWith('data:image/png;base64,');

			// They should be different (different sizes)
			expect(smallUrl).not.toBe(largeUrl);
		});

		test('handles zero prevalence', () => {
			const dataUrl = createPieChartImage(0, 1000, 'Surveillance');

			expect(dataUrl).toBeString();
			expect(dataUrl).toStartWith('data:image/png;base64,');
		});

		test('handles 100% prevalence', () => {
			const dataUrl = createPieChartImage(1, 1000, 'Surveillance');

			expect(dataUrl).toBeString();
			expect(dataUrl).toStartWith('data:image/png;base64,');
		});

		test('handles different design types', () => {
			const designs = [
				'Surveillance',
				'Case-Control',
				'Cohort',
				'Cross-Sectional',
				'Intervention Trial'
			];

			designs.forEach((design) => {
				const dataUrl = createPieChartImage(0.5, 1000, design);
				expect(dataUrl).toStartWith('data:image/png;base64,');
			});
		});

		test('handles unknown design type with default color', () => {
			const dataUrl = createPieChartImage(0.5, 1000, 'UnknownDesign');

			expect(dataUrl).toBeString();
			expect(dataUrl).toStartWith('data:image/png;base64,');
		});

		test('clamps prevalence values to valid range', () => {
			// Should handle out-of-range values gracefully
			const lowUrl = createPieChartImage(-0.5, 1000, 'Surveillance');
			const highUrl = createPieChartImage(1.5, 1000, 'Surveillance');

			expect(lowUrl).toStartWith('data:image/png;base64,');
			expect(highUrl).toStartWith('data:image/png;base64,');
		});

		test('handles very small sample sizes', () => {
			const dataUrl = createPieChartImage(0.5, 1, 'Surveillance');

			expect(dataUrl).toStartWith('data:image/png;base64,');
		});

		test('handles very large sample sizes', () => {
			const dataUrl = createPieChartImage(0.5, 100000, 'Surveillance');

			expect(dataUrl).toStartWith('data:image/png;base64,');
		});
	});

	describe('getSeparatePieChartData', () => {
		test('returns features with unique IDs', () => {
			const collection = createFeatureCollection();
			const result = getSeparatePieChartData(collection);

			expect(result.type).toBe('FeatureCollection');
			expect(result.features.length).toBe(collection.features.length);

			result.features.forEach((feature) => {
				expect(feature.properties?.id).toBeDefined();
			});
		});

		test('adds IDs to features without them', () => {
			const collection: FeatureCollection<Point> = {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						geometry: { type: 'Point', coordinates: [0, 0] },
						properties: {} // No ID
					}
				]
			};

			const result = getSeparatePieChartData(collection);

			expect(result.features[0].properties?.id).toBeDefined();
			expect(result.features[0].properties?.id).toContain('pie-chart');
		});

		test('preserves existing feature IDs', () => {
			const collection = createFeatureCollection([
				{
					type: 'Feature',
					id: 0,
					geometry: { type: 'Point', coordinates: [0, 0] },
					properties: {
						id: 'CUSTOM_ID',
						pathogen: 'Shigella',
						ageGroup: 'Test',
						ageGroupVal: '01',
						ageGroupLab: 'Test',
						syndrome: 'Test',
						syndromeVal: '01',
						syndromeLab: 'Test',
						design: 'Surveillance',
						location: 'Test',
						heading: 'Test',
						subheading: 'Test',
						footnote: 'Test',
						prevalence: '10%',
						ageRange: 'Test',
						duration: 'Test',
						source: 'Test',
						hyperlink: 'Test',
						cases: 100,
						samples: 1000,
						prevalenceValue: 0.1,
						standardError: 0.01
					}
				}
			]);

			const result = getSeparatePieChartData(collection);

			expect(result.features[0].properties?.id).toBe('CUSTOM_ID');
		});

		test('handles empty feature collection', () => {
			const collection: FeatureCollection<Point> = {
				type: 'FeatureCollection',
				features: []
			};

			const result = getSeparatePieChartData(collection);

			expect(result.type).toBe('FeatureCollection');
			expect(result.features).toBeArray();
			expect(result.features.length).toBe(0);
		});

		test('preserves all feature properties', () => {
			const collection = createFeatureCollection();
			const original = collection.features[0];

			const result = getSeparatePieChartData(collection);
			const processed = result.features[0];

			expect(processed.type).toBe(original.type);
			expect(processed.geometry).toEqual(original.geometry);
			expect(processed.properties?.pathogen).toBe(original.properties?.pathogen);
			expect(processed.properties?.prevalenceValue).toBe(original.properties?.prevalenceValue);
		});
	});

	describe('getDesignColors', () => {
		test('returns an object with design color mappings', () => {
			const colors = getDesignColors();

			expect(colors).toBeObject();
			expect(Object.keys(colors).length).toBeGreaterThan(0);
		});

		test('includes all standard design types', () => {
			const colors = getDesignColors();

			expect(colors['Surveillance']).toBeDefined();
			expect(colors['Case-Control']).toBeDefined();
			expect(colors['Cohort']).toBeDefined();
			expect(colors['Cross-Sectional']).toBeDefined();
			expect(colors['Intervention Trial']).toBeDefined();
		});

		test('includes dark variants for design types', () => {
			const colors = getDesignColors();

			expect(colors['Surveillance_dark']).toBeDefined();
			expect(colors['Case-Control_dark']).toBeDefined();
			expect(colors['Cohort_dark']).toBeDefined();
		});

		test('returns valid color strings', () => {
			const colors = getDesignColors();

			Object.values(colors).forEach((color) => {
				expect(color).toBeString();
				expect(color).toMatch(/^#[0-9a-fA-F]{6,8}$/); // Hex color with optional alpha
			});
		});

		test('returns a copy not a reference', () => {
			const colors1 = getDesignColors();
			const colors2 = getDesignColors();

			// Modify one
			colors1['TEST'] = '#FFFFFF';

			// Should not affect the other
			expect(colors2['TEST']).toBeUndefined();
		});
	});

	describe('getDefaultColor', () => {
		test('returns a string', () => {
			const color = getDefaultColor();

			expect(color).toBeString();
		});

		test('returns a valid hex color', () => {
			const color = getDefaultColor();

			expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
		});

		test('returns consistent value', () => {
			const color1 = getDefaultColor();
			const color2 = getDefaultColor();

			expect(color1).toBe(color2);
		});
	});
});
