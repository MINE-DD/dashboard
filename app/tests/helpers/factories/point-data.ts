/**
 * Test data factories for creating mock point data
 */

import type { PointDataRow, PointFeature, PointFeatureCollection } from '$lib/types';

/**
 * Create a sample PointDataRow with customizable properties
 */
export function createPointDataRow(overrides?: Partial<PointDataRow>): PointDataRow {
	return {
		EST_ID: 'EST_TEST_001',
		Design: 'Surveillance',
		Pathogen: 'Shigella',
		Indicator: 'Prevalence (%)',
		AGE_VAL: '01_Age_PSAC',
		AGE_LAB: 'Pre-school age children (<5 years)',
		SYNDROME_VAL: '02_Synd_Diar',
		SYNDROME_LAB: 'Diarrhea (any severity)',
		Heading: 'Test Study',
		Subheading: 'Test Subheading',
		Prevalence: '15.0%',
		Age_range: '<5 years',
		Location: 'Test Location',
		Duration: '2020-2021',
		Source: 'Test Source',
		Hyperlink: 'https://example.com/test',
		Footnote: 'Test footnote',
		CASES: '150',
		SAMPLES: '1000',
		PREV: '0.15',
		SE: '0.01',
		SITE_LAT: '0.0',
		SITE_LON: '0.0',
		...overrides
	};
}

/**
 * Create multiple PointDataRows
 */
export function createPointDataRows(count: number, overrides?: Partial<PointDataRow>): PointDataRow[] {
	return Array.from({ length: count }, (_, i) =>
		createPointDataRow({
			EST_ID: `EST_TEST_${String(i + 1).padStart(3, '0')}`,
			SITE_LAT: String((i - count / 2) * 10),
			SITE_LON: String((i - count / 2) * 10),
			...overrides
		})
	);
}

/**
 * Create a sample PointFeature with customizable properties
 */
export function createPointFeature(overrides?: Partial<PointFeature>): PointFeature {
	return {
		type: 'Feature',
		id: 0,
		geometry: {
			type: 'Point',
			coordinates: [0, 0]
		},
		properties: {
			id: 'TEST_001',
			pathogen: 'Shigella',
			ageGroup: 'Pre-school age children (<5 years)',
			ageGroupVal: '01_Age_PSAC',
			ageGroupLab: 'Pre-school age children (<5 years)',
			syndrome: 'Diarrhea (any severity)',
			syndromeVal: '02_Synd_Diar',
			syndromeLab: 'Diarrhea (any severity)',
			design: 'Surveillance',
			location: 'Test Location',
			heading: 'Test Heading',
			subheading: 'Test Subheading',
			footnote: 'Test Footnote',
			prevalence: '15.0%',
			ageRange: '<5 years',
			duration: '2020-2021',
			source: 'Test Source',
			hyperlink: 'https://example.com',
			cases: 150,
			samples: 1000,
			prevalenceValue: 0.15,
			standardError: 0.01
		},
		...overrides
	};
}

/**
 * Create a sample PointFeatureCollection
 */
export function createFeatureCollection(
	features?: PointFeature[]
): PointFeatureCollection {
	return {
		type: 'FeatureCollection',
		features: features || [createPointFeature()]
	};
}

/**
 * Create multiple PointFeatures with different pathogens
 */
export function createMultiPathogenFeatures(): PointFeature[] {
	const pathogens = ['Shigella', 'Campylobacter', 'ETEC', 'Salmonella'];
	return pathogens.map((pathogen, i) =>
		createPointFeature({
			id: i,
			geometry: {
				type: 'Point',
				coordinates: [i * 10, i * 10]
			},
			properties: {
				...createPointFeature().properties,
				id: `TEST_${i + 1}`,
				pathogen
			}
		})
	);
}

/**
 * Create features with different age groups
 */
export function createMultiAgeGroupFeatures(): PointFeature[] {
	const ageGroups = [
		{ val: '01_Age_PSAC', lab: 'Pre-school age children (<5 years)' },
		{ val: '02_Age_SAC', lab: 'School age children (5-14 years)' },
		{ val: '03_Age_Adult', lab: 'Adults (≥15 years)' }
	];
	return ageGroups.map((age, i) =>
		createPointFeature({
			id: i,
			properties: {
				...createPointFeature().properties,
				id: `TEST_${i + 1}`,
				ageGroupVal: age.val,
				ageGroupLab: age.lab,
				ageGroup: age.lab
			}
		})
	);
}

/**
 * Create features with different syndromes
 */
export function createMultiSyndromeFeatures(): PointFeature[] {
	const syndromes = [
		{ val: '01_Synd_Asym', lab: 'Asymptomatic' },
		{ val: '02_Synd_Diar', lab: 'Diarrhea (any severity)' },
		{ val: '03_Synd_Medi', lab: 'Medically-attended diarrhea' }
	];
	return syndromes.map((syndrome, i) =>
		createPointFeature({
			id: i,
			properties: {
				...createPointFeature().properties,
				id: `TEST_${i + 1}`,
				syndromeVal: syndrome.val,
				syndromeLab: syndrome.lab,
				syndrome: syndrome.lab
			}
		})
	);
}
