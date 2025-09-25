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
		ageGroupValToLab,
		ageGroupLabToVal,
		syndromeValToLab,
		syndromeLabToVal,
		// Import new raster stores and functions
		rasterLayers,
		addRasterLayerFromUrl,
		updateRasterLayerVisibility,
		updateRasterLayerOpacity,
		updateAllRasterLayersOpacity,
		removeRasterLayer,
		fetchAndSetLayerBounds,
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
		syndromeCounts,
		// Import data update date
		dataUpdateDate
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
		handleMapContentChange,
		mapInstance
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

	// Import data points visibility store and functions
	import {
		dataPointsVisible as dataPointsVisibleStore,
		toggleDataPointsVisibility as toggleDataPoints,
		applyDataPointsVisibility
	} from '$lib/stores/dataPointsVisibility.store';

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
	let dataPointsVisible = true; // Track if data points are visible
	let showRasterDataOverlayLocal = false; // Debug overlay toggle (local state)

	let pathogensWithRasterLayers = new Set<string>();
	let showRiskFactors = false; // Toggle state for risk factors section

	// Risk factor layer names (matching the names in raster.store.ts)
	const riskFactorLayerNames = [
		'Floor Finished Pr',
		'Floor Finished SE',
		'Roofs Finished Pr',
		'Roofs Finished SE',
		'Walls Finished Pr',
		'Walls Finished SE'
	];

	// Helper function to check if a layer is a risk factor
	function isRiskFactorLayer(layerName: string): boolean {
		return riskFactorLayerNames.includes(layerName);
	}

	// Get visibility state of a risk factor layer
	function getRiskFactorVisibility(layerName: string): boolean {
		// Find the layer by name
		const layers = Array.from($rasterLayers.values());
		const layer = layers.find((l) => l.name === layerName);
		return layer?.isVisible || false;
	}

	// Toggle a specific risk factor layer
	async function toggleRiskFactorLayer(layerName: string) {
		// Find the layer by name
		const layers = Array.from($rasterLayers.entries());
		const layerEntry = layers.find(([_, layer]) => layer.name === layerName);

		if (layerEntry) {
			const [layerId, layer] = layerEntry;
			const newVisibility = !layer.isVisible;
			updateRasterLayerVisibility(layerId, newVisibility);

			// Fetch bounds if needed and layer is being made visible
			if (newVisibility && !layer.bounds) {
				await fetchAndSetLayerBounds(layerId);
			}
		}
	}

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

		// Strip ^^ prefix if present for comparison with raster mappings
		const cleanValue = value.startsWith('^^') ? value.substring(2) : value;

		return filterToRasterMappings.some((mapping: FilterToRasterMapping) => {
			if (type === 'ageGroup') return mapping.ageGroup === cleanValue;
			if (type === 'syndrome') return mapping.syndrome === cleanValue;
			return false;
		});
	}

	// Handle toggling raster layer visibility
	function toggleRasterLayerVisibility() {
		rasterLayersVisible = !rasterLayersVisible;
		const opacity = rasterLayersVisible ? globalOpacity / 100 : 0;
		updateAllRasterLayersOpacity(opacity);
	}

	// Handle toggling data points visibility
	function toggleDataPointsVisibility() {
		dataPointsVisible = !dataPointsVisible;
		dataPointsVisibleStore.set(dataPointsVisible);
		applyDataPointsVisibility($mapInstance, dataPointsVisible);

		// Save to localStorage
		saveSettingsToStorage({ dataPointsVisible });
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

	// Format date for display
	function formatDataDate(dateString: string | null): string {
		if (!dateString) return '';

		const [year, month, day] = dateString.split('-');
		const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

		// Format as "Month DD, YYYY"
		const options: Intl.DateTimeFormatOptions = {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		};
		return date.toLocaleDateString('en-US', options);
	}

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

		// Load data points visibility setting
		dataPointsVisible = storedSettings.dataPointsVisible;
		dataPointsVisibleStore.set(dataPointsVisible);
		// Apply to map immediately
		applyDataPointsVisibility($mapInstance, dataPointsVisible);

		// Update barThickness store with stored value
		barThickness.set(storedSettings.barThickness);

		// Initialize debug overlay toggle from stored setting
		showRasterDataOverlayLocal = storedSettings.showRasterDataOverlay;
		// Inform parent on initial mount so Map can reflect persisted state
		dispatch('overlaytoggle', { visible: showRasterDataOverlayLocal });
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
			<div class="flex flex-col">
				<h2 class="text-base-content text-md m-0 font-semibold">Data Explorer</h2>
				{#if $dataUpdateDate}
					<span class="text-base-content/60 mt-0.5 text-xs">
						Data updated: {formatDataDate($dataUpdateDate)}
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-1">
				<!-- Settings button -->
				<button
					class="btn btn-sm btn-ghost btn-square"
					title="Visualization Settings"
					onclick={() => (showSettingsModal = true)}
				>
					<MaterialSymbolsSettingsOutlineRounded />
				</button>
				<!-- Collapse button -->
				<button
					class="btn btn-sm btn-ghost btn-square"
					title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					onclick={() => (collapsed = !collapsed)}
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
							<button class="btn btn-sm" onclick={clearAllFilters}>Clear Filters</button>
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
						onchange={handleVisualizationTypeChange}
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
				options={Array.from($pathogens || [])
					.sort()
					.map((pathogen) => ({
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
				options={Array.from($ageGroups || []).map((ageGroupVal) => ({
					value: ageGroupVal, // VAL for filtering
					label: $ageGroupValToLab.get(ageGroupVal) || ageGroupVal, // LAB for display
					count: $ageGroupCounts.get(ageGroupVal) || 0,
					hasRasterLayer: hasRasterLayers(
						'ageGroup',
						$ageGroupValToLab.get(ageGroupVal)?.replace('^^', '') || ageGroupVal
					)
				}))}
				selectedValue={Array.from($selectedAgeGroups)[0] || ''}
				onSelect={(value) => {
					const newSet = new Set<string>();
					if (value) newSet.add(value); // value is already VAL
					updateAgeGroupSelection(newSet);
				}}
			/>

			<!-- Syndromes Dropdown -->
			<FilterDropdown
				id="syndrome-select"
				label="Syndromes"
				placeholder="Select Syndrome"
				options={Array.from($syndromes || []).map((syndromeVal) => ({
					value: syndromeVal, // VAL for filtering
					label: $syndromeValToLab.get(syndromeVal) || syndromeVal, // LAB for display
					count: $syndromeCounts.get(syndromeVal) || 0,
					hasRasterLayer: hasRasterLayers(
						'syndrome',
						$syndromeValToLab.get(syndromeVal)?.replace('^^', '') || syndromeVal
					)
				}))}
				selectedValue={Array.from($selectedSyndromes)[0] || ''}
				onSelect={(value) => {
					const newSet = new Set<string>();
					if (value) newSet.add(value); // value is already VAL
					updateSyndromeSelection(newSet);
				}}
			/>

			<!-- Risk Factors Section -->
			<div class="border-warning/30 bg-warning/10 mt-4 rounded-lg border p-3">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="text-base-content flex items-center text-base font-medium">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="text-warning mr-1 h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
							/>
						</svg>
						Risk factors / Interventions
					</h3>
					<button
						class="btn btn-ghost btn-xs"
						onclick={() => (showRiskFactors = !showRiskFactors)}
						title="Toggle risk factors"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 transition-transform"
							class:rotate-180={!showRiskFactors}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>
				</div>

				{#if showRiskFactors}
					<div class="space-y-3 pt-2">
						<!-- Floor Risk Factors -->
						<div class="bg-base-100/50 rounded p-2">
							<h4 class="mb-2 text-sm font-semibold">Floor Finish</h4>
							<div class="space-y-1">
								<label
									class="hover:bg-base-200/50 flex cursor-pointer items-center gap-2 rounded px-1 text-sm"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-warning checkbox-xs"
										checked={getRiskFactorVisibility('Floor Finished Pr')}
										onchange={() => toggleRiskFactorLayer('Floor Finished Pr')}
									/>
									<span>Prevalence</span>
								</label>
								<label
									class="hover:bg-base-200/50 flex cursor-pointer items-center gap-2 rounded px-1 text-sm"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-warning checkbox-xs"
										checked={getRiskFactorVisibility('Floor Finished SE')}
										onchange={() => toggleRiskFactorLayer('Floor Finished SE')}
									/>
									<span>Standard Error</span>
								</label>
							</div>
						</div>

						<!-- Roofs Risk Factors -->
						<div class="bg-base-100/50 rounded p-2">
							<h4 class="mb-2 text-sm font-semibold">Roof Finish</h4>
							<div class="space-y-1">
								<label
									class="hover:bg-base-200/50 flex cursor-pointer items-center gap-2 rounded px-1 text-sm"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-warning checkbox-xs"
										checked={getRiskFactorVisibility('Roofs Finished Pr')}
										onchange={() => toggleRiskFactorLayer('Roofs Finished Pr')}
									/>
									<span>Prevalence</span>
								</label>
								<label
									class="hover:bg-base-200/50 flex cursor-pointer items-center gap-2 rounded px-1 text-sm"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-warning checkbox-xs"
										checked={getRiskFactorVisibility('Roofs Finished SE')}
										onchange={() => toggleRiskFactorLayer('Roofs Finished SE')}
									/>
									<span>Standard Error</span>
								</label>
							</div>
						</div>

						<!-- Walls Risk Factors -->
						<div class="bg-base-100/50 rounded p-2">
							<h4 class="mb-2 text-sm font-semibold">Wall Finish</h4>
							<div class="space-y-1">
								<label
									class="hover:bg-base-200/50 flex cursor-pointer items-center gap-2 rounded px-1 text-sm"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-warning checkbox-xs"
										checked={getRiskFactorVisibility('Walls Finished Pr')}
										onchange={() => toggleRiskFactorLayer('Walls Finished Pr')}
									/>
									<span>Prevalence</span>
								</label>
								<label
									class="hover:bg-base-200/50 flex cursor-pointer items-center gap-2 rounded px-1 text-sm"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-warning checkbox-xs"
										checked={getRiskFactorVisibility('Walls Finished SE')}
										onchange={() => toggleRiskFactorLayer('Walls Finished SE')}
									/>
									<span>Standard Error</span>
								</label>
							</div>
						</div>
					</div>

					<div class="text-base-content/60 mt-3 text-xs italic">
						Housing material quality indicators affecting disease transmission
					</div>
				{/if}
			</div>

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
								onchange={toggleRasterLayerVisibility}
								title="Toggle raster layer visibility"
							/>
						</label>
					</div>

					<!-- Data Points visibility toggle -->
					<div class="mt-3 flex items-center justify-between">
						<h3 class="text-secondary-focus flex items-center text-base font-medium">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-secondary mr-1 h-5 w-5"
								fill="currentColor"
								viewBox="0 0 24 24"
							>
								<circle cx="5" cy="12" r="2" />
								<circle cx="12" cy="5" r="2" />
								<circle cx="19" cy="12" r="2" />
								<circle cx="12" cy="19" r="2" />
								<circle cx="12" cy="12" r="2" />
							</svg>
							Data Points
						</h3>
						<label class="label cursor-pointer gap-2 p-0">
							<input
								type="checkbox"
								class="checkbox checkbox-primary checkbox-sm"
								checked={dataPointsVisible}
								onchange={toggleDataPointsVisibility}
								title="Toggle data points visibility"
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

			<!-- Raster Debug Overlay -->
			<div class="form-control mb-4 w-full">
				<label class="label cursor-pointer">
					<span class="label-text font-medium">Show raster data pixels (debug)</span>
					<input
						type="checkbox"
						class="toggle"
						bind:checked={showRasterDataOverlayLocal}
						onchange={() => {
							saveSettingsToStorage({ showRasterDataOverlay: showRasterDataOverlayLocal });
							dispatch('overlaytoggle', { visible: showRasterDataOverlayLocal });
						}}
					/>
				</label>
				<p class="text-base-content/60 mt-1 text-xs">
					Renders small red dots over each pixel with data to verify alignment.
				</p>
			</div>

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
						oninput={() => {
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
						oninput={async () => {
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
				<button class="btn btn-primary" onclick={() => (showSettingsModal = false)}>Done</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showSettingsModal = false)}></div>
	</div>
{/if}
