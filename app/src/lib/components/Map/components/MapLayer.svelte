<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { get } from 'svelte/store';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import {
		// pointsData, // Not used directly, can be removed if not needed by other logic
		filteredPointsData,
		dataError,
		setMapInstance,
		setPointsAddedToMap,
		addInitialPointsToMap,
		// updateMapVisualization, // Not used directly
		switchVisualizationType as storeSwitchVisualizationType,
		// type VisualizationType // Already imported below
		isAdjustingLayerOrder, // Import the new store
		isUpdatingVisualization // Import this store as well
	} from '../store'; // This imports from ../store/index.ts

	import { isProgrammaticSwitching } from '../store/mapVisualizationManager'; // Correct path
	import type { VisualizationType } from '$lib/stores/map.store'; // Corrected path for VisualizationType

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
				if (get(filteredPointsData)?.features?.length > 0) {
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
					if (get(filteredPointsData)?.features?.length > 0) {
						console.log('Map loaded and data ready, initializing...');
						initializeVisualization();
					}
				}, 200); // Increased delay
			});
		}
	}

	// Simple reactive statement to attempt initialization when data becomes available
	$: if (map && get(filteredPointsData)?.features?.length > 0 && !initializationAttempted) {
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

		if (!get(filteredPointsData)?.features?.length) {
			console.log('Cannot initialize: no filtered data features available');
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
			setupEventHandlers();
			if (map) {
				map.on('styledata', handleStyleChange);
			}
			return;
		}

		initializationAttempted = true;
		console.log(
			'Initializing map visualization with',
			get(filteredPointsData).features.length,
			'filtered data points'
		);
		const success = await addInitialPointsToMap();

		if (success) {
			console.log('✅ Map visualization initialized successfully');
			setupEventHandlers();
			if (map) {
				map.on('styledata', handleStyleChange);
			}
		} else {
			console.log('❌ Failed to initialize map visualization');
			initializationAttempted = false;
		}
	}

	// Define event handlers
	function handlePointClick(e: any) {
		if (e.features && e.features.length > 0) {
			const feature = e.features[0];
			let coordinates;

			// Handle different geometry types
			if (feature.geometry.type === 'Point') {
				// For dots and pie charts (Point geometry)
				coordinates = feature.geometry.coordinates.slice();
			} else if (feature.geometry.type === 'Polygon') {
				// For 3D bars (Polygon geometry) - get the center of the polygon
				const polygonCoords = feature.geometry.coordinates[0]; // First ring of the polygon
				// Calculate center point of the polygon
				let sumLng = 0,
					sumLat = 0;
				const numPoints = polygonCoords.length - 1; // Exclude the closing point
				for (let i = 0; i < numPoints; i++) {
					sumLng += polygonCoords[i][0];
					sumLat += polygonCoords[i][1];
				}
				coordinates = [sumLng / numPoints, sumLat / numPoints];
			} else {
				// Fallback for other geometry types
				coordinates = feature.geometry.coordinates.slice();
			}

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

	// Setup event handlers for all visualization types
	function setupEventHandlers() {
		if (!map) return;

		if (map.getLayer('points-layer')) {
			map.on('click', 'points-layer', handlePointClick);
			map.on('mouseenter', 'points-layer', handleMouseEnter);
			map.on('mouseleave', 'points-layer', handleMouseLeave);
		}

		const pieChartLayerIds = ['pie-charts-large', 'pie-charts-medium', 'pie-charts-small'];
		pieChartLayerIds.forEach((layerId) => {
			if (map.getLayer(layerId)) {
				map.on('click', layerId, handlePointClick);
				map.on('mouseenter', layerId, handleMouseEnter);
				map.on('mouseleave', layerId, handleMouseLeave);
			}
		});

		// Add event handlers for 3D bars
		if (map.getLayer('3d-bars-layer')) {
			map.on('click', '3d-bars-layer', handlePointClick);
			map.on('mouseenter', '3d-bars-layer', handleMouseEnter);
			map.on('mouseleave', '3d-bars-layer', handleMouseLeave);
		}
	}

	// Remove event handlers
	function removeEventHandlers() {
		if (!map) return;

		if (map.getLayer('points-layer')) {
			map.off('click', 'points-layer', handlePointClick);
			map.off('mouseenter', 'points-layer', handleMouseEnter);
			map.off('mouseleave', 'points-layer', handleMouseLeave);
		}

		const pieChartLayerIds = ['pie-charts-large', 'pie-charts-medium', 'pie-charts-small'];
		pieChartLayerIds.forEach((layerId) => {
			if (map.getLayer(layerId)) {
				map.off('click', layerId, handlePointClick);
				map.off('mouseenter', layerId, handleMouseEnter);
				map.off('mouseleave', layerId, handleMouseLeave);
			}
		});

		// Remove event handlers for 3D bars
		if (map.getLayer('3d-bars-layer')) {
			map.off('click', '3d-bars-layer', handlePointClick);
			map.off('mouseenter', '3d-bars-layer', handleMouseEnter);
			map.off('mouseleave', '3d-bars-layer', handleMouseLeave);
		}
	}

	// Handle style changes
	function handleStyleChange() {
		if (
			get(isProgrammaticSwitching) ||
			get(isAdjustingLayerOrder) ||
			get(isUpdatingVisualization)
		) {
			// console.log('Style change detected during programmatic switch, layer order adjustment, or visualization update, ignoring in MapLayer.');
			return;
		}

		console.log('Style change detected (external/unexpected), reinitializing visualization...');
		setPointsAddedToMap(false);
		initializationAttempted = false;

		setTimeout(() => {
			if (map && map.loaded() && get(filteredPointsData)?.features?.length > 0) {
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
		setMapInstance(null);
		setPointsAddedToMap(false);
	});

	// Export function for Map component to call
	export async function switchVisualizationType(newType: VisualizationType): Promise<boolean> {
		console.log(`MapLayer: Switching visualization to ${newType}`);
		try {
			const result = await storeSwitchVisualizationType(newType);
			console.log(`MapLayer: Visualization switch result:`, result);
			return result;
		} catch (error) {
			console.error('MapLayer: Error switching visualization:', error);
			return false;
		}
	}
</script>

{#if get(dataError)}
	<div class="map-error">
		<p>Error loading data: {get(dataError)}</p>
	</div>
{/if}
