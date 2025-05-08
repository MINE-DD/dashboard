<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import * as GeoTIFF from 'geotiff';
	import type { Map as MaplibreMap } from 'maplibre-gl';

	// Props
	export let map: MaplibreMap | null = null;
	export let url =
		'https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif';
	export let layerId = 'geotiff-example';
	export let sourceId = 'geotiff-example-source';
	export let opacity = 0.8;
	export let visible = true;

	// State
	let loading = false;
	let error: string | null = null;
	let metadata: any = null;
	let dataUrl: string | null = null;
	let bounds: number[] | null = null;

	const dispatch = createEventDispatcher();

	// Load and process the GeoTIFF
	async function loadGeoTIFF() {
		if (!map || !url) return;

		try {
			loading = true;
			error = null;

			// Load the GeoTIFF
			console.log(`GeoTIFF Example: Loading from URL: ${url}`);
			const tiff = await GeoTIFF.fromUrl(url);
			const image = await tiff.getImage();

			// Get metadata
			const imageWidth = image.getWidth();
			const imageHeight = image.getHeight();
			const imageBounds = image.getBoundingBox();

			metadata = {
				width: imageWidth,
				height: imageHeight,
				bounds: imageBounds,
				resolution: image.getResolution(),
				samplesPerPixel: image.getSamplesPerPixel()
			};

			console.log('GeoTIFF Example: Metadata loaded:', metadata);

			// Initialize bounds with a default value to avoid null issues
			bounds = (imageBounds as number[]) || [-20, -35, 55, 40]; // Default to Africa if null
			console.log('GeoTIFF Example: Raw bounds from GeoTIFF:', bounds);

			// Use TiTiler to get more accurate bounds
			try {
				// Get the TiTiler endpoint from environment or use default
				const TITILER_ENDPOINT = import.meta.env.VITE_TITILER_ENDPOINT || 'http://localhost:8000';
				const encodedUrl = encodeURIComponent(url);
				const boundsUrl = `${TITILER_ENDPOINT}/cog/bounds?url=${encodedUrl}`;

				console.log(`GeoTIFF Example: Fetching bounds from TiTiler: ${boundsUrl}`);
				const response = await fetch(boundsUrl);

				if (response.ok) {
					const boundsJson = await response.json();
					console.log('GeoTIFF Example: Received bounds from TiTiler:', boundsJson);

					if (boundsJson?.bounds && boundsJson.bounds.length === 4) {
						// Update bounds with TiTiler data
						bounds = boundsJson.bounds;

						// Check for global bounds and adjust if needed
						const isGlobalBounds =
							bounds[0] === -180 && bounds[1] === -90 && bounds[2] === 180 && bounds[3] === 90;

						if (isGlobalBounds) {
							console.warn(
								'GeoTIFF Example: Received global bounds, using slightly smaller bounds.'
							);
							bounds = [-179.9, -89.9, 179.9, 89.9];
						}

						console.log('GeoTIFF Example: Using bounds from TiTiler:', bounds);
					}
				} else {
					console.warn(`GeoTIFF Example: Failed to fetch bounds from TiTiler: ${response.status}`);
					// Continue with GeoTIFF bounds or default
					if (!bounds || bounds.length !== 4) {
						console.warn('GeoTIFF Example: Using default bounds for Africa');
						bounds = [-20, -35, 55, 40]; // Default to Africa
					}
				}
			} catch (err) {
				console.warn('GeoTIFF Example: Error fetching bounds from TiTiler:', err);
				// Continue with GeoTIFF bounds or default
				if (!bounds || bounds.length !== 4) {
					console.warn('GeoTIFF Example: Using default bounds for Africa');
					bounds = [-20, -35, 55, 40]; // Default to Africa
				}
			}

			// Read raster data
			console.log('GeoTIFF Example: Reading raster data...');
			const data = await image.readRasters();

			// Create a canvas to render the data
			const canvas = document.createElement('canvas');
			canvas.width = imageWidth;
			canvas.height = imageHeight;

			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Could not get canvas context');

			// Create an ImageData object
			const imageData = ctx.createImageData(imageWidth, imageHeight);

			// Fill the ImageData based on the raster data
			// Using viridis colormap similar to TiTiler
			console.log('GeoTIFF Example: Rendering to canvas...');

			// Define viridis colormap (similar to what TiTiler uses)
			// This is a simplified version with key points from the viridis colormap
			const viridisColormap = [
				[68, 1, 84], // Dark purple
				[72, 40, 120], // Purple
				[62, 73, 137], // Blue
				[49, 104, 142], // Light blue
				[38, 130, 142], // Cyan
				[31, 158, 137], // Teal
				[53, 183, 121], // Green
				[109, 205, 89], // Light green
				[180, 222, 44], // Yellow-green
				[253, 231, 37] // Yellow
			];

			// Function to get color from the viridis colormap
			function getViridisColor(value: number): [number, number, number] {
				// Rescale value from 0-11 to 0-1 (similar to TiTiler's rescale=0,11)
				const rescaledValue = Math.min(1, Math.max(0, value / 11));

				// Map to colormap index
				const index = rescaledValue * (viridisColormap.length - 1);
				const lowerIndex = Math.floor(index);
				const upperIndex = Math.min(viridisColormap.length - 1, lowerIndex + 1);
				const t = index - lowerIndex; // Interpolation factor

				// Interpolate between colors
				if (lowerIndex === upperIndex) {
					// Ensure we return a tuple of exactly 3 numbers
					const color = viridisColormap[lowerIndex];
					return [color[0], color[1], color[2]];
				}

				const lowerColor = viridisColormap[lowerIndex];
				const upperColor = viridisColormap[upperIndex];

				// Ensure we return a tuple of exactly 3 numbers
				return [
					Math.round(lowerColor[0] * (1 - t) + upperColor[0] * t),
					Math.round(lowerColor[1] * (1 - t) + upperColor[1] * t),
					Math.round(lowerColor[2] * (1 - t) + upperColor[2] * t)
				];
			}

			// Find data range to determine no-data values
			const rasterData = data as any;
			let minValue = Infinity;
			let maxValue = -Infinity;

			// Scan for min/max values and identify no-data areas
			for (let i = 0; i < imageWidth * imageHeight; i++) {
				const value = rasterData[0][i]; // First band
				if (value !== 0 && !isNaN(value)) {
					minValue = Math.min(minValue, value);
					maxValue = Math.max(maxValue, value);
				}
			}

			console.log(`GeoTIFF Example: Data range: ${minValue} to ${maxValue}`);

			// Apply colormap to raster data with better no-data handling
			for (let i = 0; i < imageWidth * imageHeight; i++) {
				const value = rasterData[0][i]; // First band

				// More aggressive no-data detection
				// Consider values very close to 0 or outside reasonable range as no-data
				if (value === 0 || isNaN(value) || value < minValue * 0.01) {
					// Transparent for no-data values
					imageData.data[i * 4] = 0;
					imageData.data[i * 4 + 1] = 0;
					imageData.data[i * 4 + 2] = 0;
					imageData.data[i * 4 + 3] = 0;
				} else {
					// Apply viridis colormap
					const [r, g, b] = getViridisColor(value);
					imageData.data[i * 4] = r;
					imageData.data[i * 4 + 1] = g;
					imageData.data[i * 4 + 2] = b;
					imageData.data[i * 4 + 3] = 255; // Alpha
				}
			}

			// Put the image data on the canvas
			ctx.putImageData(imageData, 0, 0);

			// Convert canvas to data URL
			dataUrl = canvas.toDataURL('image/png');
			console.log('GeoTIFF Example: Created data URL');

			// Add the layer to the map
			addLayerToMap();

			// Dispatch success event
			dispatch('loaded', { metadata });
		} catch (err: any) {
			console.error('GeoTIFF Example: Error loading GeoTIFF:', err);
			error = err.message || 'Failed to load GeoTIFF';
			dispatch('error', { error });
		} finally {
			loading = false;
		}
	}

	// Add the processed GeoTIFF as a layer to the map
	function addLayerToMap() {
		if (!map || !dataUrl || !bounds) return;

		try {
			// Remove existing layer and source if they exist
			if (map.getLayer(layerId)) {
				map.removeLayer(layerId);
			}
			if (map.getSource(sourceId)) {
				map.removeSource(sourceId);
			}

			// Define coordinates for the image
			// [top-left, top-right, bottom-right, bottom-left]
			// Ensure bounds has at least 4 elements
			if (bounds.length < 4) {
				throw new Error('Invalid bounds: expected at least 4 elements');
			}

			// Use the bounds directly
			const west = bounds[0];
			const south = bounds[1];
			const east = bounds[2];
			const north = bounds[3];

			const coordinates: [[number, number], [number, number], [number, number], [number, number]] =
				[
					[west, north], // top-left [lng, lat]
					[east, north], // top-right
					[east, south], // bottom-right
					[west, south] // bottom-left
				];

			console.log('GeoTIFF Example: Adding image source with coordinates:', coordinates);

			// Add source
			map.addSource(sourceId, {
				type: 'image',
				url: dataUrl,
				coordinates: coordinates
			});

			// Add layer
			map.addLayer({
				id: layerId,
				type: 'raster',
				source: sourceId,
				paint: {
					'raster-opacity': visible ? opacity : 0
				}
			});

			console.log('GeoTIFF Example: Layer added to map');

			// Optionally fit bounds - convert bounds array to LngLatBoundsLike format
			// LngLatBoundsLike can be [[lng, lat], [lng, lat]] format (southwest and northeast corners)
			try {
				console.log('GeoTIFF Example: Fitting to bounds:', [
					[west, south],
					[east, north]
				]);
				map.fitBounds(
					[
						[west, south],
						[east, north]
					],
					{ padding: 50, duration: 500 }
				);
			} catch (err) {
				console.error('GeoTIFF Example: Error fitting bounds:', err);
				// Don't throw here, we still want to show the layer even if we can't fit to bounds
			}
		} catch (err) {
			console.error('GeoTIFF Example: Error adding layer to map:', err);
		}
	}

	// Update layer visibility
	$: if (map && map.getLayer(layerId)) {
		map.setPaintProperty(layerId, 'raster-opacity', visible ? opacity : 0);
	}

	// Update layer opacity
	$: if (map && map.getLayer(layerId) && visible) {
		map.setPaintProperty(layerId, 'raster-opacity', opacity);
	}

	// Load GeoTIFF when component mounts or URL changes
	$: if (map && url) {
		loadGeoTIFF();
	}

	// Clean up when component is destroyed
	onDestroy(() => {
		if (map) {
			if (map.getLayer(layerId)) {
				map.removeLayer(layerId);
			}
			if (map.getSource(sourceId)) {
				map.removeSource(sourceId);
			}
		}
	});
</script>

<div class="geotiff-example">
	{#if loading}
		<div class="loading">Loading GeoTIFF...</div>
	{:else if error}
		<div class="error">Error: {error}</div>
	{:else if metadata}
		<div class="controls">
			<h4>GeoTIFF Example</h4>
			<label>
				<input type="checkbox" bind:checked={visible} />
				Visible
			</label>
			<label>
				Opacity: {(opacity * 100).toFixed(0)}%
				<input type="range" min="0" max="1" step="0.01" bind:value={opacity} />
			</label>
			<div class="metadata">
				<details>
					<summary>Metadata</summary>
					<pre>{JSON.stringify(metadata, null, 2)}</pre>
				</details>
			</div>
		</div>
	{/if}
</div>

<style>
	.geotiff-example {
		position: absolute;
		top: 80px;
		right: 10px;
		z-index: 10;
		background: white;
		border-radius: 4px;
		padding: 10px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		max-width: 300px;
	}

	.loading,
	.error {
		padding: 5px;
	}

	.error {
		color: red;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.metadata {
		font-size: 0.8rem;
		margin-top: 8px;
	}

	pre {
		white-space: pre-wrap;
		word-break: break-all;
		font-size: 0.7rem;
		max-height: 200px;
		overflow: auto;
	}
</style>
