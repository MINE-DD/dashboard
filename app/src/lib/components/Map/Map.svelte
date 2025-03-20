<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import {
		MAP_STYLES,
		MapStyleCategory,
		getStyleById,
		getStylesByCategory,
		type MapStyle
	} from './MapStyles';
	import { selectedMapStyle } from '$lib/stores/mapStyle.store';

	// Props that can be passed to the component
	export let initialCenter: [number, number] = [0, 0]; // Default center coordinates [lng, lat]
	export let initialZoom: number = 2; // Default zoom level
	export let initialStyleId: string | null = null; // Optional style ID to use

	let mapContainer: HTMLElement;
	let map: maplibregl.Map;
	let stylesByCategory = getStylesByCategory();
	let isStyleLoaded = false;

	// Handle map style changes
	const setMapStyle = (style: MapStyle) => {
		if (map) {
			// Update the store
			selectedMapStyle.set(style);

			// Apply the style to the map
			map.setStyle(style.url);
		}
	};

	// Initialize map and controls
	onMount(() => {
		if (mapContainer) {
			// Get the initial style from props or store
			const startStyle = initialStyleId ? getStyleById(initialStyleId) : $selectedMapStyle;

			map = new maplibregl.Map({
				container: mapContainer,
				style: startStyle.url,
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
				isStyleLoaded = true;
			});

			// Handle style changes
			map.on('styledata', () => {
				isStyleLoaded = true;
				// Re-add any custom layers that might be needed after style change
			});
		}
	});

	onDestroy(() => {
		if (map) {
			map.remove();
		}
	});
</script>

<div class="map-wrapper relative h-full w-full">
	<!-- Map Container -->
	<div bind:this={mapContainer} class="map-container h-full w-full"></div>

	<!-- Map Style Controls -->
	<div class="map-controls absolute left-2 top-2 z-10">
		<div class="dropdown dropdown-bottom">
			<label tabindex="0" class="btn btn-sm m-1">Map Style</label>
			<ul
				tabindex="0"
				class="dropdown-content menu bg-base-200 rounded-box z-[2] max-h-[70vh] w-52 overflow-y-auto p-2 shadow"
			>
				{#each Object.values(MapStyleCategory) as category}
					<li class="menu-title">{category}</li>
					{#each stylesByCategory[category] as style}
						<li>
							<button
								class:active={$selectedMapStyle.id === style.id}
								on:click={() => setMapStyle(style)}
							>
								{style.name}
							</button>
						</li>
					{/each}
				{/each}
			</ul>
		</div>
	</div>
</div>

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

	/* Style indicator for active map style */
	:global(.menu li button.active) {
		background-color: hsl(var(--p) / 0.2);
		color: hsl(var(--pc));
	}
</style>
