<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import type { MapStyle } from '../MapStyles';
	import { selectedMapStyle } from '$lib/stores/mapStyle.store';
	import {
		initializeMap,
		addMapEventListeners,
		removeMapEventListeners
	} from '../utils/MapInitializer';
	import { debounce } from '../utils/urlParams';

	// Props
	export let initialCenter: [number, number] = [-25, 16]; // Default center coordinates [lng, lat]
	export let initialZoom: number = 2; // Default zoom level
	export let initialStyleId: string | null = null; // Optional style ID to use
	export let onMapReady: (map: MaplibreMap) => void = () => {}; // Callback when map is ready
	export let onStyleChange: () => void = () => {}; // Callback when style changes

	// Expose the map instance to parent components
	export let map: MaplibreMap | null = null;

	// Internal state
	let mapContainer: HTMLElement;
	let isStyleLoaded = false; // Tracks if the *current* style is loaded

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		ready: { map: MaplibreMap };
		styleChange: { map: MaplibreMap };
		moveEnd: { map: MaplibreMap };
		click: maplibregl.MapMouseEvent;
	}>();

	// Handle map movement (debounced)
	const handleMapMove = debounce(() => {
		if (map) {
			dispatch('moveEnd', { map });
		}
	}, 300);

	// Handle style change
	function handleStyleChange() {
		isStyleLoaded = true;
		if (map) {
			dispatch('styleChange', { map });
			onStyleChange();
		}
	}

	// Handle map click
	function handleMapClick(e: maplibregl.MapMouseEvent) {
		dispatch('click', e);
	}

	// Initialize map on mount
	onMount(() => {
		if (mapContainer && !map) {
			// Get the initial style from the store
			const initialStyle = $selectedMapStyle;

			// Initialize the map
			const initializedMap = initializeMap(mapContainer, initialStyle, initialCenter, initialZoom);

			if (initializedMap) {
				map = initializedMap;

				// Add event listeners
				addMapEventListeners(initializedMap, handleStyleChange, handleMapMove);

				// Add click handler
				initializedMap.on('click', handleMapClick);

				// Set the style loaded flag when the map is loaded
				initializedMap.on('load', () => {
					isStyleLoaded = true;
					// At this point, map is guaranteed to be initializedMap, which is non-null
					dispatch('ready', { map: initializedMap });
					onMapReady(initializedMap);
				});
			}
		}
	});

	// Clean up on destroy
	onDestroy(() => {
		if (map) {
			// Remove event listeners
			removeMapEventListeners(map, handleStyleChange, handleMapMove);
			map.off('click', handleMapClick);

			// Remove the map
			map.remove();
			map = null;
		}
	});
</script>

<div bind:this={mapContainer} class="h-full w-full"></div>

<style>
	/* Fix focus outline on canvas */
	:global(.maplibregl-canvas-container:focus) {
		outline: none;
	}

	:global(.maplibregl-ctrl-attrib-inner) {
		font-size: 10px;
	}
</style>
