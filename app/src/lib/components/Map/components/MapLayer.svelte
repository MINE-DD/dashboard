<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import { filteredPointsData } from '$lib/stores/filter.store';
	import { dataError } from '$lib/stores/data.store';
	import { visualizationType, type VisualizationType } from '$lib/stores/map.store';
	import {
		mapInstance,
		initializationState,
		pointsAddedToMap,
		isUpdatingVisualization,
		isProgrammaticSwitching,
		isAdjustingLayerOrder,
		canInitializeMap,
		mapLoaded,
		hasData,
		isProgrammaticOperation,
		setMapInstance,
		setInitializationState,
		setPointsAddedToMap,
		setMapError
	} from '$lib/stores/mapState.store';
	import {
		addInitialPointsToMap,
		switchVisualizationType as storeSwitchVisualizationType
	} from '../store/mapVisualizationManager';

	// Props
	export let map: MaplibreMap | null = null;

	// Event dispatcher for selected point
	const dispatch = createEventDispatcher();

	// Local state for tracking initialization
	let localMapSet = false;

	// Set the map instance in the store when it becomes available
	$: if (map && !localMapSet) {
		console.log('Setting map instance in store');
		setMapInstance(map);
		localMapSet = true;

		// Wait for map to be fully loaded and idle before allowing initialization
		if (map.loaded()) {
			// Map is already loaded, wait for idle state
			console.log('Map already loaded, waiting for idle state');
			map.once('idle', () => {
				console.log('Map is idle and ready');
				setInitializationState('idle');
			});
		} else {
			// Wait for map load event, then idle
			console.log('Waiting for map to load...');
			map.once('load', () => {
				console.log('Map loaded, waiting for idle state');
				map.once('idle', () => {
					console.log('Map is idle and ready');
					setInitializationState('idle');
				});
			});
		}
	}

	// Reactive statement to attempt initialization when conditions are met
	$: if ($canInitializeMap) {
		console.log('MapLayer: Conditions met for initialization');
		initializeVisualization();
	}

	// Log state changes for debugging
	$: console.log('MapLayer state:', {
		mapLoaded: $mapLoaded,
		hasData: $hasData,
		pointsAdded: $pointsAddedToMap,
		initializationState: $initializationState,
		canInit: $canInitializeMap
	});

	// Function to initialize the map visualization (called once when ready)
	async function initializeVisualization() {
		if ($initializationState === 'initializing' || $initializationState === 'ready') {
			return;
		}

		if (!map) {
			console.log('Cannot initialize: no map instance');
			return;
		}

		if (!$mapLoaded) {
			console.log('Cannot initialize: map not ready');
			return;
		}

		if (!$hasData) {
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
			setInitializationState('ready');
			setPointsAddedToMap(true);
			setupEventHandlers();
			if (map) {
				map.on('styledata', handleStyleChange);
			}
			return;
		}

		setInitializationState('initializing');
		console.log(
			'Initializing map visualization with',
			$filteredPointsData.features.length,
			'filtered data points'
		);
		const success = await addInitialPointsToMap(map, $filteredPointsData, $visualizationType, true);

		if (success) {
			console.log('✅ Map visualization initialized successfully');
			setInitializationState('ready');
			setupEventHandlers();
			if (map) {
				map.on('styledata', handleStyleChange);
			}
		} else {
			console.log('❌ Failed to initialize map visualization');
			setInitializationState('error');
			setMapError('Failed to initialize map visualization');
		}
	}

	// Define event handlers
	function handlePointClick(e: any) {
		console.log('Point clicked! Event:', e);
		if (e.features && e.features.length > 0) {
			const feature = e.features[0];
			console.log('Feature found:', feature);
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

			console.log('Dispatching pointclick event with:', {
				coordinates,
				properties
			});
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
			console.log('Adding click listener to points-layer');
			map.on('click', 'points-layer', handlePointClick);
			map.on('mouseenter', 'points-layer', handleMouseEnter);
			map.on('mouseleave', 'points-layer', handleMouseLeave);
		} else {
			console.log('points-layer not found when trying to add listeners');
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

	// Track the last visualization type to detect changes
	let lastVisualizationType: string | null = null;
	
	// Watch for visualization type changes and re-attach handlers when needed
	$: if (map && $mapLoaded && $initializationState === 'ready' && $visualizationType !== lastVisualizationType) {
		// Only re-attach if visualization type actually changed and not the first time
		if (lastVisualizationType !== null) {
			// Check if any of our visualization layers exist
			const hasPointsLayer = map.getLayer('points-layer');
			const hasPieChartLayers = map.getLayer('pie-charts-large') || 
										map.getLayer('pie-charts-medium') || 
										map.getLayer('pie-charts-small');
			const has3DBarsLayer = map.getLayer('3d-bars-layer');
			
			if (hasPointsLayer || hasPieChartLayers || has3DBarsLayer) {
				// Wait for map to be idle after visualization change
				console.log('Waiting for idle state to re-attach event handlers');
				map.once('idle', () => {
					console.log('Re-attaching event handlers after visualization change');
					removeEventHandlers(); // Clean up any existing handlers first
					setupEventHandlers();   // Attach fresh handlers
				});
			}
		}
		
		lastVisualizationType = $visualizationType;
	}

	// Handle style changes
	function handleStyleChange() {
		if ($isProgrammaticOperation) {
			// console.log('Style change detected during programmatic operation, ignoring in MapLayer.');
			return;
		}

		console.log('Style change detected (external/unexpected), reinitializing visualization...');
		setPointsAddedToMap(false);
		setInitializationState('idle');

		// Wait for map to be idle after style change
		if (map && $hasData) {
			map.once('idle', () => {
				console.log('Map idle after style change, reinitializing');
				if (map.loaded()) {
					initializeVisualization();
				}
			});
		}
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
			const result = await storeSwitchVisualizationType(
				map,
				$visualizationType,
				newType,
				$filteredPointsData
			);
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
