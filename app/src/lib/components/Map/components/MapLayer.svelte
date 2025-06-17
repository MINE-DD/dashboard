<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { get } from 'svelte/store';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import {
		pointsData,
		filteredPointsData,
		dataError,
		// Import the new map visualization manager
		setMapInstance,
		setPointsAddedToMap,
		addInitialPointsToMap,
		updateMapVisualization,
		switchVisualizationType as storeSwitchVisualizationType,
		// mapUpdateSignal, // Removed as part of refactor
		type VisualizationType
	} from '../store';

	// Props
	export let map: MaplibreMap | null = null;

	// Event dispatcher for selected point
	const dispatch = createEventDispatcher();

	// Track if the map instance has been set in the store
	let mapInstanceSet = false;
	let initializationAttempted = false;

	// Set the map instance in the store when it becomes available
	$: if (map && !mapInstanceSet) {
		console.log('Setting map instance in store');
		setMapInstance(map);
		mapInstanceSet = true;

		// Wait for map to be fully loaded before attempting initialization
		if (map.loaded()) {
			// Map is already loaded
			console.log('Map already loaded, will attempt initialization');
			// Small delay to ensure everything is settled
			setTimeout(() => {
				if ($filteredPointsData?.features?.length > 0) {
					console.log('Map already loaded and data ready, initializing...');
					initializeVisualization();
				}
			}, 200);
		} else {
			// Wait for map load event
			console.log('Waiting for map to load...');
			map.once('load', () => {
				console.log('Map load event fired');
				// Small delay to ensure everything is settled
				setTimeout(() => {
					if ($filteredPointsData?.features?.length > 0) {
						console.log('Map loaded and data ready, initializing...');
						initializeVisualization();
					}
				}, 200); // Increased delay
			});
		}
	}

	// Simple reactive statement to attempt initialization when data becomes available
	$: if (map && $filteredPointsData?.features?.length > 0 && !initializationAttempted) {
		setTimeout(() => {
			if (!initializationAttempted) {
				initializeVisualization();
			}
		}, 50);
	}

	// Function to initialize the map visualization (called once when ready)
	async function initializeVisualization() {
		if (initializationAttempted) {
			return;
		}

		if (!map) {
			console.log('Cannot initialize: no map instance');
			return;
		}

		// Check if map is ready - use multiple criteria
		const mapReady = map.loaded() || map.isStyleLoaded() || map.getStyle();

		if (!mapReady) {
			console.log('Cannot initialize: map not ready');
			return;
		}

		if (!$filteredPointsData?.features?.length) {
			console.log('Cannot initialize: no filtered data features available');
			// Don't reset initializationAttempted here to prevent infinite loops
			// The reactive statement will trigger again when data becomes available
			return;
		}

		// Check if source already exists to prevent duplicate initialization
		let sourceExists = false;
		try {
			sourceExists = !!map.getSource('points-source');
		} catch (e) {
			sourceExists = false;
		}

		if (sourceExists) {
			console.log('Points source already exists, skipping initialization');
			initializationAttempted = true;
			setPointsAddedToMap(true);
			// Setup event handlers since we're skipping the normal initialization
			setupEventHandlers();
			if (map) {
				map.on('styledata', handleStyleChange);
			}
			return;
		}

		initializationAttempted = true;
		console.log(
			'Initializing map visualization with',
			$filteredPointsData.features.length,
			'filtered data points'
		);
		const success = await addInitialPointsToMap();

		if (success) {
			console.log('✅ Map visualization initialized successfully');
			// Setup event handlers
			setupEventHandlers();
			// Setup style change handler
			if (map) {
				map.on('styledata', handleStyleChange);
			}
		} else {
			console.log('❌ Failed to initialize map visualization');
			// Only reset the flag if we actually tried but failed due to a real error
			// This prevents infinite loops when data is simply not available yet
			initializationAttempted = false;
		}
	}

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

	// Setup event handlers for both visualization types
	function setupEventHandlers() {
		if (!map) return;

		// Setup for circle layer (dots)
		if (map.getLayer('points-layer')) {
			map.on('click', 'points-layer', handlePointClick);
			map.on('mouseenter', 'points-layer', handleMouseEnter);
			map.on('mouseleave', 'points-layer', handleMouseLeave);
		}

		// Setup for pie chart layers
		const pieChartLayerIds = ['pie-charts-large', 'pie-charts-medium', 'pie-charts-small'];
		pieChartLayerIds.forEach((layerId) => {
			if (map.getLayer(layerId)) {
				map.on('click', layerId, handlePointClick);
				map.on('mouseenter', layerId, handleMouseEnter);
				map.on('mouseleave', layerId, handleMouseLeave);
			}
		});
	}

	// Remove event handlers
	function removeEventHandlers() {
		if (!map) return;

		// Remove circle layer handlers
		if (map.getLayer('points-layer')) {
			map.off('click', 'points-layer', handlePointClick);
			map.off('mouseenter', 'points-layer', handleMouseEnter);
			map.off('mouseleave', 'points-layer', handleMouseLeave);
		}

		// Remove pie chart layer handlers
		const pieChartLayerIds = ['pie-charts-large', 'pie-charts-medium', 'pie-charts-small'];
		pieChartLayerIds.forEach((layerId) => {
			if (map.getLayer(layerId)) {
				map.off('click', layerId, handlePointClick);
				map.off('mouseenter', layerId, handleMouseEnter);
				map.off('mouseleave', layerId, handleMouseLeave);
			}
		});
	}

	// Handle style changes
	function handleStyleChange() {
		console.log('Style change detected, reinitializing visualization...');

		// Reset the points added flag
		setPointsAddedToMap(false);
		initializationAttempted = false;

		// Small delay to let the style change settle
		setTimeout(() => {
			if (map && map.loaded() && $filteredPointsData?.features?.length > 0) {
				initializeVisualization();
			}
		}, 500);
	}

	onMount(() => {
		console.log('MapLayer component mounted');
	});

	onDestroy(() => {
		console.log('MapLayer component destroying');

		if (map) {
			removeEventHandlers();
			map.off('styledata', handleStyleChange);
		}

		// Reset map instance in store
		setMapInstance(null);
		setPointsAddedToMap(false);
	});

	// Export function for Map component to call
	export async function switchVisualizationType(newType: VisualizationType): Promise<boolean> {
		console.log(`MapLayer: Switching visualization to ${newType}`);

		try {
			// Use the store function to switch visualization type
			const result = await storeSwitchVisualizationType(newType);
			console.log(`MapLayer: Visualization switch result:`, result);
			return result;
		} catch (error) {
			console.error('MapLayer: Error switching visualization:', error);
			return false;
		}
	}
</script>

{#if $dataError}
	<div class="map-error">
		<p>Error loading data: {$dataError}</p>
	</div>
{/if}
