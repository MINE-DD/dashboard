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
		// filteredPointsData, // Assuming this is derived elsewhere or not needed here directly
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

	// Stats for selected filters (Assuming filteredPointsData is available or derived elsewhere)
	// $: visiblePoints = $filteredPointsData?.features?.length || 0; // Add null checks if needed
	// $: totalPoints = $pathogens?.size > 0 ? $filteredPointsData?.features?.length || 0 : 0; // Add null checks if needed
	$: selectedPathogenCount = $selectedPathogens?.size || 0; // Add null checks
	$: selectedAgeGroupCount = $selectedAgeGroups?.size || 0; // Add null checks
	$: selectedSyndromeCount = $selectedSyndromes?.size || 0; // Add null checks
	$: hasActiveFilters =
		selectedPathogenCount > 0 || selectedAgeGroupCount > 0 || selectedSyndromeCount > 0;

	// Helper function to toggle a value in a Set
	function toggleSelection(set: Set<string>, value: string): Set<string> {
		const newSet = new Set(set);
		if (newSet.has(value)) {
			newSet.delete(value);
		} else {
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

	// Handle multiple select change
	function handleMultipleSelect(event: Event, category: 'pathogens' | 'ageGroups' | 'syndromes') {
		const select = event.target as HTMLSelectElement;
		const selectedOptions = Array.from(select.selectedOptions).map((option) => option.value);

		if (category === 'pathogens') {
			$selectedPathogens = new Set(selectedOptions);
		} else if (category === 'ageGroups') {
			$selectedAgeGroups = new Set(selectedOptions);
		} else if (category === 'syndromes') {
			$selectedSyndromes = new Set(selectedOptions);
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
						<!-- {visiblePoints} of {totalPoints} points -->
						<!-- Commented out if stats aren't needed -->
						Points Loaded
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
			<div class="form-control my-2 w-full">
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
				<select
					class="select select-bordered select-sm w-full"
					multiple
					size={Math.min(5, $pathogens?.size || 1)}
					on:change={(e) => handleMultipleSelect(e, 'pathogens')}
				>
					{#each Array.from($pathogens || []).sort() as pathogen}
						<option value={pathogen} selected={$selectedPathogens?.has(pathogen)}>
							{hasRasterLayers('pathogen', pathogen) ? `${pathogen} *` : pathogen}
						</option>
					{/each}
				</select>
				<div class="mt-1 flex justify-between">
					<button class="btn btn-xs btn-ghost" on:click={() => toggleAll('pathogens', true)}>
						Select All
					</button>
					<button class="btn btn-xs btn-ghost" on:click={() => toggleAll('pathogens', false)}>
						Clear
					</button>
				</div>
			</div>

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
					class="select select-bordered select-sm w-full"
					multiple
					size={Math.min(5, $ageGroups?.size || 1)}
					on:change={(e) => handleMultipleSelect(e, 'ageGroups')}
				>
					{#each Array.from($ageGroups || []).sort() as ageGroup}
						<option value={ageGroup} selected={$selectedAgeGroups?.has(ageGroup)}>
							{hasRasterLayers('ageGroup', ageGroup) ? `${ageGroup} *` : ageGroup}
						</option>
					{/each}
				</select>
				<div class="mt-1 flex justify-between">
					<button class="btn btn-xs btn-ghost" on:click={() => toggleAll('ageGroups', true)}>
						Select All
					</button>
					<button class="btn btn-xs btn-ghost" on:click={() => toggleAll('ageGroups', false)}>
						Clear
					</button>
				</div>
			</div>

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
					class="select select-bordered select-sm w-full"
					multiple
					size={Math.min(5, $syndromes?.size || 1)}
					on:change={(e) => handleMultipleSelect(e, 'syndromes')}
				>
					{#each Array.from($syndromes || []).sort() as syndrome}
						<option value={syndrome} selected={$selectedSyndromes?.has(syndrome)}>
							{hasRasterLayers('syndrome', syndrome) ? `${syndrome} *` : syndrome}
						</option>
					{/each}
				</select>
				<div class="mt-1 flex justify-between">
					<button class="btn btn-xs btn-ghost" on:click={() => toggleAll('syndromes', true)}>
						Select All
					</button>
					<button class="btn btn-xs btn-ghost" on:click={() => toggleAll('syndromes', false)}>
						Clear
					</button>
				</div>
			</div>

			<div class="border-base-300 bg-base-200 mt-4 rounded-lg border p-3">
				<h3 class="text-base-content mb-2 text-sm font-medium">Pathogen Legend</h3>
				<div class="grid max-h-[150px] grid-cols-2 gap-2 pr-1">
					{#each Array.from($pathogenColors?.entries() || []) as [pathogen, color]}
						<div
							class={`hover:bg-base-300 flex cursor-pointer items-center rounded p-1 transition-opacity ${
								$selectedPathogens?.has(pathogen) || ($selectedPathogens?.size || 0) === 0
									? 'opacity-100'
									: 'opacity-50'
							}`}
							on:click={() => {
								$selectedPathogens = toggleSelection($selectedPathogens, pathogen);
								clearFilterCache(); // Clear cache to update filtered data
							}}
						>
							<span
								class="border-base-300 mr-2 inline-block h-3 w-3 rounded-full border"
								style="background-color: {color}"
							></span>
							<span class="truncate text-xs">{pathogen}</span>
						</div>
					{/each}
				</div>
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
