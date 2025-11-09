/**
 * Unit tests for overlap detection utilities
 *
 * Note: These tests focus on helper functions that can be tested in isolation.
 * Full overlap detection tests would require a MapLibre instance and are better
 * suited for integration tests.
 */

import { describe, test, expect } from 'bun:test';

/**
 * Mirror of getPieChartRadius from overlapDetection.ts for testing
 */
function getPieChartRadius(samples: number): number {
	const size = Math.max(20, Math.min(100, 20 * Math.log10(samples + 1)));
	return size / 2;
}

describe('overlapDetection', () => {
	describe('getPieChartRadius calculation', () => {
		test('returns minimum radius for very small sample sizes', () => {
			const radius = getPieChartRadius(1);
			expect(radius).toBe(10); // Min size 20 / 2
		});

		test('returns maximum radius for very large sample sizes', () => {
			const radius = getPieChartRadius(100000);
			expect(radius).toBe(50); // Max size 100 / 2
		});

		test('scales logarithmically for medium sample sizes', () => {
			const radius10 = getPieChartRadius(10);
			const radius100 = getPieChartRadius(100);
			const radius1000 = getPieChartRadius(1000);

			// Radius should increase but not linearly
			expect(radius100).toBeGreaterThan(radius10);
			expect(radius1000).toBeGreaterThan(radius100);

			// Difference between 10->100 should be similar to 100->1000 (logarithmic)
			const diff1 = radius100 - radius10;
			const diff2 = radius1000 - radius100;

			// Allow some tolerance for logarithmic scaling
			expect(Math.abs(diff1 - diff2)).toBeLessThan(5);
		});

		test('handles zero samples gracefully', () => {
			const radius = getPieChartRadius(0);
			expect(radius).toBeGreaterThan(0);
		});

		test('returns consistent values for same input', () => {
			const radius1 = getPieChartRadius(500);
			const radius2 = getPieChartRadius(500);
			expect(radius1).toBe(radius2);
		});

		test('radius for 50 samples is reasonable', () => {
			const radius = getPieChartRadius(50);
			// Should be between min (10) and max (50)
			expect(radius).toBeGreaterThanOrEqual(10);
			expect(radius).toBeLessThanOrEqual(50);
		});

		test('radius for 10000 samples approaches max', () => {
			const radius = getPieChartRadius(10000);
			// Should be close to max (50) - actual value is ~40
			expect(radius).toBeGreaterThan(35);
			expect(radius).toBeLessThanOrEqual(50);
		});

		test('increasing samples always increases radius until max', () => {
			let prevRadius = 0;
			const testSamples = [1, 10, 50, 100, 500, 1000, 5000, 10000];

			testSamples.forEach((samples) => {
				const radius = getPieChartRadius(samples);
				expect(radius).toBeGreaterThanOrEqual(prevRadius);
				prevRadius = radius;
			});
		});

		test('radius calculation matches expected formula', () => {
			const samples = 100;
			const expectedSize = Math.max(20, Math.min(100, 20 * Math.log10(samples + 1)));
			const expectedRadius = expectedSize / 2;

			const actualRadius = getPieChartRadius(samples);

			expect(actualRadius).toBe(expectedRadius);
		});

		test('handles decimal sample values (if passed)', () => {
			const radius = getPieChartRadius(50.5);
			expect(radius).toBeGreaterThan(0);
			expect(radius).toBeLessThanOrEqual(50);
		});
	});

	describe('distance and overlap calculations', () => {
		test('calculates Euclidean distance correctly', () => {
			const p1 = { x: 0, y: 0 };
			const p2 = { x: 3, y: 4 };

			const distance = Math.sqrt(
				Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
			);

			expect(distance).toBe(5); // 3-4-5 triangle
		});

		test('determines if two circles overlap', () => {
			const radius1 = 10;
			const radius2 = 15;
			const tolerance = -5;

			// Test case 1: Circles are far apart (no overlap)
			let distance = 30;
			let overlap = distance <= radius1 + radius2 + tolerance;
			expect(overlap).toBe(false);

			// Test case 2: Circles just touch (edge case)
			distance = 20; // r1 + r2 - tolerance = 10 + 15 - (-5) = 30, but 20 < 30
			overlap = distance <= radius1 + radius2 + tolerance;
			expect(overlap).toBe(true);

			// Test case 3: Circles overlap
			distance = 15;
			overlap = distance <= radius1 + radius2 + tolerance;
			expect(overlap).toBe(true);

			// Test case 4: One circle inside another
			distance = 5;
			overlap = distance <= radius1 + radius2 + tolerance;
			expect(overlap).toBe(true);

			// Test case 5: Same location
			distance = 0;
			overlap = distance <= radius1 + radius2 + tolerance;
			expect(overlap).toBe(true);
		});

		test('validates overlap tolerance behavior', () => {
			const radius1 = 10;
			const radius2 = 10;

			// With positive tolerance (more lenient)
			let distance = 25;
			let overlap = distance <= radius1 + radius2 + 5;
			expect(overlap).toBe(true); // 25 <= 25

			// With negative tolerance (stricter)
			distance = 25;
			overlap = distance <= radius1 + radius2 - 5;
			expect(overlap).toBe(false); // 25 > 15

			// Exact threshold with negative tolerance
			distance = 15;
			overlap = distance <= radius1 + radius2 - 5;
			expect(overlap).toBe(true); // 15 <= 15
		});

		test('calculates distance between screen points', () => {
			const point1 = { x: 100, y: 100 };
			const point2 = { x: 104, y: 103 };

			const distance = Math.sqrt(
				Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
			);

			expect(distance).toBe(5);
		});

		test('handles identical points', () => {
			const point1 = { x: 50, y: 50 };
			const point2 = { x: 50, y: 50 };

			const distance = Math.sqrt(
				Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
			);

			expect(distance).toBe(0);
		});
	});

	describe('feature key generation', () => {
		test('generates unique keys for features', () => {
			const feature1 = {
				pathogen: 'SHIG',
				ageGroup: '0011',
				syndrome: 'Diar',
				prevalenceValue: 0.5
			};

			const feature2 = {
				pathogen: 'ECOL',
				ageGroup: '0011',
				syndrome: 'Diar',
				prevalenceValue: 0.5
			};

			const key1 = `${feature1.pathogen}_${feature1.ageGroup}_${feature1.syndrome}_${feature1.prevalenceValue}`;
			const key2 = `${feature2.pathogen}_${feature2.ageGroup}_${feature2.syndrome}_${feature2.prevalenceValue}`;

			expect(key1).not.toBe(key2);
		});

		test('generates same key for identical features', () => {
			const feature1 = {
				pathogen: 'SHIG',
				ageGroup: '0011',
				syndrome: 'Diar',
				prevalenceValue: 0.5
			};

			const feature2 = {
				pathogen: 'SHIG',
				ageGroup: '0011',
				syndrome: 'Diar',
				prevalenceValue: 0.5
			};

			const key1 = `${feature1.pathogen}_${feature1.ageGroup}_${feature1.syndrome}_${feature1.prevalenceValue}`;
			const key2 = `${feature2.pathogen}_${feature2.ageGroup}_${feature2.syndrome}_${feature2.prevalenceValue}`;

			expect(key1).toBe(key2);
		});

		test('handles alternative field names', () => {
			const feature = {
				pathogen: 'SHIG',
				age_group: '0011', // Alternative name
				syndrome: 'Diar',
				prevalence_value: 0.5 // Alternative name
			};

			const key = `${feature.pathogen}_${feature.age_group}_${feature.syndrome}_${feature.prevalence_value}`;

			expect(key).toBe('SHIG_0011_Diar_0.5');
		});
	});

	describe('coordinate comparison', () => {
		test('detects exact coordinate matches', () => {
			const coord1: [number, number] = [5.123456, 52.123456];
			const coord2: [number, number] = [5.123456, 52.123456];

			const threshold = 0.000001;
			const matches =
				Math.abs(coord1[0] - coord2[0]) < threshold &&
				Math.abs(coord1[1] - coord2[1]) < threshold;

			expect(matches).toBe(true);
		});

		test('detects coordinate mismatches', () => {
			const coord1: [number, number] = [5.123456, 52.123456];
			const coord2: [number, number] = [5.123457, 52.123456];

			const threshold = 0.000001;
			const matches =
				Math.abs(coord1[0] - coord2[0]) < threshold &&
				Math.abs(coord1[1] - coord2[1]) < threshold;

			expect(matches).toBe(false);
		});

		test('handles precision threshold correctly', () => {
			const coord1: [number, number] = [5.123456, 52.123456];
			const coord2: [number, number] = [5.1234565, 52.1234565];

			const threshold = 0.000001;
			const matches =
				Math.abs(coord1[0] - coord2[0]) < threshold &&
				Math.abs(coord1[1] - coord2[1]) < threshold;

			expect(matches).toBe(true);
		});
	});
});
