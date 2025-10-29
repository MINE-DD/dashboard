/**
 * Test environment configuration
 * Mock environment variables for testing
 */

export const TEST_ENV = {
	VITE_MAPTILER_KEY: 'test_maptiler_key',
	VITE_R2_BUCKET_URL: 'https://test.r2.dev',
	BASE_PATH: '',
	NODE_ENV: 'test'
} as const;

/**
 * Apply test environment variables
 */
export function setupTestEnv(): void {
	Object.entries(TEST_ENV).forEach(([key, value]) => {
		process.env[key] = value;
	});
}
