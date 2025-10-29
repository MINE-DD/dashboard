/**
 * Mock $app/environment for testing
 * This file provides a fallback when SvelteKit's built-in module is not available
 */

export const browser = typeof window !== 'undefined';
export const dev = process.env.NODE_ENV === 'development';
export const building = false;
export const version = 'test';
