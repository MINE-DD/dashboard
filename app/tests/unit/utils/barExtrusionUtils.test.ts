/**
 * Unit tests for 3D bar extrusion utilities
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import type { FeatureCollection, Point } from 'geojson';
import type { PointProperties } from '$lib/types';
import {
	convertPointsToPolygons,
	getDesignColors,
	getDefaultColor,
	get3DCameraSettings,
	generateHeightExpression,
	generateColorExpression
} from '$lib/components/Map/utils/barExtrusionUtils';

describe('barExtrusionUtils', () => {
	describe('convertPointsToPolygons', () => {
		test('converts point features to polygon features', () => {
			const pointsData: FeatureCollection<Point, PointProperties> = {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						id: '1',
						geometry: {
							type: 'Point',
							coordinates: [5.0, 52.0]
						},
						properties: {
							id: '1',
							prevalenceValue: 0.5,
							samples: 100,
							design: 'Surveillance'
						}
					}
				]
			};

			const result = convertPointsToPolygons(pointsData);

			expect(result.type).toBe('FeatureCollection');
			expect(result.features.length).toBe(1);
			expect(result.features[0].geometry.type).toBe('Polygon');
		});

		test('calculates extrusion height based on prevalence', () => {
			const pointsData: FeatureCollection<Point, PointProperties> = {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						id: '1',
						geometry: {
							type: 'Point',
							coordinates: [5.0, 52.0]
						},
						properties: {
							id: '1',
							prevalenceValue: 0.5, // 50% prevalence
							samples: 100,
							design: 'Surveillance'
						}
					}
				]
			};

			const result = convertPointsToPolygons(pointsData);
			const height = result.features[0].properties.extrusionHeight;

			// 50% * 20 = 1000 meters, plus sample bonus, min 100
			expect(height).toBeGreaterThan(100);
			expect(height).toBeLessThanOrEqual(1000);
		});

		test('uses design color from mapping', () => {
			const pointsData: FeatureCollection<Point, PointProperties> = {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						id: '1',
						geometry: {
							type: 'Point',
							coordinates: [5.0, 52.0]
						},
						properties: {
							id: '1',
							prevalenceValue: 0.5,
							samples: 100,
							design: 'Surveillance'
						}
					}
				]
			};

			const result = convertPointsToPolygons(pointsData);
			const color = result.features[0].properties.color;

			expect(color).toBe('#FFE5B4'); // Surveillance color
		});

		test('uses default color for unknown design type', () => {
			const pointsData: FeatureCollection<Point, PointProperties> = {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						id: '1',
						geometry: {
							type: 'Point',
							coordinates: [5.0, 52.0]
						},
						properties: {
							id: '1',
							prevalenceValue: 0.5,
							samples: 100,
							design: 'Unknown Design Type' as any
						}
					}
				]
			};

			const result = convertPointsToPolygons(pointsData);
			const color = result.features[0].properties.color;

			expect(color).toBe('#808080'); // Default gray color
		});

		test('creates square polygon with correct coordinates', () => {
			const pointsData: FeatureCollection<Point, PointProperties> = {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						id: '1',
						geometry: {
							type: 'Point',
							coordinates: [5.0, 52.0]
						},
						properties: {
							id: '1',
							prevalenceValue: 0.5,
							samples: 100,
							design: 'Surveillance'
						}
					}
				]
			};

			const result = convertPointsToPolygons(pointsData);
			const coordinates = result.features[0].geometry.coordinates[0];

			// Should have 5 points (4 corners + closing point)
			expect(coordinates.length).toBe(5);

			// First and last points should be the same (closed polygon)
			expect(coordinates[0]).toEqual(coordinates[4]);
		});

		test('handles prevalence value between 0-1', () => {
			const pointsData: FeatureCollection<Point, PointProperties> = {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						id: '1',
						geometry: {
							type: 'Point',
							coordinates: [5.0, 52.0]
						},
						properties: {
							id: '1',
							prevalenceValue: 0.25, // 25% as decimal
							samples: 100,
							design: 'Surveillance'
						}
					}
				]
			};

			const result = convertPointsToPolygons(pointsData);
			const height = result.features[0].properties.extrusionHeight;

			expect(height).toBeGreaterThan(0);
		});

		test('handles prevalence value as percentage (0-100)', () => {
			const pointsData: FeatureCollection<Point, PointProperties> = {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						id: '1',
						geometry: {
							type: 'Point',
							coordinates: [5.0, 52.0]
						},
						properties: {
							id: '1',
							prevalenceValue: 75, // 75% as whole number
							samples: 100,
							design: 'Surveillance'
						}
					}
				]
			};

			const result = convertPointsToPolygons(pointsData);
			const height = result.features[0].properties.extrusionHeight;

			expect(height).toBeGreaterThan(0);
		});

		test('handles missing prevalence value', () => {
			const pointsData: FeatureCollection<Point, PointProperties> = {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						id: '1',
						geometry: {
							type: 'Point',
							coordinates: [5.0, 52.0]
						},
						properties: {
							id: '1',
							samples: 100,
							design: 'Surveillance'
						}
					}
				]
			};

			const result = convertPointsToPolygons(pointsData);

			// Should still create polygon with default height
			expect(result.features.length).toBe(1);
			expect(result.features[0].properties.extrusionHeight).toBeGreaterThan(0);
		});

		test('processes multiple points correctly', () => {
			const pointsData: FeatureCollection<Point, PointProperties> = {
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						id: '1',
						geometry: { type: 'Point', coordinates: [5.0, 52.0] },
						properties: { id: '1', prevalenceValue: 0.5, samples: 100, design: 'Surveillance' }
					},
					{
						type: 'Feature',
						id: '2',
						geometry: { type: 'Point', coordinates: [6.0, 53.0] },
						properties: { id: '2', prevalenceValue: 0.3, samples: 50, design: 'Cohort' }
					}
				]
			};

			const result = convertPointsToPolygons(pointsData);

			expect(result.features.length).toBe(2);
			expect(result.features[0].properties.color).toBe('#FFE5B4'); // Surveillance
			expect(result.features[1].properties.color).toBe('#9197FF'); // Cohort
		});
	});

	describe('getDesignColors', () => {
		test('returns object with design type colors', () => {
			const colors = getDesignColors();

			expect(colors['Surveillance']).toBe('#FFE5B4');
			expect(colors['Intervention Trial']).toBe('#B7EFC5');
			expect(colors['Case-Control']).toBe('#FFB3C6');
			expect(colors['Cohort']).toBe('#9197FF');
		});

		test('returns a copy of the colors object', () => {
			const colors1 = getDesignColors();
			const colors2 = getDesignColors();

			// Modifying one shouldn't affect the other
			colors1['Surveillance'] = '#000000';

			expect(colors2['Surveillance']).toBe('#FFE5B4');
		});
	});

	describe('getDefaultColor', () => {
		test('returns default gray color', () => {
			expect(getDefaultColor()).toBe('#808080');
		});
	});

	describe('get3DCameraSettings', () => {
		test('returns camera settings with pitch and bearing', () => {
			const settings = get3DCameraSettings();

			expect(settings.pitch).toBe(60);
			expect(settings.bearing).toBe(0);
		});

		test('returns consistent settings on multiple calls', () => {
			const settings1 = get3DCameraSettings();
			const settings2 = get3DCameraSettings();

			expect(settings1).toEqual(settings2);
		});
	});

	describe('generateHeightExpression', () => {
		test('returns valid MapLibre expression array', () => {
			const expression = generateHeightExpression();

			expect(Array.isArray(expression)).toBe(true);
			expect(expression[0]).toBe('interpolate');
		});

		test('includes zoom-based interpolation', () => {
			const expression = generateHeightExpression();

			expect(expression[1]).toEqual(['linear']);
			expect(expression[2]).toEqual(['zoom']);
		});

		test('has zoom stops at levels 10, 15, and 20', () => {
			const expression = generateHeightExpression();

			// Check for zoom level 10
			expect(expression[3]).toBe(10);
			// Check for zoom level 15
			expect(expression[5]).toBe(15);
			// Check for zoom level 20
			expect(expression[7]).toBe(20);
		});
	});

	describe('generateColorExpression', () => {
		test('returns valid MapLibre expression array', () => {
			const expression = generateColorExpression();

			expect(Array.isArray(expression)).toBe(true);
			expect(expression[0]).toBe('case');
		});

		test('includes height-based color thresholds', () => {
			const expression = generateColorExpression();

			// Should have conditions for different height ranges
			expect(expression).toContain('#FF4444'); // Very high
			expect(expression).toContain('#FF8844'); // High
			expect(expression).toContain('#CCCCCC'); // Low
		});

		test('has fallback color for low values', () => {
			const expression = generateColorExpression();

			// Last element should be fallback color
			expect(expression[expression.length - 1]).toBe('#CCCCCC');
		});
	});
});
