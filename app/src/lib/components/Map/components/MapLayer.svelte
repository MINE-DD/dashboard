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

	// Helper function to ensure points are always on top of all other layers
	let lastLogTime = 0;
	const logInterval = 5000; // Log message at most every 5 seconds

	function ensurePointsOnTop() {
		if (map && map.getLayer('points-layer')) {
			// Move the points layer to the top of all layers
			map.moveLayer('points-layer');

			const now = Date.now();
			if (now - lastLogTime > logInterval) {
				console.log('Ensured points layer is on top of all other layers');
				lastLogTime = now;
			}
		}
	}

	// Handle source data events to ensure points stay on top when new layers are added
	function handleSourceData(e: any) {
		// Only act when a source is loaded and points layer exists, and it's not our own source
		if (
			e.sourceDataType === 'metadata' &&
			map &&
			map.getLayer('points-layer') &&
			e.sourceId !== 'points-source'
		) {
			// Ensure points are on top whenever any other source is loaded
			ensurePointsOnTop();
		}
	}

	// Define a style change handler that can be bound properly
	function handleStyleChange() {
		// console.log('Style change detected, will re-add points once style is loaded');

		// Remove the old handler to avoid duplicates
		if (map) {
			map.off('styledata', handleStyleChange);
			map.off('sourcedata', handleSourceData);
		}

		// Reset point-added flag to allow re-adding
		pointsAdded = false;

		// Add the points back after style is loaded with more generous timeout
		setTimeout(() => {
			// console.log('Attempting to re-add points after style change');
			if (map && map.loaded()) {
				try {
					// Check if source and layer already exist before attempting to add
					let sourceExists = false;
					let layerExists = false;
					try {
						sourceExists = !!map.getSource('points-source');
						layerExists = !!map.getLayer('points-layer');
					} catch (e) {
						// Ignore errors if source/layer don't exist
					}

					if (!sourceExists || !layerExists) {
						addPointsToMap();
					} else {
						// If source and layer exist, just ensure points are on top
						ensurePointsOnTop();
					}
				} catch (e) {
					console.error('Error re-adding points after style change:', e);

					// Try again if first attempt fails - sometimes needed
					setTimeout(() => {
						console.log('Second attempt to add points after style change');
						if (map && map.loaded()) {
							// Check again before adding
							let sourceExists = false;
							let layerExists = false;
							try {
								sourceExists = !!map.getSource('points-source');
								layerExists = !!map.getLayer('points-layer');
							} catch (e) {
								// Ignore errors
							}
							if (!sourceExists || !layerExists) {
								addPointsToMap();
							} else {
								ensurePointsOnTop();
							}
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

	// Generate the paint color expression for pathogens
	function generatePathogenColorExpression() {
		// Create a MapLibre match expression for the pathogens
		const matchExpression: any[] = ['match', ['get', 'pathogen']];

		// Add an entry for each pathogen and its color
		// Use all known pathogens from the pathogenColors store, not just the filtered ones
		$pathogenColors.forEach((color, pathogen) => {
			matchExpression.push(pathogen);
			matchExpression.push(color);
		});

		// Add a default color (gray) for any unmatched pathogens
		matchExpression.push('#CCCCCC');

		return matchExpression;
	}

	// Add points when component mounts or when map becomes available
	function addPointsToMap() {
		// Only add points if map exists, is loaded, and we have data
		if (!map || !map.loaded() || !$pointsData.features.length) return;

		// Do nothing if points are already added
		if (pointsAdded) return;

		try {
			// console.log('Adding points to map...');

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

				// Add a circle layer for the points with colors based on pathogen type
				// Ensure it's added on top of all other layers by using a high z-index
				map.addLayer({
					id: 'points-layer',
					type: 'circle',
					source: 'points-source',
					paint: {
						'circle-radius': 10, // Keeping the bigger dots (10px radius)
						// Use a match expression to color by pathogen
						'circle-color': generatePathogenColorExpression() as any,
						'circle-opacity': 0.8,
						'circle-stroke-width': 1,
						'circle-stroke-color': '#ffffff'
					}
				});

				// Move the points layer to the top of all layers
				// This ensures it's always on top of raster layers
				ensurePointsOnTop();
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

			// Set up source data handler to ensure points stay on top when new layers are added
			map.on('sourcedata', handleSourceData);

			console.log(`Successfully added ${$pointsData.features.length} points to map`);
			layerAdded = true;
		} catch (error) {
			console.error('Error adding points to map:', error);
			// Reset flag so we can try again
			pointsAdded = false;
		}
	}

	// Reactively update the circle colors when pathogen colors change
	$: if (map && map.getLayer('points-layer') && $pathogenColors.size > 0 && pointsAdded) {
		try {
			map.setPaintProperty(
				'points-layer',
				'circle-color',
				generatePathogenColorExpression() as any
			);
		} catch (error) {
			console.error('Error updating circle colors:', error);
		}
	}

	// Add points when map is provided and data loads
	$: if (map && $pointsData.features.length > 0 && !pointsAdded && map.loaded()) {
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
			map.off('sourcedata', handleSourceData);

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
