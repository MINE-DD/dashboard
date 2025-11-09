/**
 * Unit tests for raster data processor utilities
 */

import { describe, test, expect } from 'bun:test';
import { extractLayerInfo } from '$lib/components/Map/utils/rasterDataProcessor';

describe('rasterDataProcessor', () => {
	describe('extractLayerInfo', () => {
		describe('pathogen extraction', () => {
			test('extracts Shigella pathogen', () => {
				const result = extractLayerInfo('SHIG 0-11 Asym Pr');
				expect(result.pathogen).toBe('Shigella');
			});

			test('extracts Rotavirus pathogen', () => {
				const result = extractLayerInfo('ROTA 12-23 Comm Pr');
				expect(result.pathogen).toBe('Rotavirus');
			});

			test('extracts Norovirus pathogen', () => {
				const result = extractLayerInfo('NORO 24-59 Medi Pr');
				expect(result.pathogen).toBe('Norovirus');
			});

			test('extracts Campylobacter pathogen', () => {
				const result = extractLayerInfo('CAMP 0-11 Asym Pr');
				expect(result.pathogen).toBe('Campylobacter');
			});

			test('returns empty string for unknown pathogen', () => {
				const result = extractLayerInfo('UNKNOWN 0-11 Asym Pr');
				expect(result.pathogen).toBe('');
			});

			test('handles pathogen code anywhere in layer name', () => {
				const result = extractLayerInfo('Layer SHIG data');
				expect(result.pathogen).toBe('Shigella');
			});
		});

		describe('age group extraction', () => {
			test('extracts 0-11 months age group (hyphen format)', () => {
				const result = extractLayerInfo('SHIG 0-11 Asym Pr');
				expect(result.ageGroup).toBe('0-11 months');
			});

			test('extracts 0-11 months age group (digit format)', () => {
				const result = extractLayerInfo('SHIG 0011 Asym Pr');
				expect(result.ageGroup).toBe('0-11 months');
			});

			test('extracts 12-23 months age group (hyphen format)', () => {
				const result = extractLayerInfo('ROTA 12-23 Comm Pr');
				expect(result.ageGroup).toBe('12-23 months');
			});

			test('extracts 12-23 months age group (digit format)', () => {
				const result = extractLayerInfo('ROTA 1223 Comm Pr');
				expect(result.ageGroup).toBe('12-23 months');
			});

			test('extracts 24-59 months age group (hyphen format)', () => {
				const result = extractLayerInfo('NORO 24-59 Medi Pr');
				expect(result.ageGroup).toBe('24-59 months');
			});

			test('extracts 24-59 months age group (digit format)', () => {
				const result = extractLayerInfo('NORO 2459 Medi Pr');
				expect(result.ageGroup).toBe('24-59 months');
			});

			test('returns empty string for unknown age group', () => {
				const result = extractLayerInfo('SHIG 60-120 Asym Pr');
				expect(result.ageGroup).toBe('');
			});

			test('handles age group anywhere in layer name', () => {
				const result = extractLayerInfo('Layer 0-11 data');
				expect(result.ageGroup).toBe('0-11 months');
			});
		});

		describe('syndrome extraction', () => {
			test('extracts Asymptomatic syndrome', () => {
				const result = extractLayerInfo('SHIG 0-11 Asym Pr');
				expect(result.syndrome).toBe('Asymptomatic');
			});

			test('extracts Community syndrome', () => {
				const result = extractLayerInfo('ROTA 12-23 Comm Pr');
				expect(result.syndrome).toBe('Community');
			});

			test('extracts Medical syndrome', () => {
				const result = extractLayerInfo('NORO 24-59 Medi Pr');
				expect(result.syndrome).toBe('Medical');
			});

			test('returns empty string for unknown syndrome', () => {
				const result = extractLayerInfo('SHIG 0-11 Unknown Pr');
				expect(result.syndrome).toBe('');
			});

			test('handles syndrome code anywhere in layer name', () => {
				const result = extractLayerInfo('Layer Asym data');
				expect(result.syndrome).toBe('Asymptomatic');
			});
		});

		describe('combined extraction', () => {
			test('extracts all components from standard layer name', () => {
				const result = extractLayerInfo('SHIG 0-11 Asym Pr');

				expect(result.pathogen).toBe('Shigella');
				expect(result.ageGroup).toBe('0-11 months');
				expect(result.syndrome).toBe('Asymptomatic');
			});

			test('extracts all components with digit age format', () => {
				const result = extractLayerInfo('CAMP 1223 Comm Pr');

				expect(result.pathogen).toBe('Campylobacter');
				expect(result.ageGroup).toBe('12-23 months');
				expect(result.syndrome).toBe('Community');
			});

			test('handles layer name with mixed formats', () => {
				const result = extractLayerInfo('ROTA 2459 Medi Pr');

				expect(result.pathogen).toBe('Rotavirus');
				expect(result.ageGroup).toBe('24-59 months');
				expect(result.syndrome).toBe('Medical');
			});

			test('returns all empty strings for unrecognized layer name', () => {
				const result = extractLayerInfo('Unknown Layer Name');

				expect(result.pathogen).toBe('');
				expect(result.ageGroup).toBe('');
				expect(result.syndrome).toBe('');
			});

			test('handles partial matches correctly', () => {
				const result = extractLayerInfo('SHIG Unknown Unknown');

				expect(result.pathogen).toBe('Shigella');
				expect(result.ageGroup).toBe('');
				expect(result.syndrome).toBe('');
			});

			test('handles layer name with extra information', () => {
				const result = extractLayerInfo('SHIG 0-11 Asym Pr Extra Info');

				expect(result.pathogen).toBe('Shigella');
				expect(result.ageGroup).toBe('0-11 months');
				expect(result.syndrome).toBe('Asymptomatic');
			});
		});

		describe('edge cases', () => {
			test('handles empty string', () => {
				const result = extractLayerInfo('');

				expect(result.pathogen).toBe('');
				expect(result.ageGroup).toBe('');
				expect(result.syndrome).toBe('');
			});

			test('handles whitespace-only string', () => {
				const result = extractLayerInfo('   ');

				expect(result.pathogen).toBe('');
				expect(result.ageGroup).toBe('');
				expect(result.syndrome).toBe('');
			});

			test('handles case-sensitive matches (uppercase)', () => {
				const result = extractLayerInfo('SHIG 0-11 ASYM PR');

				expect(result.pathogen).toBe('Shigella');
				expect(result.ageGroup).toBe('0-11 months');
				// Current implementation is case-sensitive for syndrome
				// 'ASYM' (uppercase) won't match 'Asym' in the code
				expect(result.syndrome).toBe('');
			});

			test('handles layer name with underscores', () => {
				const result = extractLayerInfo('SHIG_0-11_Asym_Pr');

				expect(result.pathogen).toBe('Shigella');
				expect(result.ageGroup).toBe('0-11 months');
				expect(result.syndrome).toBe('Asymptomatic');
			});

			test('handles layer name with multiple spaces', () => {
				const result = extractLayerInfo('SHIG   0-11   Asym   Pr');

				expect(result.pathogen).toBe('Shigella');
				expect(result.ageGroup).toBe('0-11 months');
				expect(result.syndrome).toBe('Asymptomatic');
			});

			test('handles layer name with leading/trailing spaces', () => {
				const result = extractLayerInfo('  SHIG 0-11 Asym Pr  ');

				expect(result.pathogen).toBe('Shigella');
				expect(result.ageGroup).toBe('0-11 months');
				expect(result.syndrome).toBe('Asymptomatic');
			});

			test('handles layer name with newlines', () => {
				const result = extractLayerInfo('SHIG\n0-11\nAsym\nPr');

				expect(result.pathogen).toBe('Shigella');
				expect(result.ageGroup).toBe('0-11 months');
				expect(result.syndrome).toBe('Asymptomatic');
			});
		});

		describe('all pathogen variations', () => {
			test('processes all standard pathogen layer names', () => {
				const layers = [
					{ name: 'SHIG 0-11 Asym Pr', pathogen: 'Shigella' },
					{ name: 'ROTA 12-23 Comm Pr', pathogen: 'Rotavirus' },
					{ name: 'NORO 24-59 Medi Pr', pathogen: 'Norovirus' },
					{ name: 'CAMP 0011 Asym Pr', pathogen: 'Campylobacter' }
				];

				layers.forEach(({ name, pathogen }) => {
					const result = extractLayerInfo(name);
					expect(result.pathogen).toBe(pathogen);
				});
			});
		});

		describe('all age group variations', () => {
			test('processes all standard age group layer names', () => {
				const layers = [
					{ name: 'SHIG 0-11 Asym Pr', ageGroup: '0-11 months' },
					{ name: 'SHIG 0011 Asym Pr', ageGroup: '0-11 months' },
					{ name: 'SHIG 12-23 Asym Pr', ageGroup: '12-23 months' },
					{ name: 'SHIG 1223 Asym Pr', ageGroup: '12-23 months' },
					{ name: 'SHIG 24-59 Asym Pr', ageGroup: '24-59 months' },
					{ name: 'SHIG 2459 Asym Pr', ageGroup: '24-59 months' }
				];

				layers.forEach(({ name, ageGroup }) => {
					const result = extractLayerInfo(name);
					expect(result.ageGroup).toBe(ageGroup);
				});
			});
		});

		describe('all syndrome variations', () => {
			test('processes all standard syndrome layer names', () => {
				const layers = [
					{ name: 'SHIG 0-11 Asym Pr', syndrome: 'Asymptomatic' },
					{ name: 'SHIG 0-11 Comm Pr', syndrome: 'Community' },
					{ name: 'SHIG 0-11 Medi Pr', syndrome: 'Medical' }
				];

				layers.forEach(({ name, syndrome }) => {
					const result = extractLayerInfo(name);
					expect(result.syndrome).toBe(syndrome);
				});
			});
		});
	});
});
