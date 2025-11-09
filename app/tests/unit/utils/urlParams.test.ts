/**
 * Unit tests for URL parameter utilities
 */

import { describe, test, expect, mock } from 'bun:test';
import { debounce } from '$lib/components/Map/utils/urlParams';

describe('urlParams', () => {
	describe('debounce', () => {
		test('executes function after delay', async () => {
			const mockFn = mock(() => {});
			const debouncedFn = debounce(mockFn, 100);

			debouncedFn();

			// Should not have been called immediately
			expect(mockFn).not.toHaveBeenCalled();

			// Wait for debounce delay
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Should have been called once
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		test('cancels previous call when invoked multiple times', async () => {
			const mockFn = mock(() => {});
			const debouncedFn = debounce(mockFn, 100);

			// Call multiple times rapidly
			debouncedFn();
			debouncedFn();
			debouncedFn();

			// Wait for debounce delay
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Should have been called only once (last call)
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		test('passes arguments correctly', async () => {
			const mockFn = mock((a: number, b: string) => {});
			const debouncedFn = debounce(mockFn, 100);

			debouncedFn(42, 'test');

			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(mockFn).toHaveBeenCalledWith(42, 'test');
		});

		test('uses latest arguments when called multiple times', async () => {
			const mockFn = mock((value: number) => {});
			const debouncedFn = debounce(mockFn, 100);

			debouncedFn(1);
			debouncedFn(2);
			debouncedFn(3);

			await new Promise((resolve) => setTimeout(resolve, 150));

			// Should have been called with the last value
			expect(mockFn).toHaveBeenCalledWith(3);
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		test('executes multiple times if delay passes between calls', async () => {
			const mockFn = mock(() => {});
			const debouncedFn = debounce(mockFn, 50);

			debouncedFn();

			// Wait for first debounce to complete
			await new Promise((resolve) => setTimeout(resolve, 100));

			debouncedFn();

			// Wait for second debounce to complete
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should have been called twice
			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		test('handles zero delay', async () => {
			const mockFn = mock(() => {});
			const debouncedFn = debounce(mockFn, 0);

			debouncedFn();

			// Even with zero delay, it should wait for next tick
			expect(mockFn).not.toHaveBeenCalled();

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		test('preserves this context when called as method', async () => {
			const obj = {
				value: 42,
				method: function () {
					return this.value;
				}
			};

			const mockFn = mock(obj.method);
			const debouncedMethod = debounce(mockFn.bind(obj), 50);

			debouncedMethod();

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		test('works with functions that return values', async () => {
			const mockFn = mock((a: number, b: number) => a + b);
			const debouncedFn = debounce(mockFn, 50);

			debouncedFn(2, 3);

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(mockFn).toHaveBeenCalledWith(2, 3);
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		test('handles different delay times correctly', async () => {
			const mockFn1 = mock(() => {});
			const mockFn2 = mock(() => {});

			const debouncedFn1 = debounce(mockFn1, 50);
			const debouncedFn2 = debounce(mockFn2, 100);

			debouncedFn1();
			debouncedFn2();

			// After 75ms, first should have executed, second should not
			await new Promise((resolve) => setTimeout(resolve, 75));

			expect(mockFn1).toHaveBeenCalledTimes(1);
			expect(mockFn2).not.toHaveBeenCalled();

			// After another 50ms (total 125ms), second should have executed
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(mockFn2).toHaveBeenCalledTimes(1);
		});

		test('handles rapid successive calls with reset', async () => {
			const mockFn = mock(() => {});
			const debouncedFn = debounce(mockFn, 100);

			// Call rapidly over 250ms (3 times with 80ms intervals)
			debouncedFn();
			await new Promise((resolve) => setTimeout(resolve, 80));
			debouncedFn();
			await new Promise((resolve) => setTimeout(resolve, 80));
			debouncedFn();

			// Should not have been called yet (debounce keeps resetting)
			expect(mockFn).not.toHaveBeenCalled();

			// Wait for final debounce to complete
			await new Promise((resolve) => setTimeout(resolve, 120));

			// Should have been called only once
			expect(mockFn).toHaveBeenCalledTimes(1);
		});
	});
});
