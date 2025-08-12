<script lang="ts">
	import {
		pathogens,
		ageGroups,
		syndromes,
		selectedPathogens,
		selectedAgeGroups,
		selectedSyndromes,
		pathogenColors,
		isLoading,
		dataError,
		clearFilterCache,
		filteredPointsData, // Uncommented to use for point counting
		pointsData, // Added for total points count
		// Import new raster stores and functions
		rasterLayers,
		addRasterLayerFromUrl,
		updateRasterLayerVisibility,
		updateRasterLayerOpacity,
		updateAllRasterLayersOpacity,
		removeRasterLayer,
		// Import filter-to-raster mapping functionality
		initFilterRasterConnection,
		autoVisibleRasterLayers,
		// Import loadPointsData for reloading data
		loadPointsData,
		// Import visualization type store
		visualizationType,
		switchVisualization,
		type VisualizationType,
		// Import bar thickness store
		barThickness,
		// Import new derived stores for filter option counts
		pathogenCounts,
		ageGroupCounts,
		syndromeCounts
	} from '../store';
	import { writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	// Import URL parameter utilities
	import { parseUrlFilters, serializeFiltersToUrl, debounce } from '../utils/urlParams';
	// Import map update functions
	import {
		updateMapVisualization,
		// triggerVisualizationUpdate, // Removed as part of refactor
		handleMapContentChange
	} from '../store';
	import MaterialSymbolsSettingsOutlineRounded from '~icons/material-symbols/settings-outline-rounded';
	import { stripItalicMarkers, sortByValField } from '../utils/textFormatter';
	import FilterDropdown from './FilterDropdown.svelte';

	const dispatch = createEventDispatcher();

	// Import the filter-to-raster mappings to check which options have raster layers
	import { filterToRasterMappings } from '../store/filterRasterMapping';
	import type { FilterToRasterMapping } from '$lib/types';

	// Import localStorage utilities for settings persistence
	import {
		loadStoredSettings,
		saveSettingsToStorage
	} from '$lib/stores/visualizationSettings/localStorage';

	let className: string | undefined = undefined; // class is a reserved keyword in JS, with initialization
	export { className as class };
	// Helper functions to check if an option has associated raster layers

	// Initialize the filter-to-raster connection
	let filterRasterUnsubscribe: () => void;

	// --- Raster Layer State ---
	let cogUrlInput = '';
	let isAddingLayer = false;
	export let globalOpacity = 80; // Default to 80%, now exposed as a prop
	let rasterLayersVisible = true; // Track if raster layers are visible

	let pathogensWithRasterLayers = new Set<string>();

	// Initialize a set of pathogens that have raster layers
	function initPathogensWithRasterLayers() {
		pathogensWithRasterLayers.clear();
		filterToRasterMappings.forEach((mapping) => {
			if (mapping.pathogen) {
				pathogensWithRasterLayers.add(mapping.pathogen);
			}
		});
	}

	function hasRasterLayers(type: 'pathogen' | 'ageGroup' | 'syndrome', value: string): boolean {
		if (type === 'pathogen') {
			return pathogensWithRasterLayers.has(value);
		}

		return filterToRasterMappings.some((mapping: FilterToRasterMapping) => {
			if (type === 'ageGroup') return mapping.ageGroup === value;
			if (type === 'syndrome') return mapping.syndrome === value;
			return false;
		});
	}

	// Handle toggling raster layer visibility
	function toggleRasterLayerVisibility() {
		rasterLayersVisible = !rasterLayersVisible;
		const opacity = rasterLayersVisible ? globalOpacity / 100 : 0;
		updateAllRasterLayersOpacity(opacity);
	}
	// Import the dynamic URL from MapInitializer
	import { POINTS_DATA_URL } from '../utils/MapInitializer';

	// Visualization type options
	import { visualizationOptions } from '../store/visualizationOptions';

	function handleVisualizationTypeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newType = target.value as VisualizationType;

		console.log('Visualization type change requested:', newType);
		updateVisualizationType(newType);
	}

	async function handleAddLayerClick() {
		if (!cogUrlInput || isAddingLayer) return;

		// Basic URL validation (more robust validation could be added)
		try {
			new URL(cogUrlInput);
		} catch (_) {
			// Use toast store if available, otherwise console log
			console.error('Invalid URL format');
			// import { toastStore } from '$lib/stores/toast.store'; // Import if needed
			return;
		}

		isAddingLayer = true;
		await addRasterLayerFromUrl(cogUrlInput);
		isAddingLayer = false;
		cogUrlInput = ''; // Clear input on success/attempt
	}

	// Sidebar configuration
	let collapsed = false;
	let showSettingsModal = false;

	// Stats for selected filters
	$: visiblePoints = $filteredPointsData?.features?.length || 0;
	$: totalPoints = $pointsData?.features?.length || 0;
	$: selectedPathogenCount = $selectedPathogens?.size || 0; // Add null checks
	$: selectedAgeGroupCount = $selectedAgeGroups?.size || 0; // Add null checks
	$: selectedSyndromeCount = $selectedSyndromes?.size || 0; // Add null checks
	$: hasActiveFilters =
		selectedPathogenCount > 0 || selectedAgeGroupCount > 0 || selectedSyndromeCount > 0;

	// Note: Map updates are now triggered automatically by the enhanced stores
	// No need for reactive statements to trigger updates

	// Action functions that update stores and trigger map updates
	async function updatePathogenSelection(newSelection: Set<string>) {
		console.log('Updating pathogen selection:', newSelection);
		selectedPathogens.set(newSelection);
		await handleMapContentChange();
	}

	async function updateAgeGroupSelection(newSelection: Set<string>) {
		console.log('Updating age group selection:', newSelection);
		selectedAgeGroups.set(newSelection);
		await handleMapContentChange();
	}

	async function updateSyndromeSelection(newSelection: Set<string>) {
		console.log('Updating syndrome selection:', newSelection);
		selectedSyndromes.set(newSelection);
		await handleMapContentChange();
	}

	function updateVisualizationType(newType: VisualizationType) {
		console.log('Requesting switch to visualization type:', newType);
		// Just update the store - the centralized handler will do the actual switch
		visualizationType.set(newType);
	}

	// Helper function to toggle a value in a Set
	function toggleSelection(set: Set<string>, value: string): Set<string> {
		const newSet = new Set<string>();
		if (!set.has(value)) {
			newSet.add(value);
		}
		return newSet;
	}

	// Helper function to toggle all values in a category
	function toggleAll(category: 'pathogens' | 'ageGroups' | 'syndromes', checked: boolean) {
		if (category === 'pathogens') {
			$selectedPathogens = checked ? new Set($pathogens) : new Set();
		} else if (category === 'ageGroups') {
			$selectedAgeGroups = checked ? new Set($ageGroups) : new Set();
		} else if (category === 'syndromes') {
			$selectedSyndromes = checked ? new Set($syndromes) : new Set();
		}
		clearFilterCache();

		// The filteredPointsData store will automatically update due to the derived store
		// No need to force reload data
	}

	// Clear all active filters
	async function clearAllFilters() {
		await updatePathogenSelection(new Set());
		await updateAgeGroupSelection(new Set());
		await updateSyndromeSelection(new Set());
		clearFilterCache();

		// Update URL by removing filter parameters
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			// Remove filter parameters
			url.searchParams.delete('p');
			url.searchParams.delete('a');
			url.searchParams.delete('s');
			// Keep other parameters (style, center, zoom, opacity)
			goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
		}
	}

	// Handle select change
	async function handleSelectChange(
		event: Event,
		category: 'pathogens' | 'ageGroups' | 'syndromes'
	) {
		const select = event.target as HTMLSelectElement;
		const selectedValue = select.value;

		console.log(`Filter changed: ${category} = ${selectedValue}`);

		// First clear the filter cache to ensure fresh filtering
		clearFilterCache();

		// Then update only the selected filter category, keeping other filters intact
		if (category === 'pathogens') {
			const newSet = new Set<string>();
			if (selectedValue) newSet.add(selectedValue);
			await updatePathogenSelection(newSet);
		} else if (category === 'ageGroups') {
			const newSet = new Set<string>();
			if (selectedValue) newSet.add(selectedValue);
			await updateAgeGroupSelection(newSet);
		} else if (category === 'syndromes') {
			const newSet = new Set<string>();
			if (selectedValue) newSet.add(selectedValue);
			await updateSyndromeSelection(newSet);
		}

		// Log the current state of filters
		console.log('Current filters after change:', {
			pathogens: Array.from($selectedPathogens),
			ageGroups: Array.from($selectedAgeGroups),
			syndromes: Array.from($selectedSyndromes)
		});

		// The filteredPointsData store will automatically update due to the derived store
		// No need to force reload data - just clear the cache to ensure fresh filtering
		console.log(
			`After filter change: ${$filteredPointsData.features.length} points visible out of ${$pointsData.features.length} total`
		);
	}

	// Initialize on mount
	onMount(() => {
		// Initialize the filter-to-raster connection
		filterRasterUnsubscribe = initFilterRasterConnection();

		// Initialize the set of pathogens with raster layers
		initPathogensWithRasterLayers();

		// Load stored settings from localStorage
		const storedSettings = loadStoredSettings();

		// Parse URL parameters to set initial opacity (URL takes precedence over localStorage)
		const urlParams = parseUrlFilters();
		if (urlParams.opacity !== undefined) {
			globalOpacity = urlParams.opacity;
		} else {
			// Use stored opacity if no URL parameter
			globalOpacity = storedSettings.globalOpacity;
		}

		// Apply the opacity to all raster layers
		updateAllRasterLayersOpacity(globalOpacity / 100);
		
		// Set initial checkbox state based on opacity
		rasterLayersVisible = globalOpacity > 0;

		// Update barThickness store with stored value
		barThickness.set(storedSettings.barThickness);
	});

	// Clean up subscription when component is destroyed
	onDestroy(() => {
		if (filterRasterUnsubscribe) {
			filterRasterUnsubscribe();
		}
	});
</script>

<div
	class={'grid max-h-[calc(100%-20px)] overflow-visible rounded-lg border border-white/30 bg-gradient-to-r from-white/80 to-white/70 backdrop-blur-md backdrop-filter transition-all duration-300 sm:shadow-lg ' +
		className}
>
	<!-- Sidebar header with toggle button -->
	<div class="z-10 border-b border-white/30 bg-gradient-to-r from-white/40 to-white/20 p-4">
		<div class="hidden w-full items-center justify-between sm:flex">
			<h2 class="text-base-content text-md m-0 mr-8 font-semibold">Data Explorer</h2>
			<div class="flex items-center gap-1">
				<!-- Settings button -->
				<button
					class="btn btn-sm btn-ghost btn-square"
					title="Visualization Settings"
					on:click={() => (showSettingsModal = true)}
				>
					<MaterialSymbolsSettingsOutlineRounded />
				</button>
				<!-- Collapse button -->
				<button
					class="btn btn-sm btn-ghost btn-square"
					title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					on:click={() => (collapsed = !collapsed)}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="h-5 w-5"
					>
						{#if collapsed}
							<polyline points="9 18 15 12 9 6"></polyline>
						{:else}
							<polyline points="6 9 12 15 18 9"></polyline>
						{/if}
					</svg>
				</button>
			</div>
		</div>

		{#if !collapsed}
			<!-- {#if $isLoading}
				<div class="text-base-content/70 mt-2 flex items-center gap-2 text-sm">
					<span class="loading loading-spinner loading-xs"></span>
					<span>Loading data...</span>
				</div> -->
			{#if $dataError}
				<div class="text-error mt-2 text-sm">Error: {$dataError}</div>
			{:else if $pathogens?.size > 0}
				<!-- Simplified condition, adjust if needed -->
				<div class="mt-3">
					<div class="flex flex-col items-center justify-between sm:flex-row">
						<div class="flex items-baseline">
							<span class="text-primary text-lg font-bold">{visiblePoints}</span>
							{#if hasActiveFilters}
								<span class="text-base-content/70 mx-1 text-sm">of</span>
								<span class="text-base-content/80 text-base font-medium">{totalPoints}</span>
								<span class="text-base-content/70 ml-1 text-sm">points</span>
							{:else}
								<span class="text-base-content/70 ml-1 text-sm">points</span>
							{/if}
						</div>
						{#if hasActiveFilters}
							<button class="btn btn-sm" on:click={clearAllFilters}>Clear Filters</button>
						{/if}
					</div>
				</div>
			{/if}
		{/if}
	</div>

	{#if !collapsed}
		<!-- Content -->
		<div
			class="flex h-full max-h-[calc(100vh-250px)] w-full flex-col space-y-4 overflow-y-auto p-1 pt-3 sm:max-h-[calc(100vh-250px)] sm:w-80 sm:p-4"
			style="overflow-x: visible;"
		>
			<!-- Visualization Type Selector -->
			<div class="form-control w-full">
				<div class="rounded-lg border border-white/50 bg-white/50 p-3 shadow-sm">
					<label for="visualization-type" class="label px-0 py-1">
						<span class="label-text text-secondary-focus flex items-center text-base font-medium">
							Visualization Type
						</span>
					</label>
					<select
						id="visualization-type"
						value={$visualizationType}
						on:change={handleVisualizationTypeChange}
						class="select select-bordered focus:border-primary focus:ring-primary/30 w-full bg-white/80 focus:ring"
					>
						{#each visualizationOptions as option}
							<option value={option.value}>
								{option.label}
							</option>
						{/each}
					</select>
					<!-- Show description for selected option -->
					{#each visualizationOptions as option}
						{#if option.value === $visualizationType}
							<p class="text-base-content/70 mt-1 text-xs italic">{option.description}</p>
						{/if}
					{/each}
				</div>
			</div>

			<!-- Filter Sections -->
			<div class="text-base-content/70 mb-2 text-xs italic">
				Options with map icons have associated raster layers.
			</div>
			
			<!-- Pathogens Dropdown -->
			<FilterDropdown
				id="pathogen-select"
				label="Pathogens"
				placeholder="Select Pathogen"
				options={Array.from($pathogens || []).sort().map(pathogen => ({
					value: pathogen,
					label: pathogen,
					count: $pathogenCounts.get(pathogen) || 0,
					hasRasterLayer: pathogensWithRasterLayers.has(pathogen)
				}))}
				selectedValue={Array.from($selectedPathogens)[0] || ''}
				onSelect={(value) => {
					const newSet = new Set<string>();
					if (value) newSet.add(value);
					updatePathogenSelection(newSet);
				}}
			/>

			<!-- Age Groups Dropdown -->
			<FilterDropdown
				id="agegroup-select"
				label="Age Groups"
				placeholder="Select Age Group"
				options={Array.from($ageGroups || []).map(ageGroup => ({
					value: ageGroup,
					label: ageGroup,
					count: $ageGroupCounts.get(ageGroup) || 0,
					hasRasterLayer: hasRasterLayers('ageGroup', ageGroup as string)
				}))}
				selectedValue={Array.from($selectedAgeGroups)[0] || ''}
				onSelect={(value) => {
					const newSet = new Set<string>();
					if (value) newSet.add(value);
					updateAgeGroupSelection(newSet);
				}}
			/>

			<!-- Syndromes Dropdown -->
			<FilterDropdown
				id="syndrome-select"
				label="Syndromes"
				placeholder="Select Syndrome"
				options={Array.from($syndromes || []).map(syndrome => ({
					value: syndrome,
					label: syndrome,
					count: $syndromeCounts.get(syndrome) || 0,
					hasRasterLayer: hasRasterLayers('syndrome', syndrome as string)
				}))}
				selectedValue={Array.from($selectedSyndromes)[0] || ''}
				onSelect={(value) => {
					const newSet = new Set<string>();
					if (value) newSet.add(value);
					updateSyndromeSelection(newSet);
				}}
			/>

			<!-- Active Raster Layers Info -->
			{#if $autoVisibleRasterLayers.size > 0}
				<div
					class="border-secondary/30 from-secondary/10 to-primary/10 rounded-lg border bg-gradient-to-r p-4 shadow-sm"
				>
					<div class="mb-3 flex items-center justify-between">
						<h3 class="text-secondary-focus flex items-center text-base font-medium">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-secondary mr-1 h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
								/>
							</svg>
							Active Raster Layers ({$autoVisibleRasterLayers.size})
						</h3>
						<label class="label cursor-pointer gap-2 p-0">
							<input 
								type="checkbox" 
								class="checkbox checkbox-primary checkbox-sm"
								checked={rasterLayersVisible}
								on:change={toggleRasterLayerVisibility}
								title="Toggle raster layer visibility"
							/>
						</label>
					</div>
					<!-- <div class="mb-3 max-h-[150px] overflow-y-auto rounded-md bg-white/70 p-2">
						{#each Array.from($autoVisibleRasterLayers) as layerId}
							{#if $rasterLayers.has(layerId)}
								{@const layer = $rasterLayers.get(layerId)}
								{#if layer}
									<div
										class="hover:bg-primary/10 mb-2 flex flex-col rounded-md p-1 transition-colors"
									>
										<div class="flex items-center">
											<span class="badge badge-xs bg-primary mr-2 border-none"></span>
											<span class="text-secondary-focus text-sm">{layer.name}</span>
										</div>
									</div>
								{/if}
							{/if}
						{/each}
					</div> -->

					<div class="text-secondary/80 mt-4 text-xs italic">
						Raster layers are automatically shown based on your filter selections.
					</div>
				</div>
			{/if}
		</div>
		<!-- Closes tab content div -->
	{/if}
</div>

<!-- Settings Modal -->
{#if showSettingsModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="mb-4 text-lg font-bold">Visualization Settings</h3>

			<!-- Global Raster Opacity Control -->
			<div class="form-control mb-4 w-full">
				<label class="label">
					<span class="label-text font-medium">Global Raster Opacity</span>
					<span class="label-text-alt font-bold">{globalOpacity}%</span>
				</label>
				<div class="relative">
					<input
						type="range"
						min="0"
						max="100"
						bind:value={globalOpacity}
						on:input={() => {
							// Update opacity for all layers
							updateAllRasterLayersOpacity(globalOpacity / 100);
							
							// Update checkbox state
							rasterLayersVisible = globalOpacity > 0;

							// Save to localStorage
							saveSettingsToStorage({ globalOpacity });

							// Dispatch an event to notify parent component
							dispatch('opacitychange', { opacity: globalOpacity });
						}}
						class="range range-primary"
					/>
					<div class="mt-1 flex w-full justify-between px-2 text-xs">
						<span>0%</span>
						<span>100%</span>
					</div>
				</div>
				<div class="mt-2">
					<p class="text-base-content/70 text-sm">
						Controls the transparency of all raster layers on the map.
					</p>
					<p class="text-base-content/60 mt-1 text-xs">
						• 0% = Completely transparent (invisible)
						<br />
						• 100% = Completely opaque
						<br />
						• Applies to all active raster layers simultaneously
					</p>
				</div>
			</div>

			<!-- 3D Bar Settings (only show when 3D bars are selected) -->
			{#if $visualizationType === '3d-bars'}
				<div class="form-control mb-4 w-full">
					<label class="label">
						<span class="label-text font-medium">3D Bar Base Thickness</span>
						<span class="label-text-alt font-bold">{Math.round($barThickness * 100)}km</span>
					</label>
					<input
						type="range"
						min="0.05"
						max="0.5"
						step="0.01"
						bind:value={$barThickness}
						on:input={async () => {
							// Save to localStorage
							saveSettingsToStorage({ barThickness: $barThickness });

							// Trigger map update when thickness changes
							await handleMapContentChange();
						}}
						class="range range-primary"
					/>
					<div class="mt-1 flex w-full justify-between px-2 text-xs">
						<span>5km</span>
						<span>50km</span>
					</div>
					<div class="mt-2">
						<p class="text-base-content/70 text-sm">
							<strong>Base thickness</strong>
							- automatically scaled by sample size (like pie chart diameter)
						</p>
						<p class="text-base-content/60 mt-1 text-xs">
							• Larger studies get thicker bars (more reliable data)
							<br />
							• Height represents prevalence values
							<br />
							• Color indicates study design type
						</p>
					</div>
				</div>
			{/if}

			<div class="modal-action">
				<button class="btn btn-primary" on:click={() => (showSettingsModal = false)}>Done</button>
			</div>
		</div>
		<div class="modal-backdrop" on:click={() => (showSettingsModal = false)}></div>
	</div>
{/if}
