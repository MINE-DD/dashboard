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
	import { loadPointsData, isLoading, dataError, pointsData } from '$lib/components/Map/store';
	import MapLayer from './components/MapLayer.svelte';
	import MapSidebar from './components/MapSidebar.svelte';
	import MapPopover from './components/MapPopover.svelte';

	// Props that can be passed to the component
	export let initialCenter: [number, number] = [30, 0]; // Default center coordinates [lng, lat]
	export let initialZoom: number = 3; // Default zoom level
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
			console.log('Changing style to:', style.name, style.url);

			// Apply the style to the map
			try {
				map.setStyle(style.url);
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
		if (mapContainer) {
			// Determine which style to use - prioritize initialStyleId if provided
			let initialStyle = $selectedMapStyle;
			if (initialStyleId) {
				initialStyle = getStyleById(initialStyleId);
				// Update the store to match the initial style
				selectedMapStyle.set(initialStyle);
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
				console.log('Map object:', map);

				// Wait for map to load before setting up event handlers
				map.on('load', () => {
					console.log('Map loaded event fired');

					// Set flag that map is ready
					isStyleLoaded = true;

					// Force explicit data loading AFTER map is ready
					loadPointsData(pointDataUrl);
				});
			} catch (error) {
				console.error('Error initializing map:', error);
			}

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

			// When map is loaded, check if data is ready and force layer creation
			map.on('load', () => {
				// Map has finished loading
				console.log('Map loaded');
				isStyleLoaded = true;

				// If there's data but the layer isn't showing up, log details
				if ($pointsData.features.length > 0) {
					console.log('Data ready at map load, features:', $pointsData.features.length);
					console.log(
						'Sample coordinates:',
						$pointsData.features.slice(0, 3).map((f) => f.geometry.coordinates)
					);
				}
			});

			// Handle style changes - make sure to re-add data points when style changes
			map.on('styledata', () => {
				console.log('Style data event - map style changed');
				isStyleLoaded = true;

				// Re-add the test point when style changes
				if (map.loaded()) {
					setTimeout(() => {
						try {
							// First check if source already exists
							let sourceExists = false;
							try {
								sourceExists = !!map.getSource('direct-source');
							} catch (e) {
								sourceExists = false;
							}

							if (!sourceExists) {
								// Re-add source after style change
								map.addSource('direct-source', {
									type: 'geojson',
									data: {
										type: 'FeatureCollection',
										features: [
											{
												type: 'Feature',
												geometry: {
													type: 'Point',
													coordinates: [28.4, -15.0]
												},
												properties: {
													title: 'Test Point'
												}
											}
										]
									}
								});

								console.log('Re-added test point after style change');
							}

							// Also re-add the actual data points by triggering MapLayer
							if ($pointsData.features.length > 0) {
								isStyleLoaded = true;
							}
						} catch (e) {
							console.error('Error re-adding layers after style change:', e);
						}
					}, 500); // Give the style time to load
				}
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
	<!-- Debug text -->
	<div class="absolute bottom-2 left-2 z-50 rounded bg-white p-2 shadow">
		<p class="text-sm font-bold">Debug: Map State</p>
		<p class="text-xs">Map initialized: {!!map}</p>
		<p class="text-xs">Current style: {$selectedMapStyle.name}</p>
		<p class="text-xs">Data points: {$pointsData.features.length}</p>
		<p class="text-xs">Style loaded: {isStyleLoaded}</p>
	</div>

	<!-- Map Container -->
	<div
		bind:this={mapContainer}
		class="map-container h-full w-full border-2 border-red-500 bg-gray-200"
	></div>

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
