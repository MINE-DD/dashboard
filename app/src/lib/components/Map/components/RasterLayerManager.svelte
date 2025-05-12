<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import {
		rasterLayers,
		updateRasterLayerVisibility,
		updateRasterLayerOpacity,
		updateAllRasterLayersOpacity
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

	// Function to bring points to front after adding raster layers
	export function bringPointsToFront() {
		if (map && map.getLayer('points-layer')) {
			map.moveLayer('points-layer');
		}
	}

	// Sync map layers when raster layers or map state changes
	$: if (map && isStyleLoaded) {
		syncRasterLayers($rasterLayers, map, isStyleLoaded, currentMapLayers, bringPointsToFront);
	}

	// Update opacity when raster layers change
	$: if (map && isStyleLoaded) {
		updateOpacity(map, isStyleLoaded, $rasterLayers);
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
