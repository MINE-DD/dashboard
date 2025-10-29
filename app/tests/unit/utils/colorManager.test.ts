/**
 * Unit tests for color manager
 */

import { describe, test, expect } from 'bun:test';
import { generateColors } from '$lib/components/Map/utils/colorManager';

describe('colorManager', () => {
	describe('generateColors', () => {
		test('generates colors for a set of unique values', () => {
			const values = new Set(['A', 'B', 'C']);
			const colorMap = generateColors(values);

			expect(colorMap.size).toBe(3);
			expect(colorMap.has('A')).toBe(true);
			expect(colorMap.has('B')).toBe(true);
			expect(colorMap.has('C')).toBe(true);
		});

		test('assigns different colors to different values', () => {
			const values = new Set(['A', 'B', 'C']);
			const colorMap = generateColors(values);

			const colors = Array.from(colorMap.values());
			const uniqueColors = new Set(colors);

			// All colors should be different
			expect(uniqueColors.size).toBe(colors.length);
		});

		test('returns valid hex color codes', () => {
			const values = new Set(['A', 'B', 'C']);
			const colorMap = generateColors(values);

			colorMap.forEach((color) => {
				expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
			});
		});

		test('handles empty set', () => {
			const values = new Set<string>();
			const colorMap = generateColors(values);

			expect(colorMap.size).toBe(0);
		});

		test('handles single value', () => {
			const values = new Set(['OnlyValue']);
			const colorMap = generateColors(values);

			expect(colorMap.size).toBe(1);
			expect(colorMap.has('OnlyValue')).toBe(true);
		});

		test('cycles through colors for more values than available colors', () => {
			// Generate 20 values (more than the 15 predefined colors)
			const values = new Set(Array.from({ length: 20 }, (_, i) => `Value${i}`));
			const colorMap = generateColors(values);

			expect(colorMap.size).toBe(20);

			// Some colors should repeat (cycle)
			const colors = Array.from(colorMap.values());
			const uniqueColors = new Set(colors);
			expect(uniqueColors.size).toBeLessThan(colors.length);
		});

		test('produces consistent results for same input', () => {
			const values = new Set(['A', 'B', 'C']);

			const colorMap1 = generateColors(values);
			const colorMap2 = generateColors(values);

			// Sets preserve insertion order in JavaScript
			// So same input should produce same output
			expect(colorMap1.get('A')).toBe(colorMap2.get('A'));
			expect(colorMap1.get('B')).toBe(colorMap2.get('B'));
			expect(colorMap1.get('C')).toBe(colorMap2.get('C'));
		});

		test('handles special characters in values', () => {
			const values = new Set(['Value with spaces', 'Value_with_underscores', 'Value-with-dashes']);
			const colorMap = generateColors(values);

			expect(colorMap.size).toBe(3);
			expect(colorMap.has('Value with spaces')).toBe(true);
			expect(colorMap.has('Value_with_underscores')).toBe(true);
			expect(colorMap.has('Value-with-dashes')).toBe(true);
		});
	});
});
