<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import {
		rasterLayers,
		updateRasterLayerVisibility,
		updateRasterLayerOpacity,
		updateAllRasterLayersOpacity,
		isAdjustingLayerOrder
	} from '../store';
	import {
		syncRasterLayers,
		updateRasterLayerOpacity as updateOpacity
	} from '../utils/RasterLayerSync';
	import { serializeFiltersToUrl } from '../utils/urlParams';

	// Props
	export let map: MaplibreMap | null = null;
	export let isStyleLoaded: boolean = false;
	export let globalOpacity: number = 80; // Default to 80%

	// Track layers currently on the map
	let currentMapLayers = new Set<string>();

	// Function to ensure correct layering of points and boundaries over rasters
	export function ensureCorrectLayerOrder() {
		if (map) {
			isAdjustingLayerOrder.set(true);
			try {
				// First, move country boundaries (will be below points/data layers)
				if (map.getLayer('country-boundaries-layer')) {
					map.moveLayer('country-boundaries-layer');
					console.log('RasterLayerManager: Moved country-boundaries-layer above rasters');
				}
				
				// Then move all possible data visualization layers to top
				// The order matters - last moved will be on top
				
				// Heatmap layer (should be below dots/pies if they exist)
				if (map.getLayer('heatmap-layer')) {
					map.moveLayer('heatmap-layer');
					console.log('RasterLayerManager: Moved heatmap-layer to top');
				}
				
				// 3D bars layer
				if (map.getLayer('3d-bars-layer')) {
					map.moveLayer('3d-bars-layer');
					console.log('RasterLayerManager: Moved 3d-bars-layer to top');
				}
				
				// Dots layer
				if (map.getLayer('points-layer')) {
					map.moveLayer('points-layer');
					console.log('RasterLayerManager: Moved points-layer to top');
				}
				
				// Single pie chart layer (new approach)
				if (map.getLayer('pie-charts')) {
					map.moveLayer('pie-charts');
					console.log('RasterLayerManager: Moved pie-charts to top');
				}
				
				// Multiple pie chart layers (legacy approach, just in case)
				const pieChartLayerIds = ['pie-charts-large', 'pie-charts-medium', 'pie-charts-small'];
				pieChartLayerIds.forEach((layerId) => {
					if (map.getLayer(layerId)) {
						map.moveLayer(layerId);
						console.log(`RasterLayerManager: Moved ${layerId} to top`);
					}
				});
			} catch (e) {
				console.error('RasterLayerManager: Error during ensureCorrectLayerOrder:', e);
			} finally {
				// Use idle event to ensure MapLibre has processed all layer operations
				if (map.loaded()) {
					map.once('idle', () => {
						isAdjustingLayerOrder.set(false);
					});
				} else {
					// Fallback if map is not loaded
					isAdjustingLayerOrder.set(false);
				}
			}
		}
	}

	// Sync map layers when raster layers or map state changes
	$: if (map && isStyleLoaded) {
		syncRasterLayers($rasterLayers, map, isStyleLoaded, currentMapLayers, ensureCorrectLayerOrder);
	}

	// Update opacity when raster layers change
	$: if (map && isStyleLoaded) {
		updateOpacity(map, isStyleLoaded, $rasterLayers);
	}

	// Toggle country boundaries layer visibility based on visible raster layers
	$: if (map && isStyleLoaded && map.getLayer('country-boundaries-layer')) {
		const visibleRasterLayerCount = Array.from($rasterLayers.values()).filter(
			(layer) => layer.isVisible
		).length;
		const countryBoundariesVisibility = visibleRasterLayerCount > 0 ? 'visible' : 'none';
		if (
			map.getLayoutProperty('country-boundaries-layer', 'visibility') !==
			countryBoundariesVisibility
		) {
			map.setLayoutProperty('country-boundaries-layer', 'visibility', countryBoundariesVisibility);
		}
	}

	// Update URL when opacity changes
	function handleOpacityChange(newOpacity: number) {
		globalOpacity = newOpacity;
		updateAllRasterLayersOpacity(newOpacity / 100);

		// Update URL
		if (map) {
			serializeFiltersToUrl(map, newOpacity);
		}
	}

	// Clean up on component destruction
	onDestroy(() => {
		// Clean up any resources if needed
	});
</script>

{#if map && isStyleLoaded}
	<!-- This component doesn't render anything visible -->
	<!-- It just manages the raster layers on the map -->
{/if}
