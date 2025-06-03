<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { get } from 'svelte/store';
	import maplibregl, { type Map as MaplibreMap } from 'maplibre-gl';
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
		loadingMessage,
		dataError,
		visualizationType
	} from '../store';
	import {
		createPieChartImage,
		cleanupPieChartImages,
		generatePieChartSymbols,
		generatePieChartIconExpression,
		getAggregatedPointsData,
		getDesignColors,
		getDefaultColor
	} from '../utils/pieChartUtils';

	// Props
	export let map: MaplibreMap | null = null;
	export let layerId = 'study-points';
	export let sourceId = 'points-source';
	export let clusterPointsAtZoomLevels = false; // Enable/disable clustering

	// Event dispatcher for selected point
	const dispatch = createEventDispatcher();
	let layerAdded = false;

	// Expose a function to be called by the parent component
	export function bringPointsToFront() {
		ensurePointsOnTop();
	}

	// Manual visualization switching function
	export async function switchVisualizationType(newType: string) {
		console.log(`Switching visualization to: ${newType}`);

		if (!map || !map.loaded()) {
			console.warn('Map not ready for visualization switch');
			return;
		}

		// Check if source exists
		const sourceExists = !!map.getSource('points-source');
		console.log('Points source exists:', sourceExists);

		if (!sourceExists) {
			console.warn('Points source does not exist, cannot switch visualization');
			return;
		}

		// Update the visualization based on the new type
		if (newType === 'dots') {
			await switchToDots();
		} else if (newType === 'pie-charts') {
			await switchToPieCharts();
		}
	}

	// Switch to dots visualization
	async function switchToDots() {
		console.log('Switching to dots visualization...');

		if (!map) return;

		try {
			// Remove existing points layer if it exists
			if (map.getLayer('points-layer')) {
				map.removeLayer('points-layer');
			}

			// Clean up pie chart images
			cleanupPieChartImages(map);

			// Add circle layer for dots
			map.addLayer({
				id: 'points-layer',
				type: 'circle',
				source: 'points-source',
				paint: {
					'circle-radius': 10,
					'circle-color': generateDesignColorExpression() as any,
					'circle-opacity': 0.8,
					'circle-stroke-width': 1,
					'circle-stroke-color': '#ffffff'
				}
			});

			// Re-setup event handlers
			map.on('click', 'points-layer', handlePointClick);
			map.on('mouseenter', 'points-layer', handleMouseEnter);
			map.on('mouseleave', 'points-layer', handleMouseLeave);

			// Update the data source
			if (map.getSource('points-source')) {
				(map.getSource('points-source') as maplibregl.GeoJSONSource).setData($filteredPointsData);
			}

			// Ensure points are on top
			ensurePointsOnTop();

			console.log('Successfully switched to dots visualization');
		} catch (error) {
			console.error('Error switching to dots:', error);
		}
	}

	// Switch to pie charts visualization
	async function switchToPieCharts() {
		console.log('Switching to pie charts visualization...');
		console.log('Filtered data features count:', $filteredPointsData.features.length);

		if (!map) return;

		try {
			// Remove existing points layer if it exists
			if (map.getLayer('points-layer')) {
				console.log('Removing existing points layer');
				map.removeLayer('points-layer');
			}

			// Clean up old pie chart images
			console.log('Cleaning up pie chart images');
			cleanupPieChartImages(map);

			// Check if we have data to work with
			if ($filteredPointsData.features.length === 0) {
				console.warn('No filtered data available for pie charts');
				return;
			}
			// Get aggregated data for pie charts
			const aggregatedData = getAggregatedPointsData($filteredPointsData) as any;
			console.log('Aggregated data features count:', aggregatedData.features.length);

			// Generate pie chart symbols first
			console.log('Generating pie chart symbols...');
			await generatePieChartSymbols(map, $filteredPointsData, (loading) => {
				isLoading.set(loading);
				loadingMessage.set(loading ? 'Generating pie charts...' : 'Loading...');
			});

			console.log('Pie chart symbols generated, adding layer...');

			// Update the data source with aggregated data for pie charts
			if (map.getSource('points-source')) {
				console.log('Updating source with aggregated data');
				(map.getSource('points-source') as maplibregl.GeoJSONSource).setData(aggregatedData);
			}

			// Add symbol layer for pie charts
			map.addLayer({
				id: 'points-layer',
				type: 'symbol',
				source: 'points-source',
				layout: {
					'icon-image': generatePieChartIconExpression($filteredPointsData) as any,
					'icon-size': 1,
					'icon-allow-overlap': true,
					'icon-ignore-placement': true
				}
			});

			console.log('Pie chart layer added');

			// Re-setup event handlers
			map.on('click', 'points-layer', handlePointClick);
			map.on('mouseenter', 'points-layer', handleMouseEnter);
			map.on('mouseleave', 'points-layer', handleMouseLeave);

			// Ensure points are on top
			ensurePointsOnTop();

			console.log('Successfully switched to pie charts visualization');
		} catch (error) {
			console.error('Error switching to pie charts:', error);
		}
	}

	// ===== MAIN RENDERING APPROACH =====

	// Track if we've already added points to avoid duplicates
	let pointsAdded = false;

	// Track if we're currently switching visualization types to prevent double generation
	let switchingVisualizationType = false;

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
				// console.log('Ensured points layer is on top of all other layers');
				lastLogTime = now;
			}
		}
	}

	// Remove the handleSourceData listener as we will trigger from Map.svelte
	// function handleSourceData(e: any) {
	// 	// Only act when a source is loaded and points layer exists, and it's not our own source
	// 	if (
	// 		e.sourceDataType === 'metadata' &&
	// 		map &&
	// 		map.getLayer('points-layer') &&
	// 		e.sourceId !== 'points-source'
	// 	) {
	// 		// Ensure points are on top whenever any other source is loaded
	// 		ensurePointsOnTop();
	// 	}
	// }

	// Define a style change handler that can be bound properly
	function handleStyleChange() {
		// console.log('Style change detected, will re-add points once style is loaded');

		// Remove the old handler to avoid duplicates
		if (map) {
			map.off('styledata', handleStyleChange);
			// map.off('sourcedata', handleSourceData); // Removed
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

	// Generate the paint color expression for design types
	function generateDesignColorExpression() {
		// Create a MapLibre match expression for the design types
		const matchExpression: any[] = ['match', ['get', 'design']];
		const designColors = getDesignColors();

		// Add design type colors
		Object.entries(designColors).forEach(([design, color]) => {
			matchExpression.push(design);
			matchExpression.push(color);
		});

		// Default color
		matchExpression.push(getDefaultColor());

		return matchExpression;
	}

	// Legacy function kept for reference
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
	async function addPointsToMap() {
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
			// Get data from the filtered points store
			let dataToUse = $filteredPointsData;

			// Create the GeoJSON source with our data if it doesn't exist
			if (!sourceExists) {
				// For pie charts, use aggregated data
				if ($visualizationType === 'pie-charts') {
					dataToUse = getAggregatedPointsData($filteredPointsData) as any;
					console.log(
						'Using aggregated data for pie charts:',
						dataToUse.features.length,
						'features'
					);
				}

				map.addSource('points-source', {
					type: 'geojson',
					data: dataToUse
				});

				// Check visualization type and add appropriate layer
				if ($visualizationType === 'pie-charts') {
					// Generate pie chart symbols first
					await generatePieChartSymbols(map, $filteredPointsData, (loading) => {
						isLoading.set(loading);
						loadingMessage.set(loading ? 'Generating pie charts...' : 'Loading...');
					});

					// Add symbol layer for pie charts
					map.addLayer({
						id: 'points-layer',
						type: 'symbol',
						source: 'points-source',
						layout: {
							'icon-image': generatePieChartIconExpression($filteredPointsData) as any,
							'icon-size': 1,
							'icon-allow-overlap': true,
							'icon-ignore-placement': true
						}
					});
				} else {
					// Add circle layer for dots (default)
					map.addLayer({
						id: 'points-layer',
						type: 'circle',
						source: 'points-source',
						paint: {
							'circle-radius': 10, // Keeping the bigger dots (10px radius)
							// Use a match expression to color by design type
							'circle-color': generateDesignColorExpression() as any,
							'circle-opacity': 0.8,
							'circle-stroke-width': 1,
							'circle-stroke-color': '#ffffff'
						}
					});
				}

				// Move the points layer to the top of all layers
				// This ensures it's always on top of raster layers
				ensurePointsOnTop();
			} else {
				// Update the source data if it already exists
				(map.getSource('points-source') as maplibregl.GeoJSONSource).setData(dataToUse);
			}

			// Mark that we've successfully added or updated points
			pointsAdded = true;

			// Set up event handlers
			map.on('click', 'points-layer', handlePointClick);
			map.on('mouseenter', 'points-layer', handleMouseEnter);
			map.on('mouseleave', 'points-layer', handleMouseLeave);

			// Set up style change handler
			map.on('styledata', handleStyleChange);

			// Remove the source data handler as we will trigger from Map.svelte
			// map.on('sourcedata', handleSourceData);

			// console.log(`Successfully added ${$pointsData.features.length} points to map`);
			layerAdded = true;
		} catch (error) {
			console.error('Error adding points to map:', error);
			// Reset flag so we can try again
			pointsAdded = false;
		}
	}

	// Reactively update the circle colors when needed (only for circle layers)
	$: if (map && map.getLayer('points-layer') && pointsAdded && $visualizationType === 'dots') {
		try {
			const layer = map.getLayer('points-layer');
			if (layer && layer.type === 'circle') {
				map.setPaintProperty(
					'points-layer',
					'circle-color',
					generateDesignColorExpression() as any
				);
			}
		} catch (error) {
			console.error('Error updating circle colors:', error);
		}
	}

	// Add points when map is provided and data loads
	$: if (map && $pointsData.features.length > 0 && !pointsAdded && map.loaded()) {
		// console.log('Map and data available - initial attempt to add points');
		// console.log('Points data features:', $pointsData.features.length);
		// console.log('Filtered points data features:', $filteredPointsData.features.length);
		addPointsToMap();

		// Also add the style change handler
		if (map) {
			// console.log('Setting up style change handler');
			map.on('styledata', handleStyleChange);
		}
	}

	// Also try once on mount as a backup with multiple attempts
	onMount(() => {
		// console.log('Component mounted - backup attempt to add points');

		// First attempt
		setTimeout(() => {
			if (map && !pointsAdded && $pointsData.features.length > 0) {
				// console.log('First backup attempt to add points');
				// console.log('Points data features:', $pointsData.features.length);
				// console.log('Filtered points data features:', $filteredPointsData.features.length);
				addPointsToMap();
			}
		}, 800);

		// Second attempt
		setTimeout(() => {
			if (map && !pointsAdded && $pointsData.features.length > 0) {
				// console.log('Second backup attempt to add points');
				// console.log('Points data features:', $pointsData.features.length);
				// console.log('Filtered points data features:', $filteredPointsData.features.length);
				addPointsToMap();
			}
		}, 1500);

		// Third attempt
		setTimeout(() => {
			if (map && !pointsAdded && $pointsData.features.length > 0) {
				// console.log('Third backup attempt to add points');
				// console.log('Points data features:', $pointsData.features.length);
				// console.log('Filtered points data features:', $filteredPointsData.features.length);
				addPointsToMap();
			}
		}, 3000);
	});

	// Function to update map with filtered data
	async function updateMapWithFilteredData() {
		// Don't update if we're currently switching visualization types or if map is not available
		if (switchingVisualizationType || !map || !map.loaded()) return;

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
					$filteredPointsData.features.length,
					'of',
					$pointsData.features.length,
					'total'
				);

				// Get the current filter state for debugging
				const currentPathogens = Array.from(get(selectedPathogens));
				const currentAgeGroups = Array.from(get(selectedAgeGroups));
				const currentSyndromes = Array.from(get(selectedSyndromes));

				console.log('Current filter state during map update:', {
					pathogens: currentPathogens,
					ageGroups: currentAgeGroups,
					syndromes: currentSyndromes
				}); // Use the new visualization data store to get the appropriate data
				let dataToUpdate = $filteredPointsData;

				// For pie charts, use aggregated data
				if ($visualizationType === 'pie-charts') {
					dataToUpdate = getAggregatedPointsData($filteredPointsData) as any;
					console.log(
						'Using aggregated data for pie chart update:',
						dataToUpdate.features.length,
						'features'
					);
				}

				(map.getSource('points-source') as maplibregl.GeoJSONSource).setData(dataToUpdate);

				// For pie charts, we need to regenerate the symbols when data changes
				if ($visualizationType === 'pie-charts') {
					// Clean up existing pie chart images first
					cleanupPieChartImages(map);

					// Regenerate pie chart symbols for the new filtered data
					await generatePieChartSymbols(map, $filteredPointsData, (loading) => {
						isLoading.set(loading);
						loadingMessage.set(loading ? 'Generating pie charts...' : 'Loading...');
					});

					// Update the layer's icon expression if it exists
					if (map.getLayer('points-layer')) {
						map.setLayoutProperty(
							'points-layer',
							'icon-image',
							generatePieChartIconExpression($filteredPointsData) as any
						);
					}
				}

				// Ensure points are on top
				ensurePointsOnTop();
			} else if ($pointsData.features.length > 0 && !pointsAdded) {
				// If source doesn't exist yet but we have data, try to add points
				console.log('Source does not exist yet, adding points to map');
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
			// Remove the source data handler
			// map.off('sourcedata', handleSourceData);

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
