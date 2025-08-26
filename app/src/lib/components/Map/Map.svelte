<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { getStyleById } from './MapStyles';
	import { selectedMapStyle } from '$lib/stores/mapStyle.store';
	import {
		loadPointsData,
		isLoading,
		loadingMessage,
		dataError,
		pointsData,
		filteredPointsData,
		rasterLayers,
		updateAllRasterLayersOpacity,
		pathogens,
		ageGroups,
		syndromes,
		selectedPathogens,
		selectedAgeGroups,
		selectedSyndromes,
		clearFilterCache,
		pointsAddedToMap
	} from './store';
	import { parseUrlFilters, serializeFiltersToUrl, debounce } from './utils/urlParams';
	import { processPathogenData } from './utils/csvDataProcessor';
	import { isClickOnVisibleRaster } from './utils/rasterClickUtils';
	import { preloadData } from './utils/MapInitializer';
	import { getRasterValueAtCoordinate, findVisibleRasterLayerAtCoordinate } from './utils/rasterPixelQuery';

	// Import modularized components
	import MapCore from './components/MapCore.svelte';
	import MapControls from './components/MapControls.svelte';
	import RasterLayerManager from './components/RasterLayerManager.svelte';
	import MapLayer from './components/MapLayer.svelte';
	import MapSidebar from './components/MapSidebar.svelte';
	import MapPopover from './components/MapPopover.svelte';
	import MapLegend from './components/MapLegend.svelte';
	import MultiPointPopover from './components/MultiPointPopover.svelte';
	import type { VisualizationType } from './store/types';
	import { detectOverlappingFeatures } from './utils/overlapDetection';

	// Props that can be passed to the component
	export let initialCenter: [number, number] = [-25, 16]; // Default center coordinates [lng, lat]
	export let initialZoom: number = 2; // Default zoom level
	export let initialStyleId: string | null = null; // Optional style ID to use

	// Track the global opacity value for raster layers
	let globalOpacity = 80; // Default to 80%

	// Map instance and state
	let map: MaplibreMap | null = null;
	let isStyleLoaded = false;

	// References to child components
	let rasterLayerManager: RasterLayerManager;

	// Popover state
	let showPopover = false;
	let popoverCoordinates: [number, number] | null = null;
	let popoverProperties: any = null;
	
	// Multi-point popover state
	let showMultiPointPopover = false;
	let multiPointFeatures: maplibregl.MapGeoJSONFeature[] = [];


	// Handle map ready event
	function handleMapReady(event: CustomEvent<{ map: MaplibreMap }>) {
		map = event.detail.map;
		isStyleLoaded = true;

		// Load data immediately when map is ready
		// DISABLED: Data is already loaded by preloadData in MapInitializer
		// clearFilterCache();
		// loadPointsData(pointDataUrl, true).then(() => {
		// 	// Data loaded successfully
		// 	console.log('Initial data loaded');
		// });

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
			
			// Layer ordering will be handled by reactive statements when data is ready
		}
	}

	// Handle style change event
	function handleStyleChange() {
		isStyleLoaded = true;
		if (map) {
			// Use idle event to ensure map is ready for URL serialization
			map.once('idle', () => {
				serializeFiltersToUrl(map, globalOpacity);
			});
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
		const currentRasterLayers = $rasterLayers;
		
		console.log('Available raster layers:', Array.from(currentRasterLayers.entries()).map(([id, layer]) => ({
			id,
			name: layer.name,
			bounds: layer.bounds,
			visible: layer.isVisible
		})));
		
		// Find the visible raster layer at this coordinate
		console.log('Checking for raster at coordinates:', clickCoordinates);
		const visibleRasterLayer = findVisibleRasterLayerAtCoordinate(
			currentRasterLayers,
			clickCoordinates[0],
			clickCoordinates[1]
		);
		console.log('Found visible raster layer:', visibleRasterLayer);

		if (!visibleRasterLayer) {
			isLoading.set(false);
			return;
		}

		isLoading.set(true);
		try {
			// Get the actual raster value at this coordinate
			const rasterValue = getRasterValueAtCoordinate(
				visibleRasterLayer,
				clickCoordinates[0],
				clickCoordinates[1]
			);

			if (rasterValue === null) {
				// No data at this location (e.g., ocean)
				isLoading.set(false);
				return;
			}

			// Infer pathogen and age group from the layer name
			let pathogen = '';
			let ageGroup = '';
			let syndrome = '';
			
			const layerName = visibleRasterLayer.name;
			const parts = layerName.split(' ');
			
			// Parse pathogen from layer name (e.g., "SHIG 0-11 Asym Pr")
			if (parts.length > 0) {
				switch (parts[0].toUpperCase()) {
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
					default:
						pathogen = parts[0];
				}
			}
			
			// Parse age group from layer name (e.g., "0-11" -> "0-11 months")
			if (parts.length > 1) {
				const ageRangePart = parts[1];
				if (ageRangePart === '0-11') {
					ageGroup = '0-11 months';
				} else if (ageRangePart === '12-23') {
					ageGroup = '12-23 months';
				} else if (ageRangePart === '24-59') {
					ageGroup = '24-59 months';
				} else {
					ageGroup = ageRangePart;
				}
			}
			
			// Parse syndrome type from layer name (e.g., "Asym", "Comm", "Medi")
			if (parts.length > 2) {
				const syndromePart = parts[2];
				switch (syndromePart) {
					case 'Asym':
						syndrome = 'Asymptomatic';
						break;
					case 'Comm':
						syndrome = 'Community';
						break;
					case 'Medi':
						syndrome = 'Medical';
						break;
					default:
						syndrome = 'Diarrhea';
				}
			}

			const formattedLng = clickCoordinates[0].toFixed(4);
			const formattedLat = clickCoordinates[1].toFixed(4);

			// Convert raster value to percentage
			// The raster values are in the 0-11 range based on the rescale parameter
			// This represents prevalence percentage directly
			const prevalencePercent = rasterValue;

			// Create properties that match the expected structure for MapPopover
			popoverProperties = {
				// Required fields for popup display
				heading: `${pathogen} Prevalence`,
				subheading: 'Raster layer data',
				pathogen: pathogen,
				prevalenceValue: prevalencePercent / 100,  // Convert from percentage (0-11) to decimal (0-0.11) for MapPopover
				ageGroup: ageGroup || 'All ages',
				ageRange: ageGroup || 'All ages',
				syndrome: syndrome || 'Diarrhea',
				location: `${formattedLat}°, ${formattedLng}°`,
				
				// Additional fields
				duration: '-',
				design: 'Geospatial model',
				source: 'Raster Layer',
				hyperlink: '#',
				footnote: `Exact prevalence value from raster layer "${layerName}" at coordinates ${formattedLng}°, ${formattedLat}°.`
			};

			popoverCoordinates = clickCoordinates;
			showPopover = true;
		} catch (error) {
			console.error('Error processing raster data for popover:', error);
		} finally {
			isLoading.set(false);
		}
	}

	function handlePointClick(event: CustomEvent) {
		console.log('Map.svelte: handlePointClick called with:', event.detail);
		showPopover = false;
		showMultiPointPopover = false;
		popoverCoordinates = null;
		popoverProperties = null;
		multiPointFeatures = [];

		const { coordinates, properties } = event.detail;
		
		// Check if there are multiple features at this location
		if (map) {
			const clickPoint = map.project(coordinates);
			const overlappingFeatures = detectOverlappingFeatures(map, coordinates, clickPoint);
			
			if (overlappingFeatures.length > 1) {
				// Multiple points at this location - show selection menu
				console.log(`Found ${overlappingFeatures.length} overlapping features`);
				popoverCoordinates = coordinates;
				multiPointFeatures = overlappingFeatures;
				showMultiPointPopover = true;
				return;
			}
		}
		
		// Single point - show regular popover
		console.log('Extracted properties:', properties);
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

	function handleVisualizationChange(
		event: CustomEvent<{ visualizationType: VisualizationType; timestamp: number }>
	) {
		const { visualizationType: newType } = event.detail;
		console.log(`Map received visualization change event: ${newType}`);
		// Visualization changes are now handled centrally by the store
		// The store watches for visualizationType changes and updates accordingly
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
		// Wait for map to be idle before serializing URL
		if (map.loaded()) {
			map.once('idle', () => {
				if (map) {
					serializeFiltersToUrl(map, globalOpacity);
				}
			});
		}
	}

	$: if ($pointsAddedToMap && map && isStyleLoaded && rasterLayerManager) {
		console.log('Map.svelte: pointsAddedToMap is true, ensuring layer order.');
		// Use idle event to ensure map has finished rendering before adjusting layers
		map.once('idle', () => {
			if (rasterLayerManager && typeof rasterLayerManager.ensureCorrectLayerOrder === 'function') {
				rasterLayerManager.ensureCorrectLayerOrder();
			}
		});
	}

	let previousVisibleRasterCount = 0;
	$: {
		if (map && isStyleLoaded && rasterLayerManager) {
			const currentVisibleRasterCount = Array.from($rasterLayers.values()).filter(
				(l) => l.isVisible && l.bounds
			).length;
			if (currentVisibleRasterCount !== previousVisibleRasterCount) {
				console.log('Map.svelte: Visible raster count changed, ensuring layer order.');
				// Use idle event to ensure map has finished rendering
				map.once('idle', () => {
					if (
						rasterLayerManager &&
						typeof rasterLayerManager.ensureCorrectLayerOrder === 'function'
					) {
						rasterLayerManager.ensureCorrectLayerOrder();
					}
				});
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
		<MapLayer {map} on:pointclick={handlePointClick} />
	{/if}

	<div class="absolute left-6 top-16 z-10">
		<MapSidebar
			class="hidden sm:block"
			bind:globalOpacity
			on:opacitychange={handleOpacityChange}
			on:visualizationchange={handleVisualizationChange}
		/>
	</div>

	{#if map && popoverCoordinates}
		{#if showMultiPointPopover && multiPointFeatures.length > 0}
			<MultiPointPopover
				{map}
				coordinates={popoverCoordinates}
				features={multiPointFeatures}
				visible={showMultiPointPopover}
				on:close={() => {
					showMultiPointPopover = false;
					multiPointFeatures = [];
				}}
			/>
		{:else if showPopover && popoverProperties}
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
				<button class="retry-button" on:click={() => loadPointsData(pointDataUrl, true)}>
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
