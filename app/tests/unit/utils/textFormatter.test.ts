/**
 * Unit tests for text formatter utilities
 */

import { describe, test, expect } from 'bun:test';
import {
	formatItalicText,
	stripItalicMarkers,
	sortByValField,
	getCleanLabel,
	parseIndentationPrefix,
	formatDropdownText
} from '$lib/components/Map/utils/textFormatter';

describe('textFormatter', () => {
	describe('formatItalicText', () => {
		test('converts __text__ to <em>text</em>', () => {
			const input = 'This is __italic__ text';
			const expected = 'This is <em>italic</em> text';
			expect(formatItalicText(input)).toBe(expected);
		});

		test('handles multiple italic sections', () => {
			const input = '__First__ and __second__ italic';
			const expected = '<em>First</em> and <em>second</em> italic';
			expect(formatItalicText(input)).toBe(expected);
		});

		test('handles empty string', () => {
			expect(formatItalicText('')).toBe('');
		});

		test('handles text without markers', () => {
			const input = 'No italic text here';
			expect(formatItalicText(input)).toBe(input);
		});

		test('does not match text with underscores inside markers (regex limitation)', () => {
			// The regex uses [^_]+ which excludes underscores, so this won't match
			const input = 'Some __text_with_underscores__ here';
			expect(formatItalicText(input)).toBe(input); // No transformation
		});

		test('handles text without internal underscores', () => {
			const input = 'Some __italic text__ here';
			const expected = 'Some <em>italic text</em> here';
			expect(formatItalicText(input)).toBe(expected);
		});
	});

	describe('stripItalicMarkers', () => {
		test('removes __ markers from text', () => {
			const input = 'This is __italic__ text';
			const expected = 'This is italic text';
			expect(stripItalicMarkers(input)).toBe(expected);
		});

		test('handles multiple markers', () => {
			const input = '__First__ and __second__';
			const expected = 'First and second';
			expect(stripItalicMarkers(input)).toBe(expected);
		});

		test('handles empty string', () => {
			expect(stripItalicMarkers('')).toBe('');
		});

		test('handles text without markers', () => {
			const input = 'No markers here';
			expect(stripItalicMarkers(input)).toBe(input);
		});
	});

	describe('sortByValField', () => {
		interface TestItem {
			val?: string;
			name: string;
		}

		test('sorts by numeric prefix', () => {
			const items: TestItem[] = [
				{ val: '03_Test', name: 'C' },
				{ val: '01_Test', name: 'A' },
				{ val: '02_Test', name: 'B' }
			];

			const sorted = sortByValField(items, (item) => item.val);

			expect(sorted[0].val).toBe('01_Test');
			expect(sorted[1].val).toBe('02_Test');
			expect(sorted[2].val).toBe('03_Test');
		});

		test('sorts alphabetically when no numeric prefix', () => {
			const items: TestItem[] = [
				{ val: 'Zebra', name: 'Z' },
				{ val: 'Apple', name: 'A' },
				{ val: 'Banana', name: 'B' }
			];

			const sorted = sortByValField(items, (item) => item.val);

			expect(sorted[0].val).toBe('Apple');
			expect(sorted[1].val).toBe('Banana');
			expect(sorted[2].val).toBe('Zebra');
		});

		test('handles items without val field', () => {
			const items: TestItem[] = [
				{ name: 'B' },
				{ val: '01_Test', name: 'A' },
				{ name: 'C' }
			];

			const sorted = sortByValField(items, (item) => item.val);

			// Items without val should be sorted to the end
			expect(sorted[0].val).toBe('01_Test');
		});

		test('handles empty array', () => {
			const items: TestItem[] = [];
			const sorted = sortByValField(items, (item) => item.val);
			expect(sorted).toEqual([]);
		});

		test('does not modify original array', () => {
			const items: TestItem[] = [
				{ val: '02_Test', name: 'B' },
				{ val: '01_Test', name: 'A' }
			];

			const sorted = sortByValField(items, (item) => item.val);

			expect(items[0].val).toBe('02_Test'); // Original unchanged
			expect(sorted[0].val).toBe('01_Test'); // Sorted correctly
		});
	});

	describe('getCleanLabel', () => {
		test('returns lab field when available', () => {
			const result = getCleanLabel('01_Age_PSAC', 'Pre-school age children');
			expect(result).toBe('Pre-school age children');
		});

		test('extracts label from val field when lab is undefined', () => {
			const result = getCleanLabel('01_Age_PSAC', undefined);
			expect(result).toBe('PSAC');
		});

		test('extracts last part from val field', () => {
			const result = getCleanLabel('01_Category_Type_Final', undefined);
			expect(result).toBe('Final');
		});

		test('trims whitespace from lab field', () => {
			const result = getCleanLabel('01_Age_PSAC', '  Trimmed Label  ');
			expect(result).toBe('Trimmed Label');
		});

		test('returns empty string when both fields are undefined', () => {
			const result = getCleanLabel(undefined, undefined);
			expect(result).toBe('');
		});

		test('returns empty string when both fields are empty strings', () => {
			const result = getCleanLabel('', '');
			expect(result).toBe('');
		});
	});

	describe('parseIndentationPrefix', () => {
		test('detects ^^ prefix and returns indented flag', () => {
			const result = parseIndentationPrefix('^^Indented text');
			expect(result.isIndented).toBe(true);
			expect(result.text).toBe('Indented text');
		});

		test('handles text without prefix', () => {
			const result = parseIndentationPrefix('Normal text');
			expect(result.isIndented).toBe(false);
			expect(result.text).toBe('Normal text');
		});

		test('handles empty string', () => {
			const result = parseIndentationPrefix('');
			expect(result.isIndented).toBe(false);
			expect(result.text).toBe('');
		});

		test('handles single ^ (not a valid prefix)', () => {
			const result = parseIndentationPrefix('^Single caret');
			expect(result.isIndented).toBe(false);
			expect(result.text).toBe('^Single caret');
		});

		test('handles multiple ^^ prefixes (only removes first)', () => {
			const result = parseIndentationPrefix('^^^^Double prefix');
			expect(result.isIndented).toBe(true);
			expect(result.text).toBe('^^Double prefix');
		});
	});

	describe('formatDropdownText', () => {
		test('formats text with both indentation and italic markers', () => {
			const input = '^^This is __italic__ text';
			const result = formatDropdownText(input);
			expect(result).toBe('This is <em>italic</em> text');
		});

		test('formats text with only italic markers', () => {
			const input = 'This is __italic__ text';
			const result = formatDropdownText(input);
			expect(result).toBe('This is <em>italic</em> text');
		});

		test('formats text with only indentation prefix', () => {
			const input = '^^Indented text';
			const result = formatDropdownText(input);
			expect(result).toBe('Indented text');
		});

		test('handles text without any markers', () => {
			const input = 'Plain text';
			const result = formatDropdownText(input);
			expect(result).toBe('Plain text');
		});

		test('handles empty string', () => {
			const result = formatDropdownText('');
			expect(result).toBe('');
		});

		test('combines multiple formatting features', () => {
			const input = '^^Multiple __italic__ and __bold__ markers';
			const result = formatDropdownText(input);
			expect(result).toBe('Multiple <em>italic</em> and <em>bold</em> markers');
		});
	});
});
