<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { Map } from 'maplibre-gl';
	import {
		pointsData,
		filteredPointsData,
		selectedPathogens,
		selectedAgeGroups,
		selectedSyndromes,
		pathogenColors,
		getMaplibreFilterExpression,
		clearFilterCache,
		isLoading,
		dataError
	} from '../MapStore';

	// Props
	export let map: Map | null = null;
	export let layerId = 'study-points';
	export let sourceId = 'points-source';
	export let clusterPointsAtZoomLevels = false; // Enable/disable clustering

	// Event dispatcher for selected point
	const dispatch = createEventDispatcher();
	let hoveredId: number | null = null;
	let layerAdded = false;
	let needsFilterUpdate = false;

	// Track selection changes to update filters
	$: if ($selectedPathogens || $selectedAgeGroups || $selectedSyndromes) {
		if (layerAdded) {
			needsFilterUpdate = true;
		}
	}

	// Reactively apply map updates
	$: if (map && $pointsData.features.length > 0 && map.loaded()) {
		addMapLayer();
	}

	$: if (map && needsFilterUpdate && layerAdded) {
		updateFilters();
		needsFilterUpdate = false;
	}

	// Wait for the map and data to be ready, then add the layer
	function addMapLayer() {
		if (!map || !map.loaded()) return;

		// Check if source exists
		let sourceExists = false;
		try {
			sourceExists = !!map.getSource(sourceId);
		} catch (e) {
			sourceExists = false;
		}

		// Add or update source
		if (!sourceExists) {
			try {
				// Add source with appropriate configuration
				if (clusterPointsAtZoomLevels) {
					map.addSource(sourceId, {
						type: 'geojson',
						data: $pointsData,
						cluster: true,
						clusterMaxZoom: 12, // Maximum zoom to cluster points
						clusterRadius: 50 // Radius of each cluster
					});
				} else {
					map.addSource(sourceId, {
						type: 'geojson',
						data: $pointsData
					});
				}
				console.log(`Added source with ${$pointsData.features.length} features`);
			} catch (error) {
				console.error('Error adding source:', error);
				return;
			}
		} else {
			// Update source data
			try {
				const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
				source.setData($pointsData);
			} catch (error) {
				console.error('Error updating source:', error);
			}
		}

		// Check if layer exists
		let layerExists = false;
		try {
			layerExists = !!map.getLayer(layerId);
		} catch (e) {
			layerExists = false;
		}

		// Add layer if it doesn't exist
		if (!layerExists) {
			try {
				// Add main points layer
				map.addLayer({
					id: layerId,
					type: 'circle',
					source: sourceId,
					filter: clusterPointsAtZoomLevels ? ['!', ['has', 'point_count']] : undefined,
					paint: {
						// Circle radius based on zoom level and prevalence
						'circle-radius': [
							'interpolate',
							['linear'],
							['zoom'],
							2,
							3, // At zoom level 2, radius is 3px
							5,
							5, // At zoom level 5, radius is 5px
							10,
							8 // At zoom level 10, radius is 8px
						],
						// Color based on pathogen, with hover effect
						'circle-color': [
							'case',
							['boolean', ['feature-state', 'hover'], false],
							'#ff0000', // Hover color
							['match', ['get', 'pathogen'], ...getColorMatchExpressions()]
						],
						'circle-opacity': 0.8,
						'circle-stroke-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 1],
						'circle-stroke-color': '#ffffff'
					}
				});

				// If clustering is enabled, add cluster layers
				if (clusterPointsAtZoomLevels) {
					// Add cluster circles
					map.addLayer({
						id: `${layerId}-clusters`,
						type: 'circle',
						source: sourceId,
						filter: ['has', 'point_count'],
						paint: {
							'circle-color': [
								'step',
								['get', 'point_count'],
								'#51bbd6', // Small clusters
								100,
								'#f1f075', // Medium clusters
								750,
								'#f28cb1' // Large clusters
							],
							'circle-radius': [
								'step',
								['get', 'point_count'],
								20, // Radius for small clusters
								100,
								30, // Radius for medium clusters
								750,
								40 // Radius for large clusters
							],
							'circle-opacity': 0.7,
							'circle-stroke-width': 1,
							'circle-stroke-color': '#ffffff'
						}
					});

					// Add cluster count labels
					map.addLayer({
						id: `${layerId}-cluster-count`,
						type: 'symbol',
						source: sourceId,
						filter: ['has', 'point_count'],
						layout: {
							'text-field': '{point_count_abbreviated}',
							'text-font': ['Arial Unicode MS Bold'],
							'text-size': 12
						},
						paint: {
							'text-color': '#ffffff'
						}
					});
				}

				// Setup mouse events for interactivity
				setupMapEvents();
				layerAdded = true;
				needsFilterUpdate = true;
			} catch (error) {
				console.error('Error adding layers:', error);
			}
		}

		// Apply filters
		if (needsFilterUpdate) {
			updateFilters();
			needsFilterUpdate = false;
		}
	}

	// Helper function to create the MapLibre match expressions for coloring points by pathogen
	function getColorMatchExpressions() {
		const expressions = [];

		// Add each pathogen/color pair
		$pathogenColors.forEach((color, pathogen) => {
			expressions.push(pathogen, color);
		});

		// Add default color at the end
		expressions.push('#000000');

		return expressions;
	}

	// Update the map layer filters based on selected values
	function updateFilters() {
		if (!map || !layerAdded) return;

		try {
			// Get optimized filter expression
			const filterExpression = getMaplibreFilterExpression();

			// Apply filter to main layer
			if (map.getLayer(layerId)) {
				map.setFilter(
					layerId,
					clusterPointsAtZoomLevels
						? ['all', ['!', ['has', 'point_count']], ...filterExpression.slice(1)]
						: filterExpression
				);
			}

			// If using clusters, also update cluster source data to reflect the filtering
			if (clusterPointsAtZoomLevels) {
				// For clusters, we need to filter the source data
				const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
				source.setData($filteredPointsData);
			}

			console.log('Filters updated:', filterExpression);
		} catch (error) {
			console.error('Error updating filters:', error);
		}
	}

	// Setup mouse events for interactivity
	function setupMapEvents() {
		if (!map) return;

		// Hover effect for points
		map.on('mousemove', layerId, (e) => {
			if (e.features && e.features.length > 0) {
				if (hoveredId !== null) {
					map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
				}

				hoveredId = e.features[0].id as number;
				map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: true });

				// Change cursor to pointer
				map.getCanvas().style.cursor = 'pointer';
			}
		});

		// Reset hover effect when mouse leaves
		map.on('mouseleave', layerId, () => {
			if (hoveredId !== null) {
				map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
				hoveredId = null;
				map.getCanvas().style.cursor = '';
			}
		});

		// Click handler for points - show details
		map.on('click', layerId, (e) => {
			if (e.features && e.features.length > 0) {
				const feature = e.features[0];
				const coordinates = feature.geometry.coordinates.slice() as [number, number];
				const properties = feature.properties;

				// Dispatch event with point data to show popup
				dispatch('pointclick', {
					feature,
					coordinates,
					properties
				});
			}
		});

		// If clustering is enabled, add cluster click handling
		if (clusterPointsAtZoomLevels) {
			// Click handler for clusters - zoom in
			map.on('click', `${layerId}-clusters`, (e) => {
				if (e.features && e.features.length > 0) {
					const feature = e.features[0];
					const clusterId = feature.properties.cluster_id;
					const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;

					// Zoom to the cluster
					(source as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
						if (err) return;

						map.easeTo({
							center: (feature.geometry as any).coordinates,
							zoom: zoom
						});
					});
				}
			});

			// Cursor handling for clusters
			map.on('mouseenter', `${layerId}-clusters`, () => {
				map.getCanvas().style.cursor = 'pointer';
			});

			map.on('mouseleave', `${layerId}-clusters`, () => {
				map.getCanvas().style.cursor = '';
			});
		}
	}

	// Clean up on destroy
	onDestroy(() => {
		if (map) {
			// Remove all event listeners
			map.off('mousemove', layerId);
			map.off('mouseleave', layerId);
			map.off('click', layerId);

			if (clusterPointsAtZoomLevels) {
				map.off('click', `${layerId}-clusters`);
				map.off('mouseenter', `${layerId}-clusters`);
				map.off('mouseleave', `${layerId}-clusters`);
			}

			// Remove all layers and source
			try {
				if (clusterPointsAtZoomLevels && map.getLayer(`${layerId}-cluster-count`)) {
					map.removeLayer(`${layerId}-cluster-count`);
				}

				if (clusterPointsAtZoomLevels && map.getLayer(`${layerId}-clusters`)) {
					map.removeLayer(`${layerId}-clusters`);
				}

				if (map.getLayer(layerId)) {
					map.removeLayer(layerId);
				}

				if (map.getSource(sourceId)) {
					map.removeSource(sourceId);
				}
			} catch (error) {
				console.error('Error cleaning up map resources:', error);
			}
		}
	});
</script>

{#if $dataError}
	<div class="map-error">
		<p>Error loading data: {$dataError}</p>
	</div>
{/if}
