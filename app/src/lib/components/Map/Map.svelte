<script lang="ts">
	import { onMount, onDestroy, afterUpdate } from 'svelte'; // Merged imports
	import maplibregl from 'maplibre-gl'; // Remove named Map import
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
		// Import raster stores and functions
		rasterLayers,
		fetchAndSetLayerBounds, // Import the new function
		updateAllRasterLayersOpacity // Import for opacity control
	} from './store'; // Corrected import path
	import MapLayer from './components/MapLayer.svelte';
	import MapSidebar from './components/MapSidebar.svelte';
	import MapPopover from './components/MapPopover.svelte';
	// Import URL parameter utilities
	import { parseUrlFilters, serializeFiltersToUrl, debounce } from './utils/urlParams';
	import GeoTIFFExample from './components/GeoTIFFExample.svelte';

	// Props that can be passed to the component
	export let initialCenter: [number, number] = [-25, 16]; // Default center coordinates [lng, lat]
	export let initialZoom: number = 2; // Default zoom level - closer to see the COG details
	export let initialStyleId: string | null = null; // Optional style ID to use
	export let pointDataUrl: string = 'data/01_Points/Plan-EO_Dashboard_point_data.csv';

	// Track the global opacity value for raster layers
	let globalOpacity = 80; // Default to 80%

	let mapContainer: HTMLElement;
	let map: maplibregl.Map | null = null; // Use qualified type
	let stylesByCategory = getStylesByCategory();
	let isStyleLoaded = false; // Tracks if the *current* style is loaded
	let currentMapLayers = new Set<string>(); // Track layers currently on the map

	// Reference to the MapLayer component instance
	let mapLayerComponent: MapLayer;

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
			// Parse URL parameters before initializing map
			const urlParams = parseUrlFilters();

			// Override initial values with URL parameters if present
			if (urlParams.center) initialCenter = urlParams.center;
			if (urlParams.zoom) initialZoom = urlParams.zoom;
			if (urlParams.styleId) initialStyleId = urlParams.styleId;

			// Process opacity from URL if present
			if (urlParams.opacity !== undefined) {
				// Update global opacity for raster layers (value between 0-100)
				updateAllRasterLayersOpacity(urlParams.opacity / 100);
			}

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
					zoom: initialZoom || 4,
					renderWorldCopies: true // Enable world copies for better wrapping at edges
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

				// Create a debounced update function for map movements
				const debouncedUpdateUrl = debounce(() => {
					serializeFiltersToUrl(map, globalOpacity);
				}, 500); // 500ms delay to avoid excessive updates during panning/zooming

				// --- Event Listeners ---
				map.on('load', () => {
					// console.log('Map "load" event fired');
					isStyleLoaded = true;
					// Load point data only after the initial map load
					loadPointsData(pointDataUrl);
					// Reactive block below will handle adding initial layers from store

					// Add map movement listeners to update URL
					map.on('moveend', debouncedUpdateUrl);
					map.on('zoomend', debouncedUpdateUrl);
				});

				map.on('styledata', () => {
					// console.log('Map "styledata" event fired');
					isStyleLoaded = true; // Style is now ready
					// Clear tracked layers as they might be gone after style change
					currentMapLayers.clear();
					// Reactive block below will handle re-adding layers from store
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

	// --- Reactive logic for Raster Layers ---
	// Explicitly depend on the store value to ensure reactivity
	$: syncMapLayers($rasterLayers, map, isStyleLoaded);

	// Import RasterLayer type for the function signature
	import type { RasterLayer } from './store'; // Assuming RasterLayer is exported from store

	// This function handles adding/removing layers and setting initial visibility
	function syncMapLayers(
		layersInStore: Map<string, RasterLayer>, // Standard JS Map type is now unambiguous
		currentMap: maplibregl.Map | null, // Use qualified type
		styleLoaded: boolean
	) {
		if (!currentMap || !styleLoaded) return; // Exit if map or style not ready

		console.log('Map: Running syncMapLayers for add/remove/visibility...');

		const layersOnMap = new Set(currentMapLayers); // Copy current map layers

		// Iterate through layers defined in the store
		layersInStore.forEach((layer: RasterLayer) => {
			// Added type annotation
			const layerId = layer.id;
			const sourceId = layer.id; // Use the same ID for source and layer for simplicity

			const layerShouldBeVisible = layer.isVisible;
			const layerIsCurrentlyOnMap = currentMap.getLayer(layerId); // Check if layer exists

			if (layersOnMap.has(layerId) && layerIsCurrentlyOnMap) {
				// Layer exists on map, check only visibility for removal
				if (!layerShouldBeVisible) {
					// Layer should be hidden, but it's on the map -> Remove it
					console.log(`Map: Layer ${layerId} should be hidden. Removing.`);
					try {
						// Remove existing layer and source using currentMap
						if (currentMap.getLayer(layerId)) currentMap.removeLayer(layerId);
						if (currentMap.getSource(sourceId)) currentMap.removeSource(sourceId);
						currentMapLayers.delete(layerId); // Untrack
					} catch (e) {
						console.error(`Map: Error removing layer ${layerId} for visibility:`, e);
					}
				}
				// Opacity is handled separately
				layersOnMap.delete(layerId); // Mark as processed
			} else if (layerShouldBeVisible && !layerIsCurrentlyOnMap) {
				// Layer should be visible, but isn't on map -> Add it OR fetch bounds
				console.log(`Map: Layer ${layerId} should be visible. Evaluating.`);

				// --- Check if bounds need fetching ---
				if (!layer.bounds && !layer.isLoading && !layer.error) {
					console.log(`Map: Layer ${layerId} needs bounds. Triggering fetch.`);
					fetchAndSetLayerBounds(layerId); // Call the fetch function
					// Don't try to add the layer yet, wait for bounds to be set by the store update
				}
				// --- Check if ready to add (bounds exist, not loading, no error) ---
				else if (!layer.isLoading && !layer.error && layer.bounds) {
					console.log(`Map: Layer ${layerId} is ready. Adding source and layer.`);
					try {
						// Add source if it doesn't exist (bounds check already done)
						if (!currentMap?.getSource(sourceId)) {
							// Use image source type with fetched bounds
							if (!layer.dataUrl) {
								console.error(`Raster: Missing dataUrl for layer ${layerId}`);
								throw new Error(`Missing dataUrl for layer ${layerId}`);
							}
							const imageUrl = layer.dataUrl; // This now holds the processed GeoTIFF data URL
							// Create coordinates array for the image corners
							// The order is critical: top-left, top-right, bottom-right, bottom-left

							// Extract and validate bounds
							// The bounds have already been validated in geoTiffProcessor.ts
							// and converted from Web Mercator to lat/lng if needed
							let west = layer.bounds[0];
							let south = layer.bounds[1];
							let east = layer.bounds[2];
							let north = layer.bounds[3];

							// Log the bounds for debugging
							console.log(`Raster: Using bounds for ${layerId}:`, { west, south, east, north });

							// Check if the layer has projection information
							const projectionInfo = layer.metadata?.projection;
							console.log(`Raster: Layer ${layerId} projection:`, projectionInfo);

							// Create coordinates array for the image corners using standard lng,lat order
							// The order is critical: top-left, top-right, bottom-right, bottom-left
							const coordinates: [
								[number, number],
								[number, number],
								[number, number],
								[number, number]
							] = [
								[west, north], // top-left [lng, lat]
								[east, north], // top-right
								[east, south], // bottom-right
								[west, south] // bottom-left
							];

							// console.log(
							// 	`Raster: Adding image source ${sourceId} with URL: ${imageUrl} and coordinates:`,
							// 	coordinates
							// );

							// Check for problematic global bounds before defining source
							const isGlobalBounds =
								layer.bounds[0] === -180 &&
								layer.bounds[1] === -90 &&
								layer.bounds[2] === 180 &&
								layer.bounds[3] === 90;

							if (isGlobalBounds) {
								console.warn(
									`Raster: Using image source ${sourceId} with potentially problematic global bounds.`
								);
								// Decide if you want to proceed or throw an error for global bounds
							}

							// Define sourceDef WITH coordinates, as layer.bounds is guaranteed here
							const sourceDef: maplibregl.ImageSourceSpecification = {
								type: 'image',
								url: imageUrl,
								coordinates: coordinates // Always include coordinates
							};

							currentMap?.addSource(sourceId, sourceDef);
							console.log(`Raster: Successfully added image source ${sourceId}`);
						}
						// else { // Source might already exist if added previously but layer was removed
						//	console.log(`Raster: Source ${sourceId} already exists.`);
						//}

						// Add layer if source exists and layer doesn't
						if (currentMap?.getSource(sourceId) && !currentMap?.getLayer(layerId)) {
							currentMap?.addLayer({
								id: layerId,
								type: 'raster', // Still use raster layer type for rendering controls like opacity
								source: sourceId,
								paint: {
									'raster-opacity': layer.opacity // Set initial opacity
								},
								layout: {
									visibility: 'visible' // Add as visible
								}
							});
							console.log(`Raster: Added layer ${layerId}`);
							currentMapLayers.add(layerId); // Track the added layer

							// Ensure points are on top after adding a raster layer
							if (mapLayerComponent) {
								mapLayerComponent.bringPointsToFront();
							}

							// Ensure points are on top after adding a raster layer
							if (mapLayerComponent) {
								mapLayerComponent.bringPointsToFront();
							}

							// Optionally fit bounds only if specific bounds were used
							const isGlobalBounds =
								layer.bounds[0] === -180 &&
								layer.bounds[1] === -90 &&
								layer.bounds[2] === 180 &&
								layer.bounds[3] === 90;
							if (layer.bounds && !isGlobalBounds) {
								currentMap?.fitBounds(layer.bounds, { padding: 50, duration: 500 });
							}
						}
					} catch (error) {
						console.error(`Raster: Error adding image source/layer ${layerId}:`, error);
						// Clean up if partially added
						if (currentMap?.getLayer(layerId)) currentMap.removeLayer(layerId);
						if (currentMap?.getSource(sourceId)) currentMap.removeSource(sourceId);
					}
				} else if (layer.isLoading) {
					console.log(`Map: Layer ${layerId} is still loading/fetching bounds.`);
				} else if (layer.error) {
					console.log(`Map: Layer ${layerId} has an error: ${layer.error}`);
				} else if (!layer.bounds) {
					console.warn(
						`Map: Cannot add layer ${layerId}, bounds are missing and no error reported.`
					);
				}
			} else if (!layerShouldBeVisible && layerIsCurrentlyOnMap) {
				// Layer should be hidden, but it's on the map -> Remove it
				console.log(`Map: Layer ${layerId} should be hidden. Removing.`);
				try {
					if (currentMap.getLayer(layerId)) currentMap.removeLayer(layerId);
					if (currentMap.getSource(sourceId)) currentMap.removeSource(sourceId);
					currentMapLayers.delete(layerId); // Untrack
				} catch (e) {
					console.error(`Map: Error removing layer ${layerId} during cleanup:`, e);
				}
			}
		});

		// Remove layers that are on the map but no longer in the store
		layersOnMap.forEach((layerIdToRemove) => {
			try {
				if (currentMap?.getLayer(layerIdToRemove)) {
					currentMap.removeLayer(layerIdToRemove);
					console.log(`Raster: Removed layer ${layerIdToRemove}`);
				}
				const sourceIdToRemove = layerIdToRemove; // Assuming source ID matches layer ID
				if (currentMap?.getSource(sourceIdToRemove)) {
					currentMap.removeSource(sourceIdToRemove);
					console.log(`Raster: Removed source ${sourceIdToRemove}`);
				}
				currentMapLayers.delete(layerIdToRemove); // Untrack
			} catch (error) {
				console.error(`Raster: Error removing layer/source ${layerIdToRemove}:`, error);
			}
		});
	} // End of syncMapLayers function

	// Separate reactive block specifically for opacity updates
	$: if (map && isStyleLoaded) {
		$rasterLayers.forEach((layer: RasterLayer) => {
			// Added type annotation
			const layerId = layer.id;
			if (map && map.getLayer(layerId)) {
				// Check if layer exists on map
				try {
					const currentOpacity = map.getPaintProperty(layerId, 'raster-opacity') ?? 1;
					if (currentOpacity !== layer.opacity) {
						console.log(
							`Map (Opacity): Attempting to set opacity for ${layerId} to ${layer.opacity}`
						);
						map.setPaintProperty(layerId, 'raster-opacity', layer.opacity);
						console.log(`Map (Opacity): Successfully set opacity for ${layerId}`);
					}
				} catch (error) {
					// Ignore errors if layer doesn't exist (might happen during transitions)
					// Check if error is an instance of Error before accessing message
					if (error instanceof Error && !error.message.includes('does not exist')) {
						console.error(`Map (Opacity): Error updating opacity for layer ${layerId}:`, error);
					} else if (!(error instanceof Error)) {
						// Log if it's not a standard Error object
						console.error(
							`Map (Opacity): Non-standard error updating opacity for layer ${layerId}:`,
							error
						);
					}
				}
			}
		});
	}

	// Update URL when style changes
	$: if (map && isStyleLoaded && $selectedMapStyle) {
		// Debounce style changes to avoid excessive URL updates
		setTimeout(() => {
			serializeFiltersToUrl(map, globalOpacity);
		}, 100);
	}

	// Monitor filter changes to update URL
	$: if (map && isStyleLoaded) {
		// Use a small timeout to batch filter changes that might happen together
		setTimeout(() => {
			serializeFiltersToUrl(map, globalOpacity);
		}, 100);
	}

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
		<div class="dropdown dropdown-bottom dropdown-end">
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
		<!-- Bind to the MapLayer component to call its functions -->
		<MapLayer {map} on:pointclick={handlePointClick} bind:this={mapLayerComponent} />
	{/if}

	<!-- Map Components -->
	{#if map && isStyleLoaded}
		<!-- Bind to the MapLayer component to call its functions -->
		<MapLayer {map} on:pointclick={handlePointClick} bind:this={mapLayerComponent} />

		<!-- GeoTIFF.js Example Component -->
		<GeoTIFFExample
			{map}
			url="https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif"
			layerId="geotiff-example"
			sourceId="geotiff-example-source"
			opacity={0.8}
		/>
	{/if}

	<!-- Map Sidebar with filters -->
	<div class="absolute left-6 top-16 z-10">
		<!-- Added z-index -->
		<MapSidebar
			bind:globalOpacity
			on:opacitychange={(e) => {
				// Update URL when opacity changes
				serializeFiltersToUrl(map, e.detail.opacity);
			}}
		/>
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

	.retry-button {
		/* Basic button styling */
		padding: 8px 16px;
		margin-top: 15px;
		border: none;
		border-radius: 4px;
		background-color: hsl(var(--p)); /* Use primary color */
		color: hsl(var(--pc)); /* Use primary content color */
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.retry-button:hover {
		background-color: hsl(var(--p) / 0.8); /* Slightly darker on hover */
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
