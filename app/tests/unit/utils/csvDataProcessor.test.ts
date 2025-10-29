/**
 * Unit tests for CSV data processor utilities
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { calculateConfidenceInterval, processPathogenData } from '$lib/components/Map/utils/csvDataProcessor';
import { pointsData } from '$lib/stores/data.store';
import { createFeatureCollection } from '../../helpers/factories/point-data';

describe('csvDataProcessor', () => {
	describe('calculateConfidenceInterval', () => {
		test('calculates 95% confidence interval correctly', () => {
			const prevalence = 50; // 50%
			const standardError = 5; // 5%

			const result = calculateConfidenceInterval(prevalence, standardError);

			// 95% CI: 50 ± (1.96 * 5) = 50 ± 9.8 = [40.2, 59.8]
			expect(result.lower).toBeCloseTo(40.2, 1);
			expect(result.upper).toBeCloseTo(59.8, 1);
		});

		test('clamps lower bound to 0', () => {
			const prevalence = 5;
			const standardError = 10; // Large SE would result in negative lower bound

			const result = calculateConfidenceInterval(prevalence, standardError);

			expect(result.lower).toBe(0);
			expect(result.upper).toBeGreaterThan(prevalence);
		});

		test('clamps upper bound to 100', () => {
			const prevalence = 95;
			const standardError = 10; // Large SE would result in > 100 upper bound

			const result = calculateConfidenceInterval(prevalence, standardError);

			expect(result.lower).toBeLessThan(prevalence);
			expect(result.upper).toBe(100);
		});

		test('handles zero standard error', () => {
			const prevalence = 50;
			const standardError = 0;

			const result = calculateConfidenceInterval(prevalence, standardError);

			expect(result.lower).toBe(50);
			expect(result.upper).toBe(50);
		});

		test('handles edge case with zero prevalence', () => {
			const prevalence = 0;
			const standardError = 2;

			const result = calculateConfidenceInterval(prevalence, standardError);

			expect(result.lower).toBe(0);
			expect(result.upper).toBeGreaterThan(0);
		});

		test('handles edge case with 100% prevalence', () => {
			const prevalence = 100;
			const standardError = 2;

			const result = calculateConfidenceInterval(prevalence, standardError);

			expect(result.lower).toBeLessThan(100);
			expect(result.upper).toBe(100);
		});
	});

	describe('processPathogenData', () => {
		beforeEach(() => {
			// Setup mock data in the store
			const mockData = createFeatureCollection([
				{
					type: 'Feature',
					id: 0,
					geometry: {
						type: 'Point',
						coordinates: [36.8219, -1.2921]
					},
					properties: {
						id: 'TEST_001',
						pathogen: 'Shigella',
						ageGroup: 'Pre-school age children (<5 years)',
						ageGroupVal: '01_Age_PSAC',
						ageGroupLab: 'Pre-school age children (<5 years)',
						syndrome: 'Diarrhea (any severity)',
						syndromeVal: '02_Synd_Diar',
						syndromeLab: 'Diarrhea (any severity)',
						design: 'Surveillance',
						location: 'Kenya',
						heading: 'Test Study',
						subheading: 'Test Subheading',
						footnote: 'Test footnote',
						prevalence: '15.3%',
						ageRange: '<5 years',
						duration: '2007-2011',
						source: 'GEMS Study',
						hyperlink: 'https://example.com/gems',
						cases: 153,
						samples: 1000,
						prevalenceValue: 15.3, // Stored as percentage
						standardError: 1.1
					}
				}
			]);
			pointsData.set(mockData);
		});

		test('processes pathogen data successfully', async () => {
			const result = await processPathogenData(
				'Shigella',
				[36.8219, -1.2921],
				'Pre-school age children (<5 years)',
				'Diarrhea (any severity)'
			);

			expect(result.prevalence).toBe(15.3);
			expect(result.ageRange).toBe('Pre-school age children (<5 years)');
			expect(result.study).toBe('GEMS Study');
			expect(result.duration).toBe('2007-2011');
			expect(result.source).toBe('GEMS Study');
			expect(result.sourceUrl).toBe('https://example.com/gems');
		});

		test('calculates confidence intervals in result', async () => {
			const result = await processPathogenData(
				'Shigella',
				[36.8219, -1.2921],
				'Pre-school age children (<5 years)',
				'Diarrhea (any severity)'
			);

			expect(result.lowerBound).toBeGreaterThanOrEqual(0);
			expect(result.upperBound).toBeLessThanOrEqual(100);
			expect(result.lowerBound).toBeLessThan(result.prevalence);
			expect(result.upperBound).toBeGreaterThan(result.prevalence);
		});

		test('returns default values when no matching data found', async () => {
			const result = await processPathogenData(
				'NonExistentPathogen',
				[0, 0],
				'Unknown Age Group',
				'Unknown Syndrome'
			);

			expect(result.prevalence).toBe(0);
			expect(result.lowerBound).toBe(0);
			expect(result.upperBound).toBe(0);
			expect(result.study).toContain('No specific data point found');
			expect(result.source).toBe('N/A');
		});

		test('finds closest point when coordinates do not match exactly', async () => {
			const result = await processPathogenData(
				'Shigella',
				[36.82, -1.29], // Slightly different coordinates
				'Pre-school age children (<5 years)',
				'Diarrhea (any severity)'
			);

			// Should still find the point since it's close
			expect(result.prevalence).toBe(15.3);
			expect(result.source).toBe('GEMS Study');
		});

		test('handles empty data store gracefully', async () => {
			pointsData.set({ type: 'FeatureCollection', features: [] });

			const result = await processPathogenData(
				'Shigella',
				[0, 0],
				'Any Age Group',
				'Any Syndrome'
			);

			expect(result.prevalence).toBe(0);
			expect(result.study).toContain('No specific data point found');
		});
	});
});
