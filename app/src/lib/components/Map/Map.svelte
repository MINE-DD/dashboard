<script lang="ts">
	import { onMount, onDestroy, afterUpdate } from 'svelte'; // Merged imports
	import maplibregl, { Map } from 'maplibre-gl'; // Import Map type
	import 'maplibre-gl/dist/maplibre-gl.css';
	import {
		MAP_STYLES,
		MapStyleCategory,
		getStyleById,
		getStylesByCategory,
		type MapStyle
	} from './MapStyles';
	import { selectedMapStyle } from '$lib/stores/mapStyle.store';
	import {
		loadPointsData,
		isLoading,
		dataError,
		pointsData,
		// Import raster stores
		isExampleCogVisible,
		exampleCogOpacity,
		exampleCogUrl
	} from '$lib/components/Map/store';
	import MapLayer from './components/MapLayer.svelte';
	import MapSidebar from './components/MapSidebar.svelte';
	import MapPopover from './components/MapPopover.svelte';

	// --- Constants for COG Layer ---
	const COG_SOURCE_ID = 'cog-source';
	const COG_LAYER_ID = 'cog-layer';
	const TITILER_ENDPOINT = 'http://localhost:8000'; // Base titiler endpoint

	// Props that can be passed to the component
	export let initialCenter: [number, number] = [35, 16]; // Default center coordinates [lng, lat] - centered on the COG area
	export let initialZoom: number = 8; // Default zoom level - closer to see the COG details
	export let initialStyleId: string | null = null; // Optional style ID to use
	export let pointDataUrl: string = 'data/01_Points/Plan-EO_Dashboard_point_data.csv';

	let mapContainer: HTMLElement;
	let map: Map | null = null; // Initialize as null
	let stylesByCategory = getStylesByCategory();
	let isStyleLoaded = false; // Tracks if the *current* style is loaded

	// Popover state
	let showPopover = false;
	let popoverCoordinates: [number, number] | null = null;
	let popoverProperties: any = null;

	// Handle map style changes
	const setMapStyle = (style: MapStyle) => {
		if (map) {
			// Update the store
			selectedMapStyle.set(style);
			console.log('Changing style to:', style.name, style.url);

			// Apply the style to the map
			try {
				map.setStyle(style.url);
				// Reset flag as new style is loading
				isStyleLoaded = false;
			} catch (error) {
				console.error('Error setting style:', error);
			}
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
		if (mapContainer && !map) {
			// Ensure map isn't already initialized
			// Determine which style to use - prioritize initialStyleId if provided
			let initialStyle = $selectedMapStyle;
			if (initialStyleId) {
				const styleFromId = getStyleById(initialStyleId);
				if (styleFromId) {
					initialStyle = styleFromId;
					// Update the store to match the initial style
					selectedMapStyle.set(initialStyle);
				} else {
					console.warn(`Initial style ID "${initialStyleId}" not found. Using default.`);
				}
			}

			console.log('Creating map with style:', initialStyle.name);

			try {
				// Create map with the appropriate style
				map = new maplibregl.Map({
					container: mapContainer,
					style: initialStyle.url,
					center: initialCenter || [28.4, -15.0], // Use provided center or default
					zoom: initialZoom || 4 // Use provided zoom or default
				});

				// Log the map object for debugging
				console.log('Map object created:', map);

				// Add controls immediately after map creation attempt
				map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
				map.addControl(
					new maplibregl.ScaleControl({
						maxWidth: 100,
						unit: 'metric'
					}),
					'bottom-left'
				);

				// --- Event Listeners ---
				map.on('load', () => {
					console.log('Map "load" event fired');
					isStyleLoaded = true;
					// Load point data only after the initial map load
					loadPointsData(pointDataUrl);
					// Attempt to add COG layer if visible on initial load
					if ($isExampleCogVisible && $exampleCogUrl && map) {
						addCogLayer(map, $exampleCogUrl, $exampleCogOpacity);
					}
				});

				map.on('styledata', () => {
					console.log('Map "styledata" event fired');
					isStyleLoaded = true; // Style is now ready
					// Re-add COG layer if it should be visible
					if ($isExampleCogVisible && $exampleCogUrl && map) {
						// Need a slight delay or check if source/layer still exists from previous style
						setTimeout(() => {
							if (map && $isExampleCogVisible) {
								// Check again in case state changed
								addCogLayer(map, $exampleCogUrl, $exampleCogOpacity);
							}
						}, 100); // Small delay to ensure style is fully applied
					}
					// Note: MapLayer component will handle re-adding point data reactively
				});

				map.on('error', (e) => {
					console.error('MapLibre error:', e);
				});
			} catch (error) {
				console.error('Error initializing map:', error);
				map = null; // Ensure map is null if initialization failed
			}
		}
	});

	// --- Reactive logic for COG Layer ---

	// Helper to add COG source and layer
	function addCogLayer(currentMap: Map, url: string, opacity: number) {
		// Double check map instance and style loaded status
		if (!currentMap || !currentMap.isStyleLoaded()) {
			console.log('COG: Map or style not ready, skipping addCogLayer.');
			return;
		}
		// Check if source already exists
		if (currentMap.getSource(COG_SOURCE_ID)) {
			console.log('COG: Source already exists.');
			// Ensure layer also exists and update opacity if needed
			if (currentMap.getLayer(COG_LAYER_ID)) {
				currentMap.setPaintProperty(COG_LAYER_ID, 'raster-opacity', opacity);
			} else {
				// Source exists but layer doesn't - add layer
				try {
					currentMap.addLayer(
						{
							id: COG_LAYER_ID,
							type: 'raster',
							source: COG_SOURCE_ID,
							paint: { 'raster-opacity': opacity }
						}
						// No beforeId specified, add on top
					);
					console.log('COG: Layer added (source existed).');
				} catch (error) {
					console.error('COG: Error adding layer (source existed):', error);
				}
			}
			return;
		}

		console.log('COG: Adding source and layer for URL:', url);
		try {
			// Instead of using tiles, use a single image for the entire layer
			// This is a simpler approach that works with the preview endpoint
			const imageUrl = `${TITILER_ENDPOINT}/cog/preview.png?url=${encodeURIComponent(url)}&bidx=1&bidx=2&bidx=3&width=1024&height=1024`;

			// Load the image first
			const image = new Image();
			image.crossOrigin = 'Anonymous';
			image.onload = () => {
				// Once image is loaded, add it as a source
				if (currentMap.hasImage(COG_SOURCE_ID)) {
					currentMap.removeImage(COG_SOURCE_ID);
				}

				currentMap.addImage(COG_SOURCE_ID, image);

				// Create a source and layer using the image
				currentMap.addSource(COG_SOURCE_ID, {
					type: 'image',
					url: imageUrl,
					coordinates: [
						[37.0, 17.0], // top-right [lng, lat]
						[37.0, 15.0], // bottom-right
						[33.0, 15.0], // bottom-left
						[33.0, 17.0] // top-left
					]
				});

				currentMap.addLayer({
					id: COG_LAYER_ID,
					type: 'raster',
					source: COG_SOURCE_ID,
					paint: {
						'raster-opacity': opacity,
						'raster-resampling': 'linear'
					}
				});

				console.log('COG: Image source and layer added successfully.');
			};

			image.onerror = (e) => {
				console.error('COG: Error loading image:', e);
			};

			// Start loading the image
			image.src = imageUrl;
			return; // Early return since we're handling layer creation in the onload callback
		} catch (error) {
			console.error('COG: Error adding source or layer:', error);
		}
	}

	// Helper to remove COG source and layer
	function removeCogLayer(currentMap: Map) {
		if (!currentMap) {
			console.log('COG: Map not ready, skipping removeCogLayer.');
			return;
		}

		console.log('COG: Removing layer and source.');
		try {
			// Check if layer exists before removing
			if (currentMap.getLayer(COG_LAYER_ID)) {
				currentMap.removeLayer(COG_LAYER_ID);
				console.log('COG: Layer removed.');
			} else {
				console.log('COG: Layer not found, skipping removeLayer.');
			}
			// Check if source exists before removing
			if (currentMap.getSource(COG_SOURCE_ID)) {
				currentMap.removeSource(COG_SOURCE_ID);
				console.log('COG: Source removed.');
			} else {
				console.log('COG: Source not found, skipping removeSource.');
			}

			// Also remove the image if it exists
			if (currentMap.hasImage(COG_SOURCE_ID)) {
				currentMap.removeImage(COG_SOURCE_ID);
				console.log('COG: Image removed.');
			}
		} catch (error) {
			// Check error type before accessing message
			if (error instanceof Error) {
				// Ignore errors if map/style is changing rapidly
				if (!error.message.includes('Style is not done loading')) {
					console.error('COG: Error removing layer or source:', error);
				} else {
					console.log('COG: Ignoring remove error during style transition.');
				}
			} else {
				// Handle non-Error types if necessary
				console.error('COG: An unexpected error occurred during removal:', error);
			}
		}
	}

	// React to visibility changes
	$: if (map && map.isStyleLoaded()) {
		// Ensure map and style are ready
		if ($isExampleCogVisible && $exampleCogUrl) {
			console.log('COG: Reactive visibility change to true.');
			addCogLayer(map, $exampleCogUrl, $exampleCogOpacity);
		} else {
			console.log('COG: Reactive visibility change to false.');
			removeCogLayer(map);
		}
	}

	// React to opacity changes
	$: if (map && map.getLayer(COG_LAYER_ID) && $exampleCogOpacity !== undefined) {
		console.log('COG: Reactive opacity change to', $exampleCogOpacity);
		map.setPaintProperty(COG_LAYER_ID, 'raster-opacity', $exampleCogOpacity);
	}

	// React to URL changes (if needed in the future)
	// $: if (map && $isExampleCogVisible && $exampleCogUrl && map.getSource(COG_SOURCE_ID)) {
	//   console.log('COG: URL changed. Re-adding layer.');
	//   removeCogLayer(map);
	//   addCogLayer(map, $exampleCogUrl, $exampleCogOpacity);
	// }

	onDestroy(() => {
		if (map) {
			console.log('Map onDestroy: Removing map instance.');
			map.remove();
			map = null; // Clear map instance
		}
	});
</script>

<div class="relative h-full">
	<!-- Map Container -->
	<div bind:this={mapContainer} class="h-full w-full"></div>

	<!-- Map Controls -->
	<div class="map-top-controls absolute right-10 top-12 z-10">
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
	<div class="absolute left-6 top-16 z-10">
		<!-- Added z-index -->
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
		z-index: 1000; /* Ensure it's above map but below sidebar/popover if needed */
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
