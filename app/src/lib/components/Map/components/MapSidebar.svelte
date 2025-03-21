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
		filteredPointsData
	} from '../store';

	// Sidebar configuration
	let collapsed = false;

	// Stats for selected filters
	$: visiblePoints = $filteredPointsData.features.length;
	$: totalPoints = $pathogens.size > 0 ? $filteredPointsData.features.length : 0;
	$: selectedPathogenCount = $selectedPathogens.size;
	$: selectedAgeGroupCount = $selectedAgeGroups.size;
	$: selectedSyndromeCount = $selectedSyndromes.size;
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
</script>

<div
	class="bg-base-100 flex max-h-[calc(100%-20px)] w-80 max-w-[90%] flex-col overflow-hidden rounded-lg shadow-md transition-all duration-300"
>
	<!-- Sidebar header with toggle button -->
	<div class="bg-base-100 border-base-200 z-10 border-b p-3">
		<div class="flex items-center justify-between">
			<h2 class="text-base-content m-0 text-lg font-medium">Data Explorer</h2>
			<button
				class="btn btn-sm btn-ghost btn-square"
				on:click={() => (collapsed = !collapsed)}
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
						<polyline points="15 18 9 12 15 6"></polyline>
					{/if}
				</svg>
			</button>
		</div>

		{#if !collapsed}
			{#if $isLoading}
				<div class="text-base-content/70 mt-2 flex items-center gap-2 text-sm">
					<span class="loading loading-spinner loading-xs"></span>
					<span>Loading data...</span>
				</div>
			{:else if $dataError}
				<div class="text-error mt-2 text-sm">Error: {$dataError}</div>
			{:else if totalPoints > 0}
				<div class="text-base-content/70 mt-2 text-sm">
					<div class="flex items-center justify-between">
						{visiblePoints} of {totalPoints} points
						{#if hasActiveFilters}
							<button class="btn btn-xs btn-ghost text-primary" on:click={clearAllFilters}>
								Clear filters
							</button>
						{/if}
					</div>
				</div>
			{/if}
		{/if}
	</div>

	{#if !collapsed}
		<!-- Filter sections -->
		<div class="flex-1 overflow-y-auto p-3 pt-0">
			<!-- Pathogens Filter -->
			<div class="form-control my-2 w-full">
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
					size={Math.min(5, $pathogens.size)}
					on:change={(e) => handleMultipleSelect(e, 'pathogens')}
				>
					{#each Array.from($pathogens).sort() as pathogen}
						<option value={pathogen} selected={$selectedPathogens.has(pathogen)}>
							{pathogen}
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

			<!-- Age Groups Filter -->
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
					size={Math.min(5, $ageGroups.size)}
					on:change={(e) => handleMultipleSelect(e, 'ageGroups')}
				>
					{#each Array.from($ageGroups).sort() as ageGroup}
						<option value={ageGroup} selected={$selectedAgeGroups.has(ageGroup)}>
							{ageGroup}
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

			<!-- Syndromes Filter -->
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
					size={Math.min(5, $syndromes.size)}
					on:change={(e) => handleMultipleSelect(e, 'syndromes')}
				>
					{#each Array.from($syndromes).sort() as syndrome}
						<option value={syndrome} selected={$selectedSyndromes.has(syndrome)}>
							{syndrome}
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

			<!-- Legend -->
			<div class="border-base-300 bg-base-200 mt-4 rounded-lg border p-3">
				<h3 class="text-base-content mb-2 text-sm font-medium">Pathogen Legend</h3>
				<div class="grid max-h-[150px] grid-cols-2 gap-2 overflow-y-auto pr-1">
					{#each Array.from($pathogenColors.entries()) as [pathogen, color]}
						<div
							class={`hover:bg-base-300 flex cursor-pointer items-center rounded p-1 transition-opacity ${
								$selectedPathogens.has(pathogen) || $selectedPathogens.size === 0
									? 'opacity-100'
									: 'opacity-50'
							}`}
							on:click={() => ($selectedPathogens = toggleSelection($selectedPathogens, pathogen))}
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
		</div>
	{/if}
</div>
