<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import maplibregl, { type Map } from 'maplibre-gl';
	import {
		pointsData,
		filteredPointsData,
		selectedPathogens,
		selectedAgeGroups,
		selectedSyndromes,
		pathogenColors,
		getMaplibreFilterExpression,
		clearFilterCache,
		isLoading,
		dataError
	} from '../store';

	// Props
	export let map: Map | null = null;
	export let layerId = 'study-points';
	export let sourceId = 'points-source';
	export let clusterPointsAtZoomLevels = false; // Enable/disable clustering

	// Event dispatcher for selected point
	const dispatch = createEventDispatcher();
	let layerAdded = false;

	// ===== MAIN RENDERING APPROACH =====

	// Track if we've already added points to avoid duplicates
	let pointsAdded = false;

	// Define event handlers
	function handlePointClick(e: any) {
		if (e.features && e.features.length > 0) {
			const feature = e.features[0];
			const coordinates = feature.geometry.coordinates.slice();
			const properties = feature.properties;

			dispatch('pointclick', {
				feature,
				coordinates,
				properties
			});
		}
	}

	function handleMouseEnter() {
		if (map) map.getCanvas().style.cursor = 'pointer';
	}

	function handleMouseLeave() {
		if (map) map.getCanvas().style.cursor = '';
	}

	// Define a style change handler that can be bound properly
	function handleStyleChange() {
		console.log('Style change detected, will re-add points once style is loaded');

		// Remove the old handler to avoid duplicates
		if (map) {
			map.off('styledata', handleStyleChange);
		}

		// Reset point-added flag to allow re-adding
		pointsAdded = false;

		// Add the points back after style is loaded with more generous timeout
		setTimeout(() => {
			console.log('Attempting to re-add points after style change');
			if (map && map.loaded()) {
				try {
					addPointsToMap();
				} catch (e) {
					console.error('Error re-adding points after style change:', e);

					// Try again if first attempt fails - sometimes needed
					setTimeout(() => {
						console.log('Second attempt to add points after style change');
						if (map && map.loaded()) {
							addPointsToMap();
						}
					}, 500);
				}
			}

			// Re-add the style change handler for future style changes
			if (map) {
				map.on('styledata', handleStyleChange);
			}
		}, 800); // More time to ensure style is properly loaded
	}

	// Add points when component mounts or when map becomes available
	function addPointsToMap() {
		// Only add points if map exists, is loaded, and we have data
		if (!map || !map.loaded() || !$pointsData.features.length) return;

		// Do nothing if points are already added
		if (pointsAdded) return;

		try {
			console.log('Adding points to map...');

			// Check if source already exists
			let sourceExists = false;
			try {
				sourceExists = !!map.getSource('points-source');
			} catch (e) {
				sourceExists = false;
			}

			// Create the GeoJSON source with our data if it doesn't exist
			if (!sourceExists) {
				map.addSource('points-source', {
					type: 'geojson',
					data: $filteredPointsData
				});

				// Add a circle layer for the points with colors based on prevalence
				map.addLayer({
					id: 'points-layer',
					type: 'circle',
					source: 'points-source',
					paint: {
						'circle-radius': 5,
						// Color based on prevalence percentage using prevalenceValue (numeric field)
						'circle-color': [
							'step',
							['get', 'prevalenceValue'], // Get prevalenceValue property from point data
							'#B7CCE8', // < 2.5%
							2.5,
							'#A8D5BA', // 2.5-4.9%
							5.0,
							'#CEE5A7', // 5.0-7.4%
							7.5,
							'#EFF1A7', // 7.5-9.9%
							10.0,
							'#FFEE9F', // 10.0-14.9%
							15.0,
							'#FEDAA2', // 15.0-19.9%
							20.0,
							'#FAB787', // 20.0-24.9%
							25.0,
							'#F68F79', // 25.0-29.9%
							30.0,
							'#F2A3B3' // >=30.0%
						],
						'circle-opacity': 0.8,
						'circle-stroke-width': 1,
						'circle-stroke-color': '#ffffff'
					}
				});
			} else {
				// Update the source data if it already exists
				(map.getSource('points-source') as maplibregl.GeoJSONSource).setData($filteredPointsData);
			}

			// Mark that we've successfully added or updated points
			pointsAdded = true;

			// Set up event handlers
			map.on('click', 'points-layer', handlePointClick);
			map.on('mouseenter', 'points-layer', handleMouseEnter);
			map.on('mouseleave', 'points-layer', handleMouseLeave);

			// Set up style change handler
			map.on('styledata', handleStyleChange);

			console.log(`Successfully added ${$pointsData.features.length} points to map`);
			layerAdded = true;
		} catch (error) {
			console.error('Error adding points to map:', error);
			// Reset flag so we can try again
			pointsAdded = false;
		}
	}

	// Add points when map is provided and data loads
	$: if (map && $pointsData.features.length > 0 && !pointsAdded) {
		console.log('Map and data available - initial attempt to add points');
		addPointsToMap();

		// Also add the style change handler
		if (map) {
			console.log('Setting up style change handler');
			map.on('styledata', handleStyleChange);
		}
	}

	// Also try once on mount as a backup
	onMount(() => {
		console.log('Component mounted - backup attempt to add points');
		setTimeout(() => {
			if (map && !pointsAdded && $pointsData.features.length > 0) {
				addPointsToMap();
			}
		}, 800);
	});

	// Update the map source when filtered data changes
	$: if (map && map.loaded()) {
		try {
			// First check if source exists
			let sourceExists = false;
			try {
				sourceExists = !!map.getSource('points-source');
			} catch (e) {
				sourceExists = false;
			}

			if (sourceExists) {
				console.log(
					'Updating map with filtered data, points:',
					$filteredPointsData.features.length
				);
				(map.getSource('points-source') as maplibregl.GeoJSONSource).setData($filteredPointsData);
			} else if ($pointsData.features.length > 0 && !pointsAdded) {
				// If source doesn't exist yet but we have data, try to add points
				addPointsToMap();
			}
		} catch (error) {
			console.error('Error updating map source with filtered data:', error);
		}
	}

	// Cleanup on component destruction
	onDestroy(() => {
		if (map) {
			// Remove event listeners with proper references to handler functions
			if (map.getLayer('points-layer')) {
				map.off('click', 'points-layer', handlePointClick);
				map.off('mouseenter', 'points-layer', handleMouseEnter);
				map.off('mouseleave', 'points-layer', handleMouseLeave);
			}
			map.off('styledata', handleStyleChange);

			// Remove layers and sources
			try {
				if (map.getLayer('points-layer')) {
					map.removeLayer('points-layer');
				}
				if (map.getSource('points-source')) {
					map.removeSource('points-source');
				}
			} catch (error) {
				console.error('Error cleaning up map resources:', error);
			}
		}
	});
</script>

{#if $dataError}
	<div class="map-error">
		<p>Error loading data: {$dataError}</p>
	</div>
{/if}
