/**
 * Global test setup for Bun test runner
 * This file is executed before any tests run
 */

import { beforeAll, afterAll } from 'bun:test';
import { setupBrowserMocks, cleanupBrowserMocks } from '../helpers/mocks/browser';
import { setupGeoTIFFMocks, cleanupGeoTIFFMocks } from '../helpers/mocks/geotiff';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_MAPTILER_KEY = 'test_maptiler_key';
process.env.VITE_R2_BUCKET_URL = 'https://test.r2.dev';
process.env.BASE_PATH = '';

// Mock $app/environment for SvelteKit
// @ts-ignore
global.$app = {
	environment: {
		browser: false,
		dev: false,
		building: false,
		version: 'test'
	}
};

// Global setup
beforeAll(() => {
	console.log('🧪 Running test suite...');
	setupBrowserMocks();
	setupGeoTIFFMocks();
});

// Global teardown
afterAll(() => {
	cleanupBrowserMocks();
	cleanupGeoTIFFMocks();
	console.log('✅ Test suite completed');
});
