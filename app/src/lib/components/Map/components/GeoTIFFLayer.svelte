<!-- filepath: /Users/ctw/Sites/github/escience/mine-dd/dashboard/app/src/lib/components/Map/components/GeoTIFFLayer.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import { toastStore } from '$lib/stores/toast.store';
	import type { RasterLayer } from '../store/types';
	import { addGeoTIFFToMap } from '../utils/geotiffUtils';

	// Props
	export let map: MaplibreMap | null = null;
	export let layer: RasterLayer;

	// State variables
	let mounted = false;
	let loading = false;
	let error: string | null = null;

	// Initialize the layer when the component mounts or when the map becomes available
	$: if (mounted && map && map.loaded() && layer) {
		initializeLayer();
	}

	// Update layer when visibility or opacity changes
	$: if (mounted && map && map.loaded() && layer) {
		updateLayerProperties();
	}

	// Add the GeoTIFF layer to the map
	async function initializeLayer() {
		if (!map || !layer) return;

		loading = true;
		error = null;

		try {
			await addGeoTIFFToMap(map, layer);
			loading = false;
		} catch (err) {
			loading = false;
			error = err instanceof Error ? err.message : 'Unknown error loading GeoTIFF';
			toastStore.error(`Failed to load GeoTIFF: ${error}`);
			console.error('Error initializing GeoTIFF layer:', err);
		}
	}

	// Update layer properties when they change
	function updateLayerProperties() {
		if (!map) return;

		const layerId = `geotiff-layer-${layer.id}`;

		// Update visibility
		if (map.getLayer(layerId)) {
			map.setLayoutProperty(layerId, 'visibility', layer.isVisible ? 'visible' : 'none');
		}

		// Update opacity
		if (map.getLayer(layerId)) {
			map.setPaintProperty(layerId, 'raster-opacity', layer.opacity);
		}
	}

	// Clean up on component destruction
	function cleanup() {
		if (!map) return;

		const sourceId = `geotiff-source-${layer.id}`;
		const layerId = `geotiff-layer-${layer.id}`;

		// Remove layer and source if they exist
		try {
			if (map.getLayer(layerId)) {
				map.removeLayer(layerId);
			}
			if (map.getSource(sourceId)) {
				map.removeSource(sourceId);
			}
		} catch (err) {
			console.error('Error cleaning up GeoTIFF layer:', err);
		}
	}

	onMount(() => {
		mounted = true;
	});

	onDestroy(() => {
		cleanup();
	});
</script>

{#if loading}
	<!-- Optional loading indicator -->
	<div class="geotiff-loading-indicator" aria-hidden="true">
		<!-- You can replace this with your own loading spinner/component -->
	</div>
{/if}
