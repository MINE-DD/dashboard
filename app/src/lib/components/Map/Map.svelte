<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { getStyleById } from './MapStyles';
	import { selectedMapStyle } from '$lib/stores/mapStyle.store';
	import {
		loadPointsData,
		isLoading,
		dataError,
		pointsData,
		filteredPointsData,
		rasterLayers,
		updateAllRasterLayersOpacity
	} from './store';
	import { parseUrlFilters, serializeFiltersToUrl, debounce } from './utils/urlParams';
	import { handleRasterLayerClick } from './utils/MapEventHandlers';

	// Import modularized components
	import MapCore from './components/MapCore.svelte';
	import MapControls from './components/MapControls.svelte';
	import RasterLayerManager from './components/RasterLayerManager.svelte';
	import MapLayer from './components/MapLayer.svelte';
	import MapSidebar from './components/MapSidebar.svelte';
	import MapPopover from './components/MapPopover.svelte';
	import RasterPopup from './components/RasterPopup.svelte';

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

	// Popover state for points
	let showPopover = false;
	let popoverCoordinates: [number, number] | null = null;
	let popoverProperties: any = null;

	// Popover state for raster layers
	let showRasterPopup = false;
	let rasterPopupCoordinates: [number, number] | null = null;
	let rasterPopupData = {
		prevalence: 0,
		lowerBound: 0,
		upperBound: 0,
		ageRange: '',
		study: '',
		duration: '',
		source: '',
		sourceUrl: ''
	};

	// Function to preload data before map initialization
	async function preloadData() {
		// Parse URL parameters
		const urlParams = parseUrlFilters();

		// Load point data with forceReload if URL has filter parameters
		await loadPointsData(POINTS_DATA_URL, urlParams.hasFilters);

		return urlParams;
	}

	// Handle map ready event
	function handleMapReady(event: CustomEvent<{ map: MaplibreMap }>) {
		map = event.detail.map;
		isStyleLoaded = true;
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
	function handleMapClick(event: CustomEvent) {
		if (map) {
			// Get visible raster layers
			const visibleRasterLayers: string[] = [];
			$rasterLayers.forEach((layer, id) => {
				if (layer.isVisible) {
					visibleRasterLayers.push(id);
				}
			});

			// Handle raster layer click
			if (visibleRasterLayers.length > 0) {
				handleRasterLayerClick(event.detail, map, visibleRasterLayers, $rasterLayers);

				// Hide point popover if it's showing
				showPopover = false;
			}
		}
	}

	// Handle point click events from MapLayer
	function handlePointClick(event: CustomEvent) {
		const { coordinates, properties } = event.detail;
		popoverCoordinates = coordinates;
		popoverProperties = properties;
		showPopover = true;

		// Hide raster popup if it's showing
		showRasterPopup = false;
	}

	// Handle opacity change
	function handleOpacityChange(event: CustomEvent<{ opacity: number }>) {
		globalOpacity = event.detail.opacity;

		// Update URL when opacity changes
		if (map) {
			serializeFiltersToUrl(map, globalOpacity);
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
		<MapSidebar class="hidden sm:block" bind:globalOpacity on:opacitychange={handleOpacityChange} />
	</div>

	<!-- Point Popover for details -->
	{#if map && showPopover && popoverCoordinates && popoverProperties}
		<MapPopover
			{map}
			coordinates={popoverCoordinates}
			properties={popoverProperties}
			visible={showPopover}
			on:close={() => (showPopover = false)}
		/>
	{/if}

	<!-- Raster Popup for details -->
	{#if map && showRasterPopup && rasterPopupCoordinates}
		<RasterPopup
			{map}
			coordinates={rasterPopupCoordinates}
			visible={showRasterPopup}
			prevalence={rasterPopupData.prevalence}
			lowerBound={rasterPopupData.lowerBound}
			upperBound={rasterPopupData.upperBound}
			ageRange={rasterPopupData.ageRange}
			study={rasterPopupData.study}
			duration={rasterPopupData.duration}
			source={rasterPopupData.source}
			sourceUrl={rasterPopupData.sourceUrl}
			on:close={() => (showRasterPopup = false)}
		/>
	{/if}

	<!-- Loading indicator -->
	{#if $isLoading}
		<div class="loading-indicator">
			<div class="loading-spinner"></div>
			<div class="loading-text">Loading...</div>
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
	/* Loading indicator */
	.loading-indicator {
		position: absolute;
		top: 16px;
		right: 16px;
		display: flex;
		align-items: center;
		background-color: rgba(255, 255, 255, 0.9);
		border-radius: 8px;
		padding: 8px 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		z-index: 1000;
	}

	.loading-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid #f3f3f3;
		border-top: 2px solid hsl(var(--p));
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-right: 8px;
	}

	.loading-text {
		font-size: 14px;
		color: #333;
		font-weight: 500;
	}

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

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
