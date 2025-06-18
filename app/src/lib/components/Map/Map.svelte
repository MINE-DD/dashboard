<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { getStyleById } from './MapStyles';
	import { selectedMapStyle } from '$lib/stores/mapStyle.store';
	import { get } from 'svelte/store';
	import {
		loadPointsData,
		isLoading,
		loadingMessage,
		dataError,
		pointsData,
		filteredPointsData,
		rasterLayers,
		updateAllRasterLayersOpacity,
		selectedPathogens,
		selectedAgeGroups,
		selectedSyndromes,
		clearFilterCache,
		pointsAddedToMap
	} from './store';
	import { parseUrlFilters, serializeFiltersToUrl, debounce } from './utils/urlParams';
	import { processPathogenData } from './utils/csvDataProcessor';
	import { isClickOnVisibleRaster } from './utils/rasterClickUtils';

	// Import modularized components
	import MapCore from './components/MapCore.svelte';
	import MapControls from './components/MapControls.svelte';
	import RasterLayerManager from './components/RasterLayerManager.svelte';
	import MapLayer from './components/MapLayer.svelte';
	import MapSidebar from './components/MapSidebar.svelte';
	import MapPopover from './components/MapPopover.svelte';
	import MapLegend from './components/MapLegend.svelte';

	// Props that can be passed to the component
	export let initialCenter: [number, number] = [-25, 16]; // Default center coordinates [lng, lat]
	export let initialZoom: number = 2; // Default zoom level
	export let initialStyleId: string | null = null; // Optional style ID to use

	// Define a constant for the data URL to ensure consistency
	const POINTS_DATA_URL = 'data/01_Points/Plan-EO_Dashboard_point_data.csv';
	export let pointDataUrl: string = POINTS_DATA_URL;

	// Track the global opacity value for raster layers
	let globalOpacity = 80; // Default to 80%

	// Map instance and state
	let map: MaplibreMap | null = null;
	let isStyleLoaded = false;

	// References to child components
	let mapLayerComponent: MapLayer;
	let rasterLayerManager: RasterLayerManager;

	// Popover state
	let showPopover = false;
	let popoverCoordinates: [number, number] | null = null;
	let popoverProperties: any = null;

	// Function to preload data before map initialization
	async function preloadData() {
		// Parse URL parameters
		const urlParams = parseUrlFilters();

		// Get the current state of filters
		const $selectedPathogens = get(selectedPathogens);
		const $selectedAgeGroups = get(selectedAgeGroups);
		const $selectedSyndromes = get(selectedSyndromes);

		// Log the current filter state
		// console.log('Current filter state before preloading:', {
		// 	pathogens: Array.from($selectedPathogens || []),
		// 	ageGroups: Array.from($selectedAgeGroups || []),
		// 	syndromes: Array.from($selectedSyndromes || [])
		// });

		// Clear filter cache before loading data to ensure fresh filtering
		clearFilterCache();

		// console.log('Preloading data with filters:', {
		// 	pathogens: Array.from($selectedPathogens || []),
		// 	ageGroups: Array.from($selectedAgeGroups || []),
		// 	syndromes: Array.from($selectedSyndromes || [])
		// });

		// Always force reload on initial load to ensure data is fresh
		await loadPointsData(POINTS_DATA_URL, true);

		// Log the loaded data size
		const $pointsData = get(pointsData);
		const $filteredPointsData = get(filteredPointsData);
		// console.log(
		// 	`Loaded ${$pointsData.features.length} total points, ${$filteredPointsData.features.length} filtered points`
		// );

		return urlParams;
	}

	// Handle map ready event
	function handleMapReady(event: CustomEvent<{ map: MaplibreMap }>) {
		map = event.detail.map;
		isStyleLoaded = true;

		// Force a single reload of the data to ensure filters are applied
		// This is simpler and more reliable than multiple reloads
		setTimeout(() => {
			// console.log('Map: Forcing data reload after map is ready');

			// Get the current filter state
			const $selectedPathogens = get(selectedPathogens);
			const $selectedAgeGroups = get(selectedAgeGroups);
			const $selectedSyndromes = get(selectedSyndromes);

			// Log the current filter state
			// console.log('Current filter state before reload:', {
			// 	pathogens: Array.from($selectedPathogens || []),
			// 	ageGroups: Array.from($selectedAgeGroups || []),
			// 	syndromes: Array.from($selectedSyndromes || [])
			// });

			// Clear filter cache again to ensure fresh filtering
			clearFilterCache();

			// Force reload with a longer timeout to ensure data is fully loaded
			loadPointsData(POINTS_DATA_URL, true).then(() => {
				// Log the loaded data size after reload
				const $pointsData = get(pointsData);
				const $filteredPointsData = get(filteredPointsData);
				// console.log(
				// 	`After map ready: ${$pointsData.features.length} total points, ${$filteredPointsData.features.length} filtered points`
				// );

				// Log the filter state after reload
				const currentPathogens = Array.from(get(selectedPathogens) || []);
				const currentAgeGroups = Array.from(get(selectedAgeGroups) || []);
				const currentSyndromes = Array.from(get(selectedSyndromes) || []);

				// console.log('Filter state after reload:', {
				// 	pathogens: currentPathogens,
				// 	ageGroups: currentAgeGroups,
				// 	syndromes: currentSyndromes
				// });
			});
		}, 800); // Increased timeout for better reliability

		// Add country boundaries GeoJSON source and layer
		if (map && !map.getSource('country-boundaries')) {
			map.addSource('country-boundaries', {
				type: 'geojson',
				data: '/ne_110m_admin_0_boundary_lines_land.geojson'
			});

			map.addLayer({
				id: 'country-boundaries-layer',
				type: 'line',
				source: 'country-boundaries',
				layout: {
					visibility: 'none' // Initially hidden
				},
				paint: {
					'line-color': '#80808090', // Blue color for boundaries
					'line-width': 2
				}
			});

			// Move the country boundaries layer to the top after other initial layers are likely added
			// Using a timeout to allow other components (like MapLayer, RasterLayerManager) to add their layers
			// The main call to ensureCorrectLayerOrder will now be triggered by pointsAddedToMap store
			// However, we can still move the country boundaries layer here if it exists early.
			setTimeout(() => {
				if (map && map.getLayer('country-boundaries-layer')) {
					// This specific move might be redundant if ensureCorrectLayerOrder runs soon after,
					// but can help if boundaries appear before points layer is fully ready.
					// map.moveLayer('country-boundaries-layer');
					// Let's rely on the reactive pointsAddedToMap for the main ordering.
				}
			}, 500); // Original delay for boundaries, can be adjusted or removed if covered by reactive block
		}
	}

	// Handle style change event
	function handleStyleChange() {
		isStyleLoaded = true;

		// Update URL when style changes
		if (map) {
			setTimeout(() => {
				serializeFiltersToUrl(map, globalOpacity);
			}, 100);
		}
	}

	// Handle map click event
	async function handleMapClick(event: CustomEvent) {
		if (!map) return;

		// Reset popup state to ensure we can show a new popup
		showPopover = false;
		popoverCoordinates = null;
		popoverProperties = null;

		// Check if the click was on a point feature
		let features: maplibregl.MapGeoJSONFeature[] = [];
		if (map.getLayer('points-layer')) {
			features = map.queryRenderedFeatures([event.detail.point.x, event.detail.point.y], {
				layers: ['points-layer']
			});
		}

		// If the click was on a point feature, let the point click handler handle it
		if (features.length > 0) {
			return;
		}

		// Check if the click is on land or water by querying all rendered features at the click point
		// Most map styles have a 'water' layer or something similar
		const allFeatures = map.queryRenderedFeatures([event.detail.point.x, event.detail.point.y]);

		// Check if any of the features at the click point are water features
		const isWater = allFeatures.some((feature) => {
			// Check for common water-related layer IDs and types
			const layerId = feature.layer.id.toLowerCase();
			const sourceLayer = feature.sourceLayer?.toLowerCase() || '';

			return (
				layerId.includes('water') ||
				layerId.includes('ocean') ||
				layerId.includes('sea') ||
				layerId.includes('lake') ||
				layerId.includes('river') ||
				sourceLayer.includes('water') ||
				sourceLayer.includes('ocean') ||
				sourceLayer.includes('sea') ||
				sourceLayer.includes('lake') ||
				sourceLayer.includes('river')
			);
		});

		// If the click is on water, don't show a popup
		if (isWater) {
			// Optional: could add a visual indication that water clicks are disabled
			// console.log('Click on water detected - no popup displayed');
			isLoading.set(false);
			return;
		}

		// For non-point, non-water clicks, get the coordinates
		const clickCoordinates: [number, number] = [event.detail.lngLat.lng, event.detail.lngLat.lat];

		const $currentRasterLayers = get(rasterLayers);
		const showRasterEstimationPopover = isClickOnVisibleRaster(
			clickCoordinates,
			$currentRasterLayers
		);

		if (!showRasterEstimationPopover) {
			// Click was not on any visible raster layer's bounds
			isLoading.set(false); // Ensure loading is off if we return early
			return;
		}

		// --- If we reach here, the click was on a visible raster layer ---
		// Proceed with existing logic to show the estimation popover
		isLoading.set(true);
		try {
			// Get visible raster layers to determine pathogen
			let pathogen = 'Shigella'; // Default pathogen
			let ageGroup = '0-11 months'; // Default age group

			// Try to get pathogen from visible raster layers
			// This logic can be kept or refined. For now, it uses the first visible raster.
			for (const [, layerDetails] of $currentRasterLayers) {
				if (layerDetails.isVisible) {
					const parts = layerDetails.name.split('_');
					if (parts.length > 0) {
						// Try to extract pathogen from layer name
						switch (parts[0]) {
							case 'SHIG':
								pathogen = 'Shigella';
								break;
							case 'ROTA':
								pathogen = 'Rotavirus';
								break;
							case 'NORO':
								pathogen = 'Norovirus';
								break;
							case 'CAMP':
								pathogen = 'Campylobacter';
								break;
							// Add more mappings as needed
						}
						// TODO: Potentially extract age group from layerDetails.name if needed
					}
					break; // Found the first visible layer, use its context
				}
			}

			// Process data for the clicked location
			const data = await processPathogenData(pathogen, clickCoordinates, ageGroup, '');

			// Format coordinates for display
			const formattedLng = clickCoordinates[0].toFixed(4);
			const formattedLat = clickCoordinates[1].toFixed(4);

			// Convert the data to a format compatible with MapPopover
			popoverProperties = {
				pathogen: pathogen,
				prevalenceValue: data.prevalence / 100, // Convert percentage to decimal
				ageGroup: data.ageRange,
				syndrome: '', // No syndrome for non-point clicks as per user feedback
				location: `Coordinates: ${formattedLng}, ${formattedLat}`, // Show actual coordinates
				cases: '-', // Not available for non-point clicks
				samples: '-', // Not available for non-point clicks
				standardError: (data.upperBound - data.lowerBound) / (2 * 196) / 100, // Approximate SE from CI
				study: data.study,
				duration: data.duration,
				source: data.source,
				hyperlink: data.sourceUrl
			};

			// Show the popover
			popoverCoordinates = clickCoordinates;
			showPopover = true;
		} catch (error) {
			console.error('Error processing data for popover:', error);
		} finally {
			// Hide loading state
			isLoading.set(false);
		}
	}

	// Handle point click events from MapLayer
	function handlePointClick(event: CustomEvent) {
		// Reset popup state to ensure we can show a new popup
		showPopover = false;
		popoverCoordinates = null;
		popoverProperties = null;

		// Set new popup data
		const { coordinates, properties } = event.detail;
		popoverCoordinates = coordinates;
		popoverProperties = properties;
		showPopover = true;
	}

	// Handle opacity change
	function handleOpacityChange(event: CustomEvent<{ opacity: number }>) {
		globalOpacity = event.detail.opacity;

		// Update URL when opacity changes
		if (map) {
			serializeFiltersToUrl(map, globalOpacity);
		}
	}

	// Handle visualization type change
	async function handleVisualizationChange(
		event: CustomEvent<{ visualizationType: string; timestamp: number }>
	) {
		const { visualizationType: newType } = event.detail;
		console.log(`Map received visualization change event: ${newType}`);

		// Function to attempt the visualization switch
		const attemptSwitch = async () => {
			if (mapLayerComponent && map && map.loaded()) {
				try {
					await mapLayerComponent.switchVisualizationType(newType);
					return true; // Success
				} catch (error) {
					console.error('Error during visualization switch:', error);
					return false;
				}
			}
			return false; // Not ready
		};

		// Try immediate switch first
		const success = await attemptSwitch();

		if (!success) {
			console.warn('Map or MapLayer not ready for visualization switch, retrying...');

			// Retry with exponential backoff
			const maxRetries = 5;
			const baseDelay = 100;

			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				const delay = baseDelay * Math.pow(2, attempt - 1); // 100ms, 200ms, 400ms, 800ms, 1600ms

				await new Promise((resolve) => setTimeout(resolve, delay));

				console.log(`Retry attempt ${attempt}/${maxRetries} for visualization switch`);
				const retrySuccess = await attemptSwitch();

				if (retrySuccess) {
					console.log(`Visualization switch succeeded on attempt ${attempt}`);
					return;
				}
			}

			console.error(`Failed to switch visualization after ${maxRetries} attempts`);
		}
	}

	// Initialize map and data
	onMount(async () => {
		// Preload data before initializing map
		const urlParams = await preloadData();

		// Override initial values with URL parameters if present
		if (urlParams.center) initialCenter = urlParams.center;
		if (urlParams.zoom) initialZoom = urlParams.zoom;
		if (urlParams.styleId) initialStyleId = urlParams.styleId;

		// Process opacity from URL if present
		if (urlParams.opacity !== undefined) {
			globalOpacity = urlParams.opacity;
			// Update global opacity for raster layers (value between 0-100)
			updateAllRasterLayersOpacity(urlParams.opacity / 100);
		}

		// Determine which style to use - prioritize initialStyleId if provided
		if (initialStyleId) {
			const styleFromId = getStyleById(initialStyleId);
			if (styleFromId) {
				// Update the store to match the initial style
				selectedMapStyle.set(styleFromId);
			} else {
				console.warn(`Initial style ID "${initialStyleId}" not found. Using default.`);
			}
		}
	});

	// Monitor filter changes to update URL
	$: if (map && isStyleLoaded) {
		// Use a small timeout to batch filter changes that might happen together
		setTimeout(() => {
			if (map) {
				serializeFiltersToUrl(map, globalOpacity);
			}
		}, 100);
	}

	// Reactive statement to ensure layer order once points are added to the map
	$: if ($pointsAddedToMap && map && isStyleLoaded && rasterLayerManager) {
		console.log('Map.svelte: pointsAddedToMap is true, ensuring layer order.');
		// Short delay to ensure map has processed the points layer addition
		setTimeout(() => {
			if (rasterLayerManager && typeof rasterLayerManager.ensureCorrectLayerOrder === 'function') {
				rasterLayerManager.ensureCorrectLayerOrder();
			}
		}, 250); // Increased delay
	}

	// Reactive statement to ensure layer order if raster layers change (e.g., a new one is added/shown)
	// This complements the onLayerAdded callback inside syncRasterLayers by providing a Map.svelte-level check.
	// It might be slightly redundant but acts as a fallback.
	let previousVisibleRasterCount = 0;
	$: {
		if (map && isStyleLoaded && rasterLayerManager) {
			const currentVisibleRasterCount = Array.from(get(rasterLayers).values()).filter(
				(l) => l.isVisible && l.bounds
			).length;
			if (currentVisibleRasterCount !== previousVisibleRasterCount) {
				console.log('Map.svelte: Visible raster count changed, ensuring layer order.');
				setTimeout(() => {
					if (
						rasterLayerManager &&
						typeof rasterLayerManager.ensureCorrectLayerOrder === 'function'
					) {
						rasterLayerManager.ensureCorrectLayerOrder();
					}
				}, 100); // Delay to allow map to update
			}
			previousVisibleRasterCount = currentVisibleRasterCount;
		}
	}
</script>

<div class="relative h-full">
	<!-- Map Core Component -->
	<MapCore
		{initialCenter}
		{initialZoom}
		{initialStyleId}
		bind:map
		on:ready={handleMapReady}
		on:styleChange={handleStyleChange}
		on:click={handleMapClick}
	/>

	<!-- Map Controls -->
	{#if map}
		<MapControls {map} position="top-right" />
	{/if}

	<!-- Raster Layer Manager -->
	{#if map && isStyleLoaded}
		<RasterLayerManager {map} {isStyleLoaded} bind:globalOpacity bind:this={rasterLayerManager} />
	{/if}

	<!-- Map Layer for Points -->
	{#if map && isStyleLoaded}
		<MapLayer {map} on:pointclick={handlePointClick} bind:this={mapLayerComponent} />
	{/if}

	<!-- Map Sidebar with filters -->
	<div class="absolute left-6 top-16 z-10">
		<MapSidebar
			class="hidden sm:block"
			bind:globalOpacity
			on:opacitychange={handleOpacityChange}
			on:visualizationchange={handleVisualizationChange}
		/>
	</div>

	<!-- Point Popover for details -->
	{#if map && showPopover && popoverCoordinates && popoverProperties}
		<MapPopover
			{map}
			coordinates={popoverCoordinates}
			properties={popoverProperties}
			visible={showPopover}
			on:close={() => {
				showPopover = false;
			}}
		/>
	{/if}

	<!-- Map Legend for design types -->
	{#if map && isStyleLoaded && $filteredPointsData.features.length > 0}
		<MapLegend visible={true} />
	{/if}

	<!-- Raster Popup has been removed as per requirements -->

	<!-- Loading indicator -->
	{#if $isLoading}
		<div class="alert fixed bottom-6 left-4 z-[1000] w-auto shadow-lg">
			<span class="text-sm font-medium">{$loadingMessage || 'Loading...'}</span>
		</div>
	{/if}

	<!-- Error Display -->
	{#if $dataError}
		<div class="error-overlay">
			<div class="error-container">
				<div class="error-icon">⚠️</div>
				<div class="error-message">Error: {$dataError}</div>
				<button class="retry-button" on:click={() => loadPointsData(POINTS_DATA_URL, true)}>
					Retry
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Error display */
	.error-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(255, 255, 255, 0.85);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1001; /* Ensure it's above map */
	}

	.error-container {
		background-color: white;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		padding: 20px;
		max-width: 400px;
		text-align: center;
	}

	.error-icon {
		font-size: 36px;
		margin-bottom: 10px;
	}

	.retry-button {
		/* Basic button styling */
		padding: 8px 16px;
		margin-top: 15px;
		border: none;
		border-radius: 4px;
		background-color: hsl(var(--p)); /* Use primary color */
		color: hsl(var(--pc)); /* Use primary content color */
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.retry-button:hover {
		background-color: hsl(var(--p) / 0.8); /* Slightly darker on hover */
	}
</style>
