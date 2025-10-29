/**
 * Unit tests for GeoTIFF processor
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
	mercatorToLatLng,
	latLngToMercator,
	validateBounds,
	WEB_MERCATOR_MAX_LATITUDE
} from '$lib/components/Map/utils/geoTiffProcessor';
import { setupBrowserMocks, cleanupBrowserMocks } from '../../helpers/mocks/browser';
import { setupGeoTIFFMocks, cleanupGeoTIFFMocks } from '../../helpers/mocks/geotiff';

describe('geoTiffProcessor', () => {
	beforeAll(() => {
		setupBrowserMocks();
		setupGeoTIFFMocks();
	});

	afterAll(() => {
		cleanupBrowserMocks();
		cleanupGeoTIFFMocks();
	});

	describe('mercatorToLatLng', () => {
		test('converts Web Mercator coordinates to lat/lng', () => {
			const [lng, lat] = mercatorToLatLng(0, 0);

			expect(lng).toBeCloseTo(0, 5);
			expect(lat).toBeCloseTo(0, 5);
		});

		test('converts positive Web Mercator coordinates correctly', () => {
			// Test point: approximately London (lng: -0.12, lat: 51.5)
			const mercatorX = -13365;
			const mercatorY = 6710000;

			const [lng, lat] = mercatorToLatLng(mercatorX, mercatorY);

			expect(lng).toBeCloseTo(-0.12, 1);
			expect(lat).toBeCloseTo(51.5, 0);
		});

		test('converts negative Web Mercator coordinates correctly', () => {
			// Test point: approximately Sydney (lng: 151.2, lat: -33.9)
			const mercatorX = 16832000;
			const mercatorY = -4010000;

			const [lng, lat] = mercatorToLatLng(mercatorX, mercatorY);

			expect(lng).toBeCloseTo(151.2, 0);
			expect(lat).toBeCloseTo(-33.9, 0);
		});

		test('clamps latitude to Web Mercator max bounds', () => {
			const mercatorX = 0;
			const mercatorY = 30000000; // Very large Y (beyond max)

			const [_lng, lat] = mercatorToLatLng(mercatorX, mercatorY);

			expect(lat).toBeLessThanOrEqual(WEB_MERCATOR_MAX_LATITUDE);
			expect(lat).toBeGreaterThanOrEqual(-WEB_MERCATOR_MAX_LATITUDE);
		});

		test('clamps longitude to ±180', () => {
			const mercatorX = 30000000; // Very large X
			const mercatorY = 0;

			const [lng, _lat] = mercatorToLatLng(mercatorX, mercatorY);

			expect(lng).toBeLessThanOrEqual(180);
			expect(lng).toBeGreaterThanOrEqual(-180);
		});
	});

	describe('latLngToMercator', () => {
		test('converts lat/lng to Web Mercator coordinates', () => {
			const [mercX, mercY] = latLngToMercator(0, 0);

			expect(mercX).toBeCloseTo(0, 5);
			expect(mercY).toBeCloseTo(0, 5);
		});

		test('converts positive lat/lng correctly', () => {
			const [mercX, mercY] = latLngToMercator(45, 45);

			expect(mercX).toBeGreaterThan(0);
			expect(mercY).toBeGreaterThan(0);
		});

		test('converts negative lat/lng correctly', () => {
			const [mercX, mercY] = latLngToMercator(-45, -45);

			expect(mercX).toBeLessThan(0);
			expect(mercY).toBeLessThan(0);
		});

		test('clamps latitude to Web Mercator max bounds', () => {
			const [_mercX, mercY1] = latLngToMercator(0, 90); // Beyond max
			const [_mercX2, mercY2] = latLngToMercator(0, WEB_MERCATOR_MAX_LATITUDE);

			// Should clamp 90 to WEB_MERCATOR_MAX_LATITUDE
			expect(mercY1).toBe(mercY2);
		});

		test('roundtrip conversion preserves coordinates', () => {
			const originalLng = 45;
			const originalLat = 30;

			const [mercX, mercY] = latLngToMercator(originalLng, originalLat);
			const [lng, lat] = mercatorToLatLng(mercX, mercY);

			expect(lng).toBeCloseTo(originalLng, 5);
			expect(lat).toBeCloseTo(originalLat, 5);
		});
	});

	describe('validateBounds', () => {
		test('returns valid WGS84 bounds unchanged', () => {
			const bounds = [-180, -90, 180, 90];
			const result = validateBounds(bounds);

			expect(result).toEqual(bounds);
		});

		test('validates regional bounds correctly', () => {
			const bounds = [-10, 40, 10, 60]; // Europe
			const result = validateBounds(bounds);

			expect(result).toEqual(bounds);
		});

		test('converts Web Mercator bounds to WGS84', () => {
			const mercatorBounds = [-20037508.34, -20037508.34, 20037508.34, 20037508.34];
			const result = validateBounds(mercatorBounds, 'EPSG:3857');

			// Should convert to lat/lng
			expect(result[0]).toBeCloseTo(-180, 0);
			expect(result[2]).toBeCloseTo(180, 0);
			expect(Math.abs(result[1])).toBeLessThan(90);
			expect(Math.abs(result[3])).toBeLessThan(90);
		});

		test('handles Google Maps Compatible tile extent', () => {
			const tileBounds = [-20037508.34, -10018754.17, 20037508.34, 10018754.17];
			const result = validateBounds(tileBounds, 'EPSG:3857');

			// Should recognize and convert to standard tile bounds
			expect(result[0]).toBe(-180);
			expect(result[2]).toBe(180);
			expect(result[1]).toBeCloseTo(-66.51326, 3);
			expect(result[3]).toBeCloseTo(66.51326, 3);
		});

		test('handles invalid bounds with NaN', () => {
			const bounds = [NaN, -90, 180, 90];
			const result = validateBounds(bounds);

			// Should return default bounds
			expect(result).toBeDefined();
			expect(result.every((v) => !isNaN(v))).toBe(true);
		});

		test('handles invalid bounds with Infinity', () => {
			const bounds = [Infinity, -90, 180, 90];
			const result = validateBounds(bounds);

			// Should return default bounds
			expect(result).toBeDefined();
			expect(result.every((v) => isFinite(v))).toBe(true);
		});

		test('clamps out-of-range longitude', () => {
			const bounds = [-200, -45, 200, 45];
			const result = validateBounds(bounds);

			expect(result[0]).toBeGreaterThanOrEqual(-180);
			expect(result[0]).toBeLessThanOrEqual(180);
			expect(result[2]).toBeGreaterThanOrEqual(-180);
			expect(result[2]).toBeLessThanOrEqual(180);
		});

		test('clamps out-of-range latitude', () => {
			const bounds = [-90, -100, 90, 100];
			const result = validateBounds(bounds);

			expect(result[1]).toBeGreaterThanOrEqual(-90);
			expect(result[1]).toBeLessThanOrEqual(90);
			expect(result[3]).toBeGreaterThanOrEqual(-90);
			expect(result[3]).toBeLessThanOrEqual(90);
		});

		test('handles missing or malformed bounds', () => {
			const result = validateBounds([]);

			expect(result).toBeDefined();
			expect(result.length).toBe(4);
			expect(result.every((v) => typeof v === 'number')).toBe(true);
		});
	});
});
