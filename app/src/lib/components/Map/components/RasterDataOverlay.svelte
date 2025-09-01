<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import { rasterLayers } from '../store';
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
		const visibleLayers = Array.from(currentRasterLayers.values()).filter(
			(layer) => layer.isVisible
		);

		if (visibleLayers.length === 0) {
			dataPoints = [];
			return;
		}

		const points: Array<{ x: number; y: number; value: number }> = [];
		const container = map.getContainer();
		const rect = container.getBoundingClientRect();
		// Use CSS pixel size, not device pixel canvas size, to avoid DPR mismatch
		const cssWidth = container.clientWidth;
		const cssHeight = container.clientHeight;

		// Sample screen pixels and check if they have raster data
		const sampleRate = 5; // Sample every 5th pixel

		for (let sx = 0; sx < cssWidth; sx += sampleRate) {
			for (let sy = 0; sy < cssHeight; sy += sampleRate) {
				// Convert CSS pixel (relative to map container) to geographic coordinates
				const px = sx + sampleRate / 2;
				const py = sy + sampleRate / 2;
				const lngLat = map.unproject([px, py]);
				// Normalize longitude to [-180, 180] for world copies
				const lng = ((lngLat.lng + 180) % 360) - 180;
				const lat = lngLat.lat;

				// Check each visible layer for data at this location
				for (const layer of visibleLayers) {
					if (!layer || !layer.rasterData || !layer.bounds || !layer.width || !layer.height) {
						continue;
					}

					// Log bounds once per update
					if (sx === 0 && sy === 0) {
						console.log('RasterDataOverlay - Layer info:', {
							name: layer.name,
							bounds: layer.bounds,
							boundsAsString: `[${layer.bounds.join(', ')}]`,
							width: layer.width,
							height: layer.height,
							aspectRatio: layer.width / layer.height,
							degreesPerPixelX: (layer.bounds[2] - layer.bounds[0]) / layer.width,
							degreesPerPixelY: (layer.bounds[3] - layer.bounds[1]) / layer.height
						});
					}

					// Clip to actual raster bounds before sampling to avoid outside-extent dots
					const [west, south, east, north] = layer.bounds;
					if (lat < south || lat > north || lng < west || lng > east) {
						continue;
					}

					// Use the same function that the tooltip uses to get the value
					const value = getRasterValueAtCoordinateFast(layer, lng, lat);

					if (value !== null && value > 0) {
						// Found valid data at this geographic location; use map.project for exact screen coords
						const screen = map.project([lng, lat]);
						points.push({ x: rect.left + screen.x, y: rect.top + screen.y, value });
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
				class="absolute h-[3px] w-[3px] border border-red-800 bg-red-600"
				style="left: {point.x}px; top: {point.y}px;"
			/>
		{/each}
	</div>
{/if}
