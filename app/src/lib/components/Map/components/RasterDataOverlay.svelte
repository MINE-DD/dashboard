<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import { rasterLayers } from '../store';
	import type { RasterLayer } from '../store/types';
	import { getRasterValueAtCoordinateFast } from '../utils/rasterPixelQuery';

	export let map: MaplibreMap;
	export let visible: boolean = true;

	let dataPoints: Array<{ x: number; y: number; value: number }> = [];
	let mapContainer: HTMLElement | null = null;
	let updateTimer: number | null = null;

	function generateDataPoints() {
		if (!map || !visible) {
			dataPoints = [];
			return;
		}

		const currentRasterLayers = $rasterLayers;
		const visibleLayers = Array.from(currentRasterLayers.values()).filter(layer => layer.isVisible);
		
		if (visibleLayers.length === 0) {
			dataPoints = [];
			return;
		}

		const points: Array<{ x: number; y: number; value: number }> = [];
		const canvas = map.getCanvas();
		const canvasWidth = canvas.width;
		const canvasHeight = canvas.height;
		
		// Sample screen pixels and check if they have raster data
		const sampleRate = 5; // Sample every 5th pixel
		
		for (let x = 0; x < canvasWidth; x += sampleRate) {
			for (let y = 0; y < canvasHeight; y += sampleRate) {
				// Convert screen pixel to geographic coordinates
				const lngLat = map.unproject([x, y]);
				const lng = lngLat.lng;
				const lat = lngLat.lat;
				
				// Check each visible layer for data at this location
				for (const layer of visibleLayers) {
					if (!layer || !layer.rasterData || !layer.bounds || !layer.width || !layer.height) {
						continue;
					}
					
					// Use the same function that the tooltip uses to get the value
					const value = getRasterValueAtCoordinateFast(layer, lng, lat);
					
					if (value !== null && value > 0) {
						// Found valid data at this screen position
						points.push({ x, y, value });
						break; // Don't check other layers for this pixel
					}
				}
			}
		}
		
		console.log(`RasterDataOverlay: Generated ${points.length} data points`);
		dataPoints = points;
	}

	function scheduleUpdate() {
		if (updateTimer) {
			clearTimeout(updateTimer);
		}
		updateTimer = window.setTimeout(() => {
			generateDataPoints();
		}, 100);
	}

	onMount(() => {
		if (map) {
			mapContainer = map.getContainer();
			
			// Generate initial points
			generateDataPoints();
			
			// Update on map events
			map.on('moveend', scheduleUpdate);
			map.on('zoomend', scheduleUpdate);
			map.on('resize', scheduleUpdate);
		}
	});

	onDestroy(() => {
		if (map) {
			map.off('moveend', scheduleUpdate);
			map.off('zoomend', scheduleUpdate);
			map.off('resize', scheduleUpdate);
		}
		if (updateTimer) {
			clearTimeout(updateTimer);
		}
	});

	// Regenerate when raster layers change
	$: if ($rasterLayers && visible) {
		scheduleUpdate();
	}

	$: if (!visible) {
		dataPoints = [];
	}
</script>

{#if visible && mapContainer}
	<div class="pointer-events-none fixed inset-0 z-[500]">
		{#each dataPoints as point (point.x + '-' + point.y)}
			<div
				class="absolute h-[3px] w-[3px] bg-red-600 border border-red-800"
				style="left: {point.x}px; top: {point.y}px;"
			/>
		{/each}
	</div>
{/if}