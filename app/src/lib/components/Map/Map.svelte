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
	import { loadPointsData, isLoading, dataError } from '$lib/components/Map/store';
	import MapLayer from './components/MapLayer.svelte';
	import MapSidebar from './components/MapSidebar.svelte';
	import MapPopover from './components/MapPopover.svelte';

	// Props that can be passed to the component
	export let initialCenter: [number, number] = [0, 0]; // Default center coordinates [lng, lat]
	export let initialZoom: number = 2; // Default zoom level
	export let initialStyleId: string | null = null; // Optional style ID to use
	export let pointDataUrl: string = 'data/01_Points/Plan-EO_Dashboard_point_data.csv';

	let mapContainer: HTMLElement;
	let map: maplibregl.Map;
	let stylesByCategory = getStylesByCategory();
	let isStyleLoaded = false;

	// Popover state
	let showPopover = false;
	let popoverCoordinates: [number, number] | null = null;
	let popoverProperties: any = null;

	// Handle map style changes
	const setMapStyle = (style: MapStyle) => {
		if (map) {
			// Update the store
			selectedMapStyle.set(style);

			// Apply the style to the map
			map.setStyle(style.url);
		}
	};

	// Handle point click events from MapLayer
	function handlePointClick(event: CustomEvent) {
		const { coordinates, properties } = event.detail;
		popoverCoordinates = coordinates;
		popoverProperties = properties;
		showPopover = true;
	}

	// Initialize map and controls
	onMount(async () => {
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
			map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

			// Add scale control
			map.addControl(
				new maplibregl.ScaleControl({
					maxWidth: 100,
					unit: 'metric'
				}),
				'bottom-left'
			);

			// Load data
			loadPointsData(pointDataUrl);

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

	<!-- Map Controls -->
	<div class="map-top-controls absolute left-2 top-10 z-10">
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

	<!-- Map Components -->
	{#if map && isStyleLoaded}
		<MapLayer {map} on:pointclick={handlePointClick} />
	{/if}

	<!-- Map Sidebar with filters -->

	<div class="absolute right-20 top-10">
		<MapSidebar />
	</div>

	<!-- Point Popover for details -->
	{#if map && showPopover && popoverCoordinates && popoverProperties}
		<MapPopover
			{map}
			coordinates={popoverCoordinates}
			properties={popoverProperties}
			visible={showPopover}
			on:close={() => (showPopover = false)}
		/>
	{/if}

	<!-- Loading indicator -->
	{#if $isLoading}
		<div class="loading-overlay">
			<div class="loading-spinner"></div>
			<div class="loading-text">Loading Map Data...</div>
		</div>
	{/if}

	<!-- Error Display -->
	{#if $dataError}
		<div class="error-overlay">
			<div class="error-container">
				<div class="error-icon">⚠️</div>
				<div class="error-message">Error: {$dataError}</div>
				<button class="retry-button" on:click={() => loadPointsData(pointDataUrl)}>Retry</button>
			</div>
		</div>
	{/if}
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

	/* Loading indicator */
	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(255, 255, 255, 0.7);
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #f3f3f3;
		border-top: 4px solid hsl(var(--p));
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 10px;
	}

	.loading-text {
		font-size: 16px;
		color: #333;
	}

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
		z-index: 1001;
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

	.error-message {
		color: #e53e3e;
		margin-bottom: 15px;
		font-size: 16px;
	}

	.retry-button {
		background-color: hsl(var(--p));
		color: white;
		border: none;
		border-radius: 4px;
		padding: 8px 16px;
		font-size: 14px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.retry-button:hover {
		background-color: hsl(var(--pf));
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
