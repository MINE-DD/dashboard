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
		removeRasterLayer
	} from '../store';
	import { writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// --- Raster Layer State ---
	let cogUrlInput = '';
	let isAddingLayer = false;

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
	let activeTab: 'filters' | 'raster' = 'filters'; // Default value

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
		console.log(`Toggled all ${category} to ${checked ? 'selected' : 'unselected'}`);
		console.group('Filter Debug Information');
		console.log('Selected Pathogens:', Array.from($selectedPathogens));
		console.log('Selected Age Groups:', Array.from($selectedAgeGroups));
		console.log('Selected Syndromes:', Array.from($selectedSyndromes));
		console.groupEnd();
	}

	// Clear all active filters
	function clearAllFilters() {
		$selectedPathogens = new Set();
		$selectedAgeGroups = new Set();
		$selectedSyndromes = new Set();
		clearFilterCache();
		console.log('All filters cleared');
		console.group('Filter Debug Information');
		console.log('Selected Pathogens:', Array.from($selectedPathogens));
		console.log('Selected Age Groups:', Array.from($selectedAgeGroups));
		console.log('Selected Syndromes:', Array.from($selectedSyndromes));
		console.groupEnd();
	}

	// Search filters
	let pathogenSearch = '';
	let ageGroupSearch = '';
	let syndromeSearch = '';

	// Filtered options based on search
	$: filteredPathogens = Array.from($pathogens || [])
		.filter((p) => p.toLowerCase().includes(pathogenSearch.toLowerCase()))
		.sort();

	$: filteredAgeGroups = Array.from($ageGroups || [])
		.filter((a) => a.toLowerCase().includes(ageGroupSearch.toLowerCase()))
		.sort();

	$: filteredSyndromes = Array.from($syndromes || [])
		.filter((s) => s.toLowerCase().includes(syndromeSearch.toLowerCase()))
		.sort();

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
		console.log(`Updated ${category} filters:`, selectedOptions);
		console.group('Filter Debug Information');
		console.log('Selected Pathogens:', Array.from($selectedPathogens));
		console.log('Selected Age Groups:', Array.from($selectedAgeGroups));
		console.log('Selected Syndromes:', Array.from($selectedSyndromes));
		console.groupEnd();
	}

	// Toggle a single filter value
	function toggleFilter(category: 'pathogens' | 'ageGroups' | 'syndromes', value: string) {
		if (category === 'pathogens') {
			$selectedPathogens = toggleSelection($selectedPathogens, value);
		} else if (category === 'ageGroups') {
			$selectedAgeGroups = toggleSelection($selectedAgeGroups, value);
		} else if (category === 'syndromes') {
			$selectedSyndromes = toggleSelection($selectedSyndromes, value);
		}
		clearFilterCache();
		console.log(`Toggled ${category} filter:`, value);
		console.group('Filter Debug Information');
		console.log('Selected Pathogens:', Array.from($selectedPathogens));
		console.log('Selected Age Groups:', Array.from($selectedAgeGroups));
		console.log('Selected Syndromes:', Array.from($selectedSyndromes));
		console.groupEnd();
	}

	// Function to update the active tab and URL
	function setActiveTab(tabName: 'filters' | 'raster') {
		if (activeTab === tabName) return; // Avoid unnecessary updates

		activeTab = tabName;
		const url = new URL($page.url);
		url.searchParams.set('tab', tabName);
		goto(url.search, { keepFocus: true, replaceState: true, noScroll: true });
	}

	// Read initial tab from URL on mount
	onMount(() => {
		const tabParam = $page.url.searchParams.get('tab');
		if (tabParam === 'filters' || tabParam === 'raster') {
			activeTab = tabParam;
		} else {
			// Optional: If the param is invalid, update URL to reflect the default
			const url = new URL($page.url);
			if (tabParam) {
				// Only update if there was an invalid param
				url.searchParams.set('tab', activeTab);
				goto(url.search, { keepFocus: true, replaceState: true, noScroll: true });
			}
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
		<!-- Tab Navigation -->
		<div role="tablist" class="tabs tabs-bordered px-3 pt-2">
			<a
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'filters'}
				on:click|preventDefault={() => setActiveTab('filters')}
			>
				Filters
			</a>
			<a
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'raster'}
				on:click|preventDefault={() => setActiveTab('raster')}
			>
				Raster Layers
			</a>
		</div>

		<!-- Tab Content -->
		<div class="flex h-full max-h-[calc(100vh-250px)] w-80 flex-col overflow-y-scroll p-3 pt-2">
			{#if activeTab === 'filters'}
				<!-- Existing Filter Sections -->
				<!-- Filter Stats Summary -->
				{#if hasActiveFilters}
					<div class="stats-summary bg-base-200 mb-3 rounded-lg p-2 text-xs">
						<div class="mb-2 flex items-center justify-between">
							<span class="font-medium">Active Filters</span>
							<button class="btn btn-xs btn-error btn-outline" on:click={clearAllFilters}>
								Clear All
							</button>
						</div>
						{#if selectedPathogenCount > 0}
							<div class="stat-item">
								<span class="stat-label">Pathogens:</span>
								<span class="stat-value">{selectedPathogenCount}</span>
							</div>
						{/if}
						{#if selectedAgeGroupCount > 0}
							<div class="stat-item">
								<span class="stat-label">Age Groups:</span>
								<span class="stat-value">{selectedAgeGroupCount}</span>
							</div>
						{/if}
						{#if selectedSyndromeCount > 0}
							<div class="stat-item">
								<span class="stat-label">Syndromes:</span>
								<span class="stat-value">{selectedSyndromeCount}</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Pathogens Filter -->
				<div class="filter-section my-3">
					<div class="filter-header mb-2 flex items-center justify-between">
						<label class="label p-0">
							<span class="label-text flex items-center font-medium">
								Pathogens
								{#if selectedPathogenCount > 0}
									<span class="badge badge-primary badge-sm ml-2">{selectedPathogenCount}</span>
								{/if}
							</span>
						</label>
						<div class="filter-actions flex gap-1">
							<button
								class="btn btn-xs btn-outline"
								class:btn-primary={selectedPathogenCount === 0}
								on:click={() => toggleAll('pathogens', true)}
							>
								All
							</button>
							<button
								class="btn btn-xs btn-outline"
								class:btn-primary={selectedPathogenCount > 0}
								on:click={() => toggleAll('pathogens', false)}
							>
								None
							</button>
						</div>
					</div>

					<!-- Search input -->
					<div class="filter-search mb-2">
						<input
							type="text"
							placeholder="Search pathogens..."
							class="input input-bordered input-sm w-full"
							bind:value={pathogenSearch}
						/>
					</div>

					<!-- Filter options -->
					<div class="filter-options">
						<select
							class="select select-bordered select-sm w-full"
							multiple
							size={Math.min(8, filteredPathogens.length || 1)}
							on:change={(e) => handleMultipleSelect(e, 'pathogens')}
						>
							{#each filteredPathogens as pathogen}
								<option value={pathogen} selected={$selectedPathogens?.has(pathogen)} class="py-1">
									{pathogen}
								</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Age Groups Filter -->
				<div class="filter-section my-3">
					<div class="filter-header mb-2 flex items-center justify-between">
						<label class="label p-0">
							<span class="label-text flex items-center font-medium">
								Age Groups
								{#if selectedAgeGroupCount > 0}
									<span class="badge badge-primary badge-sm ml-2">{selectedAgeGroupCount}</span>
								{/if}
							</span>
						</label>
						<div class="filter-actions flex gap-1">
							<button
								class="btn btn-xs btn-outline"
								class:btn-primary={selectedAgeGroupCount === 0}
								on:click={() => toggleAll('ageGroups', true)}
							>
								All
							</button>
							<button
								class="btn btn-xs btn-outline"
								class:btn-primary={selectedAgeGroupCount > 0}
								on:click={() => toggleAll('ageGroups', false)}
							>
								None
							</button>
						</div>
					</div>

					<!-- Search input -->
					<div class="filter-search mb-2">
						<input
							type="text"
							placeholder="Search age groups..."
							class="input input-bordered input-sm w-full"
							bind:value={ageGroupSearch}
						/>
					</div>

					<!-- Filter options -->
					<div class="filter-options">
						<select
							class="select select-bordered select-sm w-full"
							multiple
							size={Math.min(8, filteredAgeGroups.length || 1)}
							on:change={(e) => handleMultipleSelect(e, 'ageGroups')}
						>
							{#each filteredAgeGroups as ageGroup}
								<option value={ageGroup} selected={$selectedAgeGroups?.has(ageGroup)} class="py-1">
									{ageGroup}
								</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Syndromes Filter -->
				<div class="filter-section my-3">
					<div class="filter-header mb-2 flex items-center justify-between">
						<label class="label p-0">
							<span class="label-text flex items-center font-medium">
								Syndromes
								{#if selectedSyndromeCount > 0}
									<span class="badge badge-primary badge-sm ml-2">{selectedSyndromeCount}</span>
								{/if}
							</span>
						</label>
						<div class="filter-actions flex gap-1">
							<button
								class="btn btn-xs btn-outline"
								class:btn-primary={selectedSyndromeCount === 0}
								on:click={() => toggleAll('syndromes', true)}
							>
								All
							</button>
							<button
								class="btn btn-xs btn-outline"
								class:btn-primary={selectedSyndromeCount > 0}
								on:click={() => toggleAll('syndromes', false)}
							>
								None
							</button>
						</div>
					</div>

					<!-- Search input -->
					<div class="filter-search mb-2">
						<input
							type="text"
							placeholder="Search syndromes..."
							class="input input-bordered input-sm w-full"
							bind:value={syndromeSearch}
						/>
					</div>

					<!-- Filter options -->
					<div class="filter-options">
						<select
							class="select select-bordered select-sm w-full"
							multiple
							size={Math.min(8, filteredSyndromes.length || 1)}
							on:change={(e) => handleMultipleSelect(e, 'syndromes')}
						>
							{#each filteredSyndromes as syndrome}
								<option value={syndrome} selected={$selectedSyndromes?.has(syndrome)} class="py-1">
									{syndrome}
								</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Pathogen Legend with Search -->
				<div class="border-base-300 bg-base-200 mt-4 rounded-lg border p-3">
					<div class="mb-2 flex items-center justify-between">
						<h3 class="text-base-content text-sm font-medium">Pathogen Legend</h3>
						<div class="flex items-center">
							<input
								type="text"
								placeholder="Search..."
								class="input input-bordered input-xs mr-1 w-24"
								bind:value={pathogenSearch}
							/>
						</div>
					</div>

					<div class="grid max-h-[200px] grid-cols-2 gap-2 overflow-y-auto pr-1">
						{#each filteredPathogens as pathogen}
							{#if $pathogenColors.has(pathogen)}
								<div
									class={`hover:bg-base-300 flex cursor-pointer items-center rounded p-1 transition-opacity ${
										$selectedPathogens?.has(pathogen) || ($selectedPathogens?.size || 0) === 0
											? 'opacity-100'
											: 'opacity-50'
									}`}
									on:click={() => toggleFilter('pathogens', pathogen)}
								>
									<span
										class="border-base-300 mr-2 inline-block h-3 w-3 rounded-full border"
										style="background-color: {$pathogenColors.get(pathogen)}"
									></span>
									<span class="truncate text-xs">{pathogen}</span>
								</div>
							{/if}
						{/each}
					</div>
				</div>
				<!-- Shigella prevalence legend removed for brevity, assuming it's not directly related -->
			{:else if activeTab === 'raster'}
				<!-- Add Layer Section -->
				<div class="form-control mb-4">
					<label class="label">
						<span class="label-text font-medium">Add COG Layer from URL</span>
					</label>
					<div class="join w-full">
						<input
							type="url"
							placeholder="https://..."
							class="input join-item input-bordered input-sm w-full flex-grow"
							bind:value={cogUrlInput}
							disabled={isAddingLayer}
							on:keydown={(e) => e.key === 'Enter' && handleAddLayerClick()}
						/>
						<button
							class="btn join-item btn-primary btn-sm"
							on:click={handleAddLayerClick}
							disabled={isAddingLayer || !cogUrlInput}
						>
							{#if isAddingLayer}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								Add
							{/if}
						</button>
					</div>
				</div>

				<!-- Test Button -->
				<!-- 	<div class="my-2 text-center">
					<button
						class="btn btn-xs btn-outline btn-warning"
						on:click={() =>
							addRasterLayerFromUrl(
								'https://s2downloads.eox.at/demo/EOxCloudless/2020/rgbnir/s2cloudless2020-16bits_sinlge-file_z0-4.tif'
							)}
						disabled={isAddingLayer}
					>
						Test EOX URL
					</button>
				</div> -->

				<!-- Divider -->
				{#if $rasterLayers.size > 0}
					<div class="divider my-1 text-xs">Active Layers</div>
				{/if}

				<!-- Active Layers List -->
				<div class="grid flex-col gap-3">
					{#each Array.from($rasterLayers.entries()) as [id, layer] (id)}
						<div class="border-base-300 bg-base-100 rounded-lg border p-2">
							<div class="mb-1 flex items-center justify-between">
								<!-- <div class="tooltip tooltip-right z-50" data-tip={layer.sourceUrl}>soure</div> -->
								<span class="truncate text-sm font-medium" title={layer.name}>
									{#if layer.isLoading}
										<span class="loading loading-spinner loading-xs mr-1"></span>
									{/if}
									{layer.name}
								</span>
								{#if id !== 'example-cog-tci'}
									<!-- Allow removing non-example layers -->
									<button
										class="btn btn-ghost btn-xs text-error"
										title="Remove Layer"
										on:click={() => removeRasterLayer(id)}
									>
										✕
									</button>
								{/if}
							</div>

							{#if layer.error}
								<p class="text-error mb-2 text-xs">Error: {layer.error}</p>
							{/if}

							<div class="form-control">
								<label class="label cursor-pointer py-1">
									<span class="label-text text-xs">Visible</span>
									<input
										type="checkbox"
										class="toggle toggle-primary toggle-xs"
										checked={layer.isVisible}
										on:change={() => updateRasterLayerVisibility(id, !layer.isVisible)}
										disabled={layer.isLoading || !!layer.error}
									/>
								</label>
							</div>

							<div class="form-control" class:opacity-50={!layer.isVisible}>
								<label class="label py-1">
									<span class="label-text text-xs">Opacity</span>
									<span class="label-text-alt text-xs">{(layer.opacity * 100).toFixed(0)}%</span>
								</label>
								<input
									type="range"
									min="0"
									max="100"
									value={layer.opacity * 100}
									on:input={(e) =>
										updateRasterLayerOpacity(id, parseFloat(e.currentTarget.value) / 100)}
									class="range range-primary range-xs"
									disabled={!layer.isVisible || layer.isLoading || !!layer.error}
								/>
							</div>
						</div>
					{/each}
				</div>
			{/if}
			<!-- Closes #if activeTab -->
		</div>
		<!-- Closes tab content div -->
	{/if}
</div>
