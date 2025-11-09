/**
 * Unit tests for general utility functions
 */

import { describe, test, expect } from 'bun:test';
import { slugFromPath, subString, formattedDate } from '$lib/utils/utils';

describe('utils', () => {
	describe('slugFromPath', () => {
		test('extracts slug from .md file path', () => {
			const path = '/blog/my-post.md';
			const slug = slugFromPath(path);
			expect(slug).toBe('my-post');
		});

		test('extracts slug from .svelte.md file path', () => {
			const path = '/blog/my-component.svelte.md';
			const slug = slugFromPath(path);
			expect(slug).toBe('my-component');
		});

		test('extracts slug from .svx file path', () => {
			const path = '/docs/getting-started.svx';
			const slug = slugFromPath(path);
			expect(slug).toBe('getting-started');
		});

		test('handles paths with hyphens', () => {
			const path = '/blog/my-awesome-post.md';
			const slug = slugFromPath(path);
			expect(slug).toBe('my-awesome-post');
		});

		test('handles paths with underscores', () => {
			const path = '/blog/my_awesome_post.md';
			const slug = slugFromPath(path);
			expect(slug).toBe('my_awesome_post');
		});

		test('returns null for invalid path', () => {
			const path = '/blog/no-extension';
			const slug = slugFromPath(path);
			expect(slug).toBeNull();
		});

		test('returns null for empty path', () => {
			const path = '';
			const slug = slugFromPath(path);
			expect(slug).toBeNull();
		});

		test('handles path with nested directories', () => {
			const path = '/blog/2023/12/my-post.md';
			const slug = slugFromPath(path);
			expect(slug).toBe('my-post');
		});

		test('handles path without leading slash', () => {
			const path = 'blog/my-post.md';
			const slug = slugFromPath(path);
			expect(slug).toBe('my-post');
		});

		test('handles numbers in filename', () => {
			const path = '/blog/post-123.md';
			const slug = slugFromPath(path);
			expect(slug).toBe('post-123');
		});
	});

	describe('subString', () => {
		test('extracts substring between two markers', () => {
			const input = 'Hello [START]world[END] test';
			const result = subString(input, '[START]', '[END]');
			expect(result).toBe('world');
		});

		test('handles markers with special characters', () => {
			const input = 'Hello {{content}} test';
			const result = subString(input, '{{', '}}');
			expect(result).toBe('content');
		});

		test('extracts content between parentheses', () => {
			const input = 'Hello (world) test';
			const result = subString(input, '(', ')');
			expect(result).toBe('world');
		});

		test('extracts content between brackets', () => {
			const input = 'Hello [world] test';
			const result = subString(input, '[', ']');
			expect(result).toBe('world');
		});

		test('handles empty substring', () => {
			const input = 'Hello [] test';
			const result = subString(input, '[', ']');
			expect(result).toBe('');
		});

		test('handles substring with spaces', () => {
			const input = 'Hello [  world  ] test';
			const result = subString(input, '[', ']');
			expect(result).toBe('  world  ');
		});

		test('handles substring with multiple occurrences', () => {
			const input = 'Hello [first] and [last] test';
			const result = subString(input, '[', ']');
			// Should extract between first '[' and last ']'
			expect(result).toBe('first] and [last');
		});

		test('handles markers that do not exist', () => {
			const input = 'Hello world';
			const result = subString(input, '[', ']');
			expect(result).toBeTruthy(); // Will return something based on indexOf behavior
		});

		test('extracts content between custom markers', () => {
			const input = 'Price: $100.00 USD';
			const result = subString(input, '$', ' ');
			expect(result).toBe('100.00');
		});

		test('handles multiline content', () => {
			const input = 'Start\n[content\nline2\nline3]End';
			const result = subString(input, '[', ']');
			expect(result).toBe('content\nline2\nline3');
		});
	});

	describe('formattedDate', () => {
		test('formats date string correctly', () => {
			const date = '2023-12-25';
			const formatted = formattedDate(date);
			// Matches "Dec 25, 2023" format used by en-UK locale
			expect(formatted).toMatch(/\w+\s\d{1,2},\s\d{4}/);
		});

		test('formats Date object correctly', () => {
			const date = new Date('2023-12-25');
			const formatted = formattedDate(date);
			expect(formatted).toMatch(/\w+\s\d{1,2},\s\d{4}/);
		});

		test('handles ISO date string', () => {
			const date = '2023-12-25T00:00:00.000Z';
			const formatted = formattedDate(date);
			expect(formatted).toBeTruthy();
			expect(formatted).toMatch(/\w+\s\d{1,2},\s\d{4}/);
		});

		test('formats timestamp correctly', () => {
			const timestamp = Date.now();
			const formatted = formattedDate(timestamp);
			expect(formatted).toBeTruthy();
			expect(formatted).toMatch(/\w+\s\d{1,2},\s\d{4}/);
		});

		test('handles different months correctly', () => {
			const janDate = '2023-01-15';
			const junDate = '2023-06-15';
			const decDate = '2023-12-15';

			const janFormatted = formattedDate(janDate);
			const junFormatted = formattedDate(junDate);
			const decFormatted = formattedDate(decDate);

			expect(janFormatted).toBeTruthy();
			expect(junFormatted).toBeTruthy();
			expect(decFormatted).toBeTruthy();

			// All should have year
			expect(janFormatted).toContain('2023');
			expect(junFormatted).toContain('2023');
			expect(decFormatted).toContain('2023');
		});

		test('formats leap year date', () => {
			const leapDate = '2024-02-29';
			const formatted = formattedDate(leapDate);
			expect(formatted).toBeTruthy();
			expect(formatted).toContain('2024');
		});

		test('formats first day of month', () => {
			const date = '2023-05-01';
			const formatted = formattedDate(date);
			expect(formatted).toBeTruthy();
		});

		test('formats last day of month', () => {
			const date = '2023-05-31';
			const formatted = formattedDate(date);
			expect(formatted).toBeTruthy();
		});

		test('formats dates consistently', () => {
			const date = '2023-12-25';
			const formatted1 = formattedDate(date);
			const formatted2 = formattedDate(date);
			expect(formatted1).toBe(formatted2);
		});
	});
});
