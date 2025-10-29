/**
 * Mock SvelteKit modules for testing
 */

/**
 * Mock $app/environment
 */
export const mockEnvironment = {
	browser: false,
	dev: false,
	building: false,
	version: 'test'
};

/**
 * Setup SvelteKit mocks in global scope
 */
export function setupSvelteKitMocks(): void {
	// Mock $app/environment module
	// @ts-ignore
	if (!global.$app) {
		// @ts-ignore
		global.$app = {};
	}
	// @ts-ignore
	global.$app.environment = mockEnvironment;
}

/**
 * Cleanup SvelteKit mocks
 */
export function cleanupSvelteKitMocks(): void {
	// @ts-ignore
	if (global.$app) {
		// @ts-ignore
		delete global.$app;
	}
}
