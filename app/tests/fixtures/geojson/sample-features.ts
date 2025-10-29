/**
 * Sample GeoJSON data for testing
 */

import type { PointFeature, PointFeatureCollection } from '$lib/types';

export const samplePointFeatures: PointFeature[] = [
	{
		type: 'Feature',
		id: 0,
		geometry: {
			type: 'Point',
			coordinates: [36.8219, -1.2921]
		},
		properties: {
			id: 'EST_001',
			pathogen: 'Shigella',
			ageGroup: 'Pre-school age children (<5 years)',
			ageGroupVal: '01_Age_PSAC',
			ageGroupLab: 'Pre-school age children (<5 years)',
			syndrome: 'Diarrhea (any severity)',
			syndromeVal: '02_Synd_Diar',
			syndromeLab: 'Diarrhea (any severity)',
			design: 'Surveillance',
			location: 'Kenya',
			heading: 'Shigella in Sub-Saharan Africa',
			subheading: 'GEMS Study 2007-2011',
			footnote: 'Community-based surveillance',
			prevalence: '15.3%',
			ageRange: '<5 years',
			duration: '2007-2011',
			source: 'GEMS Study',
			hyperlink: 'https://example.com/gems',
			cases: 153,
			samples: 1000,
			prevalenceValue: 0.153,
			standardError: 0.011
		}
	},
	{
		type: 'Feature',
		id: 1,
		geometry: {
			type: 'Point',
			coordinates: [90.4125, 23.8103]
		},
		properties: {
			id: 'EST_002',
			pathogen: 'Campylobacter',
			ageGroup: 'Pre-school age children (<5 years)',
			ageGroupVal: '01_Age_PSAC',
			ageGroupLab: 'Pre-school age children (<5 years)',
			syndrome: 'Asymptomatic',
			syndromeVal: '01_Synd_Asym',
			syndromeLab: 'Asymptomatic',
			design: 'Case-Control',
			location: 'Bangladesh',
			heading: 'Campylobacter in South Asia',
			subheading: 'MAL-ED Study 2009-2014',
			footnote: 'Birth cohort study',
			prevalence: '8.5%',
			ageRange: '<5 years',
			duration: '2009-2014',
			source: 'MAL-ED Study',
			hyperlink: 'https://example.com/maled',
			cases: 85,
			samples: 1000,
			prevalenceValue: 0.085,
			standardError: 0.008
		}
	}
];

export const sampleFeatureCollection: PointFeatureCollection = {
	type: 'FeatureCollection',
	features: samplePointFeatures
};
