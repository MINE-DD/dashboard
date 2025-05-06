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
		autoVisibleRasterLayers
	} from '../store';
	import { writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';

	// Import the filter-to-raster mappings to check which options have raster layers
	import { filterToRasterMappings } from '../store/filterRasterMapping';
	import type { FilterToRasterMapping } from '../store/types';

	// Helper functions to check if an option has associated raster layers
	function hasRasterLayers(type: 'pathogen' | 'ageGroup' | 'syndrome', value: string): boolean {
		return filterToRasterMappings.some((mapping: FilterToRasterMapping) => {
			if (type === 'pathogen') return mapping.pathogen === value;
			if (type === 'ageGroup') return mapping.ageGroup === value;
			if (type === 'syndrome') return mapping.syndrome === value;
			return false;
		});
	}

	// Initialize the filter-to-raster connection
	let filterRasterUnsubscribe: () => void;

	// --- Raster Layer State ---
	let cogUrlInput = '';
	let isAddingLayer = false;
	let globalOpacity = 80; // Default global opacity (0-100)

	async function handleAddLayerClick() {
		if (!cogUrlInput || isAddingLayer) return;

		// Basic URL validation (more robust validation could be added)
		try {
			new URL(cogUrlInput);
		} catch (_) {
			// Use toast store if available, otherwise console log
			console.error('Invalid URL format');
			// import { toastStore } from '$lib/stores/toast.store'; // Import if needed
			// toastStore.error('Invalid URL format');
			return;
		}

		isAddingLayer = true;
		await addRasterLayerFromUrl(cogUrlInput);
		isAddingLayer = false;
		cogUrlInput = ''; // Clear input on success/attempt
	}

	// Sidebar configuration
	let collapsed = false;

	// Stats for selected filters
	$: visiblePoints = $filteredPointsData?.features?.length || 0;
	$: totalPoints = $pointsData?.features?.length || 0;
	$: selectedPathogenCount = $selectedPathogens?.size || 0; // Add null checks
	$: selectedAgeGroupCount = $selectedAgeGroups?.size || 0; // Add null checks
	$: selectedSyndromeCount = $selectedSyndromes?.size || 0; // Add null checks
	$: hasActiveFilters =
		selectedPathogenCount > 0 || selectedAgeGroupCount > 0 || selectedSyndromeCount > 0;

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
	}

	// Clear all active filters
	function clearAllFilters() {
		$selectedPathogens = new Set();
		$selectedAgeGroups = new Set();
		$selectedSyndromes = new Set();
		clearFilterCache();
	}

	// Handle select change
	function handleSelectChange(event: Event, category: 'ageGroups' | 'syndromes') {
		const select = event.target as HTMLSelectElement;
		const selectedValue = select.value;

		if (category === 'ageGroups') {
			const newSet = new Set<string>();
			if (selectedValue) newSet.add(selectedValue);
			$selectedAgeGroups = newSet;
		} else if (category === 'syndromes') {
			const newSet = new Set<string>();
			if (selectedValue) newSet.add(selectedValue);
			$selectedSyndromes = newSet;
		}

		clearFilterCache();
	}

	// Initialize on mount
	onMount(() => {
		// Initialize the filter-to-raster connection
		filterRasterUnsubscribe = initFilterRasterConnection();
	});

	// Clean up subscription when component is destroyed
	onDestroy(() => {
		if (filterRasterUnsubscribe) {
			filterRasterUnsubscribe();
		}
	});
</script>

<div
	class=" shadow-xs grid max-h-[calc(100%-20px)] overflow-clip rounded-lg border border-white/20 bg-white/70 backdrop-blur-md backdrop-filter transition-all duration-300"
>
	<!-- Sidebar header with toggle button -->
	<div class="z-10 border-b p-3">
		<button
			class="flex w-full items-center justify-between"
			on:click={() => (collapsed = !collapsed)}
		>
			<h2 class="text-base-content m-0 text-lg font-medium">Data Explorer</h2>
			<span
				class="btn btn-sm btn-ghost btn-square"
				title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
			</span>
		</button>

		{#if !collapsed}
			{#if $isLoading}
				<div class="text-base-content/70 mt-2 flex items-center gap-2 text-sm">
					<span class="loading loading-spinner loading-xs"></span>
					<span>Loading data...</span>
				</div>
			{:else if $dataError}
				<div class="text-error mt-2 text-sm">Error: {$dataError}</div>
			{:else if $pathogens?.size > 0}
				<!-- Simplified condition, adjust if needed -->
				<div class="text-base-content/70 mt-2 text-sm">
					<div class="flex items-center justify-between">
						{visiblePoints} of {totalPoints} points
						{#if hasActiveFilters}
							<button class="btn btn-xs btn-ghost text-primary" on:click={clearAllFilters}>
								Clear Filters
							</button>
						{/if}
					</div>
				</div>
			{/if}
		{/if}
	</div>

	{#if !collapsed}
		<!-- Content -->
		<div class="flex h-full max-h-[calc(100vh-250px)] w-80 flex-col overflow-y-scroll p-3 pt-2">
			<!-- Filter Sections -->
			<div class="form-control card my-2 w-full">
				<div class="text-base-content/70 mb-2 text-xs">
					Options marked with <span class="text-primary">*</span>
					have associated raster layers.
				</div>
				<label class="label">
					<span class="label-text flex items-center font-medium">
						Pathogens
						{#if selectedPathogenCount > 0}
							<span class="badge badge-primary badge-sm ml-2">{selectedPathogenCount}</span>
						{/if}
					</span>
				</label>

				<!-- Pathogen Options -->
				<div class="outline-base-200 grid grid-cols-2 gap-2 overflow-y-auto rounded-xl p-1 outline">
					{#each Array.from($pathogens || []).sort() as pathogen}
						<div
							class={`hover:bg-base-300 flex cursor-pointer items-center rounded p-1 transition-opacity ${
								$selectedPathogens?.has(pathogen)
									? 'bg-base-200 font-medium opacity-100'
									: 'opacity-80'
							}`}
							on:click={() => {
								$selectedPathogens = toggleSelection($selectedPathogens, pathogen);
								clearFilterCache(); // Clear cache to update filtered data
							}}
						>
							<span
								class="border-base-300 mr-2 inline-block h-3 w-3 rounded-full border"
								style="background-color: {$pathogenColors?.get(pathogen) || '#ccc'}"
							></span>
							<span class="truncate text-xs">
								{hasRasterLayers('pathogen', pathogen) ? `${pathogen} *` : pathogen}
							</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Age Groups -->
			<div class="form-control my-2 w-full">
				<label class="label">
					<span class="label-text flex items-center font-medium">
						Age Groups
						{#if selectedAgeGroupCount > 0}
							<span class="badge badge-primary badge-sm ml-2">{selectedAgeGroupCount}</span>
						{/if}
					</span>
				</label>
				<select
					class="select select-bordered w-full"
					on:change={(e) => handleSelectChange(e, 'ageGroups')}
				>
					<option value="" selected={$selectedAgeGroups.size === 0}>Select Age Group</option>
					{#each Array.from($ageGroups || []).sort() as ageGroup}
						<option value={ageGroup} selected={$selectedAgeGroups?.has(ageGroup)}>
							{hasRasterLayers('ageGroup', ageGroup) ? `${ageGroup} *` : ageGroup}
						</option>
					{/each}
				</select>
			</div>

			<!-- Syndromes -->
			<div class="form-control my-2 w-full">
				<label class="label">
					<span class="label-text flex items-center font-medium">
						Syndromes
						{#if selectedSyndromeCount > 0}
							<span class="badge badge-primary badge-sm ml-2">{selectedSyndromeCount}</span>
						{/if}
					</span>
				</label>
				<select
					class="select select-bordered w-full"
					on:change={(e) => handleSelectChange(e, 'syndromes')}
				>
					<option value="" selected={$selectedSyndromes.size === 0}>Select Syndrome</option>
					{#each Array.from($syndromes || []).sort() as syndrome}
						<option value={syndrome} selected={$selectedSyndromes?.has(syndrome)}>
							{hasRasterLayers('syndrome', syndrome) ? `${syndrome} *` : syndrome}
						</option>
					{/each}
				</select>
			</div>

			<!-- Active Raster Layers Info -->
			{#if $autoVisibleRasterLayers.size > 0}
				<div class="border-base-300 bg-base-200 mt-4 rounded-lg border p-3">
					<h3 class="text-base-content mb-2 text-sm font-medium">
						Active Raster Layers ({$autoVisibleRasterLayers.size})
					</h3>
					<div class="max-h-[150px] overflow-y-auto">
						{#each Array.from($autoVisibleRasterLayers) as layerId}
							{#if $rasterLayers.has(layerId)}
								{@const layer = $rasterLayers.get(layerId)}
								{#if layer}
									<div class="mb-2 flex items-center">
										<span class="badge badge-primary badge-xs mr-2"></span>
										<span class="text-xs">{layer.name}</span>
									</div>
								{/if}
							{/if}
						{/each}
					</div>

					<!-- Global Opacity Control -->
					<div class="form-control mt-3">
						<label class="label py-1">
							<span class="label-text text-xs font-medium">Global Opacity</span>
							<span class="label-text-alt text-xs">{globalOpacity}%</span>
						</label>
						<input
							type="range"
							min="0"
							max="100"
							bind:value={globalOpacity}
							on:input={() => updateAllRasterLayersOpacity(globalOpacity / 100)}
							class="range range-primary range-xs"
						/>
					</div>

					<div class="text-base-content/70 mt-2 text-xs">
						Raster layers are automatically shown based on your filter selections.
					</div>
				</div>
			{/if}
		</div>
		<!-- Closes tab content div -->
	{/if}
</div>
