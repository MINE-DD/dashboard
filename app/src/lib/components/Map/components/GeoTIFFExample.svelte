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

			// Extract more detailed metadata
			const fileDirectory = image.getFileDirectory();
			const geoKeys = image.getGeoKeys();

			// Check for projection information
			let projectionInfo = null;
			try {
				if (geoKeys && geoKeys.ProjectedCSTypeGeoKey) {
					projectionInfo = `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`;
				} else if (geoKeys && geoKeys.GeographicTypeGeoKey) {
					projectionInfo = `EPSG:${geoKeys.GeographicTypeGeoKey}`;
				}
			} catch (err) {
				console.warn('GeoTIFF Example: Error extracting projection info:', err);
			}

			// Collect all metadata
			metadata = {
				width: imageWidth,
				height: imageHeight,
				bounds: imageBounds,
				resolution: image.getResolution(),
				samplesPerPixel: image.getSamplesPerPixel(),
				fileDirectory: fileDirectory,
				geoKeys: geoKeys,
				projection: projectionInfo,
				origin: image.getOrigin()
			};

			console.log('GeoTIFF Example: Detailed metadata loaded:', metadata);
			console.log('GeoTIFF Example: Projection info:', projectionInfo);
			console.log('GeoTIFF Example: File directory:', fileDirectory);
			console.log('GeoTIFF Example: GeoKeys:', geoKeys);

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

					// Log all properties from TiTiler response
					console.log('GeoTIFF Example: TiTiler response details:');
					for (const key in boundsJson) {
						console.log(`  - ${key}:`, boundsJson[key]);
					}

					// Check for CRS information
					if (boundsJson.crs) {
						console.log('GeoTIFF Example: TiTiler CRS:', boundsJson.crs);
					}

					if (boundsJson?.bounds && boundsJson.bounds.length === 4) {
						// Update bounds with TiTiler data
						bounds = boundsJson.bounds;
						console.log('GeoTIFF Example: Raw bounds from TiTiler:', bounds);

						// Check for global bounds and adjust if needed
						// Make sure bounds is not null before accessing its elements
						const isGlobalBounds =
							bounds &&
							bounds[0] === -180 &&
							bounds[1] === -90 &&
							bounds[2] === 180 &&
							bounds[3] === 90;

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

			// Create a canvas with transparent background
			const canvas = document.createElement('canvas');
			canvas.width = imageWidth;
			canvas.height = imageHeight;

			const ctx = canvas.getContext('2d', { alpha: true });
			if (!ctx) throw new Error('Could not get canvas context');

			// Clear canvas with transparent background
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Create an ImageData object
			const imageData = ctx.createImageData(imageWidth, imageHeight);

			// Fill the ImageData based on the raster data
			// Using viridis colormap similar to TiTiler
			console.log('GeoTIFF Example: Rendering to canvas...');

			// Define a modified colormap with less purple tones
			// Starting with more blues and greens instead of purples
			const viridisColormap = [
				[0, 32, 77], // Dark blue
				[0, 66, 128], // Medium blue
				[0, 97, 142], // Blue
				[0, 128, 153], // Teal
				[0, 155, 136], // Teal-green
				[53, 183, 121], // Green
				[109, 205, 89], // Light green
				[180, 222, 44], // Yellow-green
				[223, 227, 24], // Yellow
				[253, 231, 37] // Bright yellow
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

			// Apply colormap to raster data with more aggressive no-data handling
			for (let i = 0; i < imageWidth * imageHeight; i++) {
				const value = rasterData[0][i]; // First band

				// More aggressive no-data detection
				// Consider values that are 0, NaN, or very small as no-data
				if (value === 0 || isNaN(value) || value < minValue * 0.05 || value < 0.001) {
					// Make no-data values completely transparent
					imageData.data[i * 4] = 0;
					imageData.data[i * 4 + 1] = 0;
					imageData.data[i * 4 + 2] = 0;
					imageData.data[i * 4 + 3] = 0; // Completely transparent
				} else {
					// Apply viridis colormap for actual data
					const [r, g, b] = getViridisColor(value);
					imageData.data[i * 4] = r;
					imageData.data[i * 4 + 1] = g;
					imageData.data[i * 4 + 2] = b;
					imageData.data[i * 4 + 3] = 255; // Fully opaque
				}
			}

			// Put the image data on the canvas
			ctx.putImageData(imageData, 0, 0);

			// Convert canvas to data URL with PNG format to preserve transparency
			dataUrl = canvas.toDataURL('image/png', 1.0);
			console.log('GeoTIFF Example: Created data URL with transparency');

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

			// Check if we have projection information from the GeoTIFF
			const projectionInfo = metadata?.projection;
			console.log('GeoTIFF Example: Using projection info for coordinates:', projectionInfo);

			// Get the bounds from the GeoTIFF or TiTiler
			const geotiffBounds = metadata?.bounds;
			console.log('GeoTIFF Example: GeoTIFF bounds for reference:', geotiffBounds);

			// Calculate coordinates based on the projection
			let fixedCoordinates: [
				[number, number],
				[number, number],
				[number, number],
				[number, number]
			];

			// Web Mercator has limitations at extreme latitudes, so we use 85.051129 as the max latitude
			// This is the maximum latitude in the Web Mercator projection (EPSG:3857)
			const WEB_MERCATOR_MAX_LAT = 85.051129;

			// Check if we have Web Mercator projection (EPSG:3857)
			const isWebMercator = projectionInfo === 'EPSG:3857';

			// Function to convert Web Mercator coordinates to Lat/Lng
			function mercatorToLatLng(mercatorX: number, mercatorY: number): [number, number] {
				// Convert Web Mercator X,Y to lat/lng
				// X goes from -20037508.34 to 20037508.34
				// Y goes from -20037508.34 to 20037508.34

				const x = mercatorX;
				const y = mercatorY;

				// Convert to lat/lng
				const lng = (x / 20037508.34) * 180;
				let lat = (y / 20037508.34) * 180;

				// Convert latitude using inverse Mercator projection
				lat = ((2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2) * 180) / Math.PI;

				// Clamp to valid lat/lng range
				const clampedLng = Math.max(-180, Math.min(180, lng));
				const clampedLat = Math.max(-85.051129, Math.min(85.051129, lat));

				return [clampedLng, clampedLat];
			}

			// Try to use a more accurate approach based on the GeoTIFF bounds if available
			if (
				bounds &&
				bounds.length === 4 &&
				bounds[0] !== -180 &&
				bounds[1] !== -90 &&
				bounds[2] !== 180 &&
				bounds[3] !== 90
			) {
				// Use the actual bounds from the GeoTIFF or TiTiler
				console.log('GeoTIFF Example: Using actual bounds for coordinates');

				if (isWebMercator && Math.abs(bounds[0]) > 180) {
					// Convert Web Mercator coordinates to lat/lng
					console.log('GeoTIFF Example: Converting Web Mercator coordinates to lat/lng');

					const topLeft = mercatorToLatLng(bounds[0], bounds[3]);
					const topRight = mercatorToLatLng(bounds[2], bounds[3]);
					const bottomRight = mercatorToLatLng(bounds[2], bounds[1]);
					const bottomLeft = mercatorToLatLng(bounds[0], bounds[1]);

					console.log('GeoTIFF Example: Converted coordinates:');
					console.log('  Top-left:', topLeft);
					console.log('  Top-right:', topRight);
					console.log('  Bottom-right:', bottomRight);
					console.log('  Bottom-left:', bottomLeft);

					fixedCoordinates = [
						topLeft, // top-left [lng, lat]
						topRight, // top-right
						bottomRight, // bottom-right
						bottomLeft // bottom-left
					];
				} else {
					// Use bounds directly if they're already in lat/lng
					fixedCoordinates = [
						[bounds[0], bounds[3]], // top-left [lng, lat]
						[bounds[2], bounds[3]], // top-right
						[bounds[2], bounds[1]], // bottom-right
						[bounds[0], bounds[1]] // bottom-left
					];
				}
			} else {
				// Use world map coordinates with Web Mercator limits
				console.log('GeoTIFF Example: Using world map coordinates with Web Mercator limits');
				fixedCoordinates = [
					[-180, WEB_MERCATOR_MAX_LAT], // top-left [lng, lat]
					[180, WEB_MERCATOR_MAX_LAT], // top-right
					[180, -WEB_MERCATOR_MAX_LAT], // bottom-right
					[-180, -WEB_MERCATOR_MAX_LAT] // bottom-left
				];
			}

			console.log('GeoTIFF Example: Using coordinates:', fixedCoordinates);

			// Add source with fixed coordinates
			map.addSource(sourceId, {
				type: 'image',
				url: dataUrl,
				coordinates: fixedCoordinates
			});

			// Add layer with opacity setting
			map.addLayer({
				id: layerId,
				type: 'raster',
				source: sourceId,
				paint: {
					'raster-opacity': visible ? opacity : 0
				}
			});

			console.log('GeoTIFF Example: Layer added to map');

			// Fit to appropriate bounds
			try {
				// Use converted bounds if we have them, otherwise use world bounds
				let fitBounds: [[number, number], [number, number]];

				if (isWebMercator && bounds && bounds.length === 4 && Math.abs(bounds[0]) > 180) {
					// Convert Web Mercator bounds to lat/lng for fitting
					const sw = mercatorToLatLng(bounds[0], bounds[1]);
					const ne = mercatorToLatLng(bounds[2], bounds[3]);

					// Use the converted bounds
					fitBounds = [sw, ne];
					console.log('GeoTIFF Example: Fitting to converted bounds:', fitBounds);
				} else {
					// Use world map bounds with Web Mercator limits
					fitBounds = [
						[-180, -85.051129], // southwest
						[180, 85.051129] // northeast
					];
					console.log('GeoTIFF Example: Fitting to world map bounds:', fitBounds);
				}

				map.fitBounds(fitBounds, { padding: 20, duration: 500 });
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
