<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	// Props that can be passed to the component
	export let initialCenter: [number, number] = [0, 0]; // Default center coordinates [lng, lat]
	export let initialZoom: number = 2; // Default zoom level
	export let mapStyle: string = 'https://demotiles.maplibre.org/style.json'; // Default style URL

	let mapContainer: HTMLElement;
	let map: maplibregl.Map;

	onMount(() => {
		if (mapContainer) {
			map = new maplibregl.Map({
				container: mapContainer,
				style: mapStyle,
				center: initialCenter,
				zoom: initialZoom
			});

			// Add navigation control (zoom buttons)
			map.addControl(new maplibregl.NavigationControl(), 'top-right');

			// Add scale control
			map.addControl(
				new maplibregl.ScaleControl({
					maxWidth: 100,
					unit: 'metric'
				}),
				'bottom-left'
			);

			// You can add event listeners here if needed
			map.on('load', () => {
				// Map has finished loading
				console.log('Map loaded');
			});
		}
	});

	onDestroy(() => {
		if (map) {
			map.remove();
		}
	});
</script>

<div bind:this={mapContainer} class="map-container h-full w-full"></div>

<style>
	.map-container {
		position: relative;
		min-height: 400px;
	}

	/* Fix focus outline on canvas */
	:global(.maplibregl-canvas-container:focus) {
		outline: none;
	}

	:global(.maplibregl-ctrl-attrib-inner) {
		font-size: 10px;
	}
</style>
