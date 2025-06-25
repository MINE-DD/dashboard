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
	import type { VisualizationType } from './store/types';

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

		// Clear filter cache before loading data to ensure fresh filtering
		clearFilterCache();

		// Always force reload on initial load to ensure data is fresh
		await loadPointsData(POINTS_DATA_URL, true);

		return urlParams;
	}

	// Handle map ready event
	function handleMapReady(event: CustomEvent<{ map: MaplibreMap }>) {
		map = event.detail.map;
		isStyleLoaded = true;

		setTimeout(() => {
			clearFilterCache();
			loadPointsData(POINTS_DATA_URL, true).then(() => {
				// Optional: log data after reload
			});
		}, 800);

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
					visibility: 'none'
				},
				paint: {
					'line-color': '#80808090',
					'line-width': 2
				}
			});

			setTimeout(() => {
				// Layer ordering handled by reactive statements
			}, 500);
		}
	}

	// Handle style change event
	function handleStyleChange() {
		isStyleLoaded = true;
		if (map) {
			setTimeout(() => {
				serializeFiltersToUrl(map, globalOpacity);
			}, 100);
		}
	}

	// Handle map click event
	async function handleMapClick(event: CustomEvent) {
		if (!map) return;

		showPopover = false;
		popoverCoordinates = null;
		popoverProperties = null;

		let features: maplibregl.MapGeoJSONFeature[] = [];
		if (map.getLayer('points-layer')) {
			// Define a small bounding box around the click point to make selection more robust
			const pointClickPixelBuffer = 5; // 5px buffer
			const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
				[
					event.detail.point.x - pointClickPixelBuffer,
					event.detail.point.y - pointClickPixelBuffer
				],
				[event.detail.point.x + pointClickPixelBuffer, event.detail.point.y + pointClickPixelBuffer]
			];
			features = map.queryRenderedFeatures(bbox, {
				layers: ['points-layer']
			});
		}

		if (features.length > 0) {
			// A point feature was clicked, let MapLayer handle it via pointclick event
			// This event is caught by handlePointClick in this component.
			// No need to do anything further here, as handlePointClick will set popover details.
			return;
		}

		const allFeatures = map.queryRenderedFeatures([event.detail.point.x, event.detail.point.y]);
		const isWater = allFeatures.some((feature) => {
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

		if (isWater) {
			isLoading.set(false);
			return;
		}

		const clickCoordinates: [number, number] = [event.detail.lngLat.lng, event.detail.lngLat.lat];
		const $currentRasterLayers = get(rasterLayers);
		const showRasterEstimationPopover = isClickOnVisibleRaster(
			clickCoordinates,
			$currentRasterLayers
		);

		if (!showRasterEstimationPopover) {
			isLoading.set(false);
			return;
		}

		isLoading.set(true);
		try {
			let pathogen: string;
			const $currentSelectedPathogens = get(selectedPathogens);

			if ($currentSelectedPathogens && $currentSelectedPathogens.size > 0) {
				pathogen = $currentSelectedPathogens.values().next().value as string;
			} else {
				let inferredPathogenFromLayer = null;
				for (const [, layerDetails] of $currentRasterLayers) {
					if (layerDetails.isVisible) {
						const parts = layerDetails.name.split('_');
						if (parts.length > 0) {
							switch (parts[0].toUpperCase()) {
								case 'SHIG':
									inferredPathogenFromLayer = 'Shigella';
									break;
								case 'ROTA':
									inferredPathogenFromLayer = 'Rotavirus';
									break;
								case 'NORO':
									inferredPathogenFromLayer = 'Norovirus';
									break;
								case 'CAMP':
									inferredPathogenFromLayer = 'Campylobacter';
									break;
							}
						}
						if (inferredPathogenFromLayer) break;
					}
				}
				pathogen = inferredPathogenFromLayer || 'Shigella';
			}

			const $currentSelectedAgeGroups = get(selectedAgeGroups);
			let ageGroup = '0-11 months';
			if ($currentSelectedAgeGroups && $currentSelectedAgeGroups.size > 0) {
				ageGroup = $currentSelectedAgeGroups.values().next().value as string;
			}

			const data = await processPathogenData(pathogen, clickCoordinates, ageGroup, '');
			const formattedLng = clickCoordinates[0].toFixed(4);
			const formattedLat = clickCoordinates[1].toFixed(4);

			popoverProperties = {
				pathogen: pathogen,
				prevalenceValue: data.prevalence / 100,
				ageGroup: data.ageRange,
				syndrome: '',
				location: `Coordinates: ${formattedLng}, ${formattedLat}`,
				cases: '-',
				samples: '-',
				standardError: (data.upperBound - data.lowerBound) / (2 * 1.96) / 100,
				study: data.study,
				duration: data.duration,
				source: data.source,
				hyperlink: data.sourceUrl
			};

			popoverCoordinates = clickCoordinates;
			showPopover = true;
		} catch (error) {
			console.error('Error processing data for popover:', error);
		} finally {
			isLoading.set(false);
		}
	}

	function handlePointClick(event: CustomEvent) {
		showPopover = false;
		popoverCoordinates = null;
		popoverProperties = null;

		const { coordinates, properties } = event.detail;
		popoverCoordinates = coordinates;
		popoverProperties = properties;
		showPopover = true;
	}

	function handleOpacityChange(event: CustomEvent<{ opacity: number }>) {
		globalOpacity = event.detail.opacity;
		if (map) {
			serializeFiltersToUrl(map, globalOpacity);
		}
	}

	async function handleVisualizationChange(
		event: CustomEvent<{ visualizationType: VisualizationType; timestamp: number }>
	) {
		const { visualizationType: newType } = event.detail;
		console.log(`Map received visualization change event: ${newType}`);

		const attemptSwitch = async () => {
			if (mapLayerComponent && map && map.loaded()) {
				try {
					await mapLayerComponent.switchVisualizationType(newType);
					return true;
				} catch (error) {
					console.error('Error during visualization switch:', error);
					return false;
				}
			}
			return false;
		};

		let success = await attemptSwitch();
		if (!success) {
			console.warn('Map or MapLayer not ready for visualization switch, retrying...');
			const maxRetries = 5;
			const baseDelay = 100;
			for (let attempt = 1; attempt <= maxRetries && !success; attempt++) {
				const delay = baseDelay * Math.pow(2, attempt - 1);
				await new Promise((resolve) => setTimeout(resolve, delay));
				console.log(`Retry attempt ${attempt}/${maxRetries} for visualization switch`);
				success = await attemptSwitch();
			}
			if (success) {
				console.log(`Visualization switch succeeded after retries`);
			} else {
				console.error(`Failed to switch visualization after ${maxRetries} attempts`);
			}
		}
	}

	onMount(async () => {
		const urlParams = await preloadData();
		if (urlParams.center) initialCenter = urlParams.center;
		if (urlParams.zoom) initialZoom = urlParams.zoom;
		if (urlParams.styleId) initialStyleId = urlParams.styleId;
		if (urlParams.opacity !== undefined) {
			globalOpacity = urlParams.opacity;
			updateAllRasterLayersOpacity(urlParams.opacity / 100);
		}

		if (initialStyleId) {
			const styleFromId = getStyleById(initialStyleId);
			if (styleFromId) {
				selectedMapStyle.set(styleFromId);
			} else {
				console.warn(`Initial style ID "${initialStyleId}" not found. Using default.`);
			}
		}
	});

	$: if (map && isStyleLoaded) {
		setTimeout(() => {
			if (map) {
				serializeFiltersToUrl(map, globalOpacity);
			}
		}, 100);
	}

	$: if ($pointsAddedToMap && map && isStyleLoaded && rasterLayerManager) {
		console.log('Map.svelte: pointsAddedToMap is true, ensuring layer order.');
		setTimeout(() => {
			if (rasterLayerManager && typeof rasterLayerManager.ensureCorrectLayerOrder === 'function') {
				rasterLayerManager.ensureCorrectLayerOrder();
			}
		}, 250);
	}

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
				}, 100);
			}
			previousVisibleRasterCount = currentVisibleRasterCount;
		}
	}
</script>

<div class="relative h-full">
	<MapCore
		{initialCenter}
		{initialZoom}
		{initialStyleId}
		bind:map
		on:ready={handleMapReady}
		on:styleChange={handleStyleChange}
		on:click={handleMapClick}
	/>

	{#if map}
		<MapControls {map} position="top-right" />
	{/if}

	{#if map && isStyleLoaded}
		<RasterLayerManager {map} {isStyleLoaded} bind:globalOpacity bind:this={rasterLayerManager} />
	{/if}

	{#if map && isStyleLoaded}
		<MapLayer {map} on:pointclick={handlePointClick} bind:this={mapLayerComponent} />
	{/if}

	<div class="absolute left-6 top-16 z-10">
		<MapSidebar
			class="hidden sm:block"
			bind:globalOpacity
			on:opacitychange={handleOpacityChange}
			on:visualizationchange={handleVisualizationChange}
		/>
	</div>

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

	{#if map && isStyleLoaded && $filteredPointsData.features.length > 0}
		<MapLegend visible={true} />
	{/if}

	{#if $isLoading}
		<div class="alert fixed bottom-6 left-4 z-[1000] w-auto shadow-lg">
			<span class="text-sm font-medium">{$loadingMessage || 'Loading...'}</span>
		</div>
	{/if}

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
