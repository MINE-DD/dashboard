<script lang="ts">
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import {
		MAP_STYLES,
		MapStyleCategory,
		getStyleById,
		getStylesByCategory,
		type MapStyle
	} from '../MapStyles';
	import { selectedMapStyle } from '$lib/stores/mapStyle.store';
	import { setMapStyle } from '../utils/MapStyleManager';

	// Props
	export let map: MaplibreMap | null = null;
	export let position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-right';

	// Get styles by category
	let stylesByCategory = getStylesByCategory();

	// Handle style selection
	function handleStyleSelect(style: MapStyle) {
		if (map) {
			setMapStyle(map, style);
		}
	}

	// Generate position classes
	$: positionClasses = {
		'top-left': 'absolute left-10 top-12 z-10',
		'top-right': 'absolute right-10 top-12 z-10',
		'bottom-left': 'absolute left-10 bottom-12 z-10',
		'bottom-right': 'absolute right-10 bottom-12 z-10'
	}[position];
</script>

<div class="map-controls {positionClasses}">
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
							on:click={() => handleStyleSelect(style)}
						>
							{style.name}
						</button>
					</li>
				{/each}
			{/each}
		</ul>
	</div>
</div>

<style>
	/* Style indicator for active map style */
	:global(.menu li button.active) {
		background-color: hsl(var(--p) / 0.2);
		color: hsl(var(--pc));
	}
</style>
