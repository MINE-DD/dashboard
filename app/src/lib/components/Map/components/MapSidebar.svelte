<script lang="ts">
	import { slide } from 'svelte/transition';
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
	} from '../MapStore';

	// Sidebar configuration
	let collapsed = false;
	let activeAccordion: 'pathogens' | 'age-groups' | 'syndromes' | null = 'pathogens';

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

	// Helper to toggle accordion sections
	function toggleAccordion(section: 'pathogens' | 'age-groups' | 'syndromes') {
		activeAccordion = activeAccordion === section ? null : section;
	}

	// Clear all active filters
	function clearAllFilters() {
		$selectedPathogens = new Set();
		$selectedAgeGroups = new Set();
		$selectedSyndromes = new Set();
		clearFilterCache();
	}
</script>

<div class="map-sidebar {collapsed ? 'collapsed' : ''}">
	<!-- Sidebar header with toggle button -->
	<div class="sidebar-header">
		<div class="header-content">
			<h2>Data Explorer</h2>
			<button
				class="toggle-button"
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
				<div class="loading-indicator">
					<div class="spinner"></div>
					<span>Loading data...</span>
				</div>
			{:else if $dataError}
				<div class="error-message">Error: {$dataError}</div>
			{:else if totalPoints > 0}
				<div class="data-summary">
					<div class="point-count">
						{visiblePoints} of {totalPoints} points
						{#if hasActiveFilters}
							<button class="clear-filters-button" on:click={clearAllFilters}>Clear filters</button>
						{/if}
					</div>
				</div>
			{/if}
		{/if}
	</div>

	{#if !collapsed}
		<!-- Filter sections -->
		<div class="filter-content">
			<!-- Pathogens Filter -->
			<div class="filter-section">
				<div
					class="section-header {activeAccordion === 'pathogens' ? 'active' : ''}"
					on:click={() => toggleAccordion('pathogens')}
				>
					<h3>
						Pathogens
						{#if selectedPathogenCount > 0}
							<span class="filter-badge">{selectedPathogenCount}</span>
						{/if}
					</h3>
					<span class="accordion-icon">
						{activeAccordion === 'pathogens' ? '−' : '+'}
					</span>
				</div>

				{#if activeAccordion === 'pathogens'}
					<div class="filter-body" transition:slide={{ duration: 200 }}>
						<div class="select-all-row">
							<label class="select-all-label">
								<input
									type="checkbox"
									checked={selectedPathogenCount === $pathogens.size && $pathogens.size > 0}
									indeterminate={selectedPathogenCount > 0 &&
										selectedPathogenCount < $pathogens.size}
									on:change={(e) => toggleAll('pathogens', e.currentTarget.checked)}
								/>
								<span>Select All</span>
							</label>
						</div>

						<div class="filter-items">
							{#each Array.from($pathogens).sort() as pathogen}
								<div class="filter-item">
									<label class="checkbox-label">
										<input
											type="checkbox"
											checked={$selectedPathogens.has(pathogen)}
											on:change={() =>
												($selectedPathogens = toggleSelection($selectedPathogens, pathogen))}
										/>
										<span
											class="color-marker"
											style="background-color: {$pathogenColors.get(pathogen) || '#000000'}"
										></span>
										<span class="label-text">{pathogen}</span>
									</label>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Age Groups Filter -->
			<div class="filter-section">
				<div
					class="section-header {activeAccordion === 'age-groups' ? 'active' : ''}"
					on:click={() => toggleAccordion('age-groups')}
				>
					<h3>
						Age Groups
						{#if selectedAgeGroupCount > 0}
							<span class="filter-badge">{selectedAgeGroupCount}</span>
						{/if}
					</h3>
					<span class="accordion-icon">
						{activeAccordion === 'age-groups' ? '−' : '+'}
					</span>
				</div>

				{#if activeAccordion === 'age-groups'}
					<div class="filter-body" transition:slide={{ duration: 200 }}>
						<div class="select-all-row">
							<label class="select-all-label">
								<input
									type="checkbox"
									checked={selectedAgeGroupCount === $ageGroups.size && $ageGroups.size > 0}
									indeterminate={selectedAgeGroupCount > 0 &&
										selectedAgeGroupCount < $ageGroups.size}
									on:change={(e) => toggleAll('ageGroups', e.currentTarget.checked)}
								/>
								<span>Select All</span>
							</label>
						</div>

						<div class="filter-items">
							{#each Array.from($ageGroups).sort() as ageGroup}
								<div class="filter-item">
									<label class="checkbox-label">
										<input
											type="checkbox"
											checked={$selectedAgeGroups.has(ageGroup)}
											on:change={() =>
												($selectedAgeGroups = toggleSelection($selectedAgeGroups, ageGroup))}
										/>
										<span class="label-text">{ageGroup}</span>
									</label>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Syndromes Filter -->
			<div class="filter-section">
				<div
					class="section-header {activeAccordion === 'syndromes' ? 'active' : ''}"
					on:click={() => toggleAccordion('syndromes')}
				>
					<h3>
						Syndromes
						{#if selectedSyndromeCount > 0}
							<span class="filter-badge">{selectedSyndromeCount}</span>
						{/if}
					</h3>
					<span class="accordion-icon">
						{activeAccordion === 'syndromes' ? '−' : '+'}
					</span>
				</div>

				{#if activeAccordion === 'syndromes'}
					<div class="filter-body" transition:slide={{ duration: 200 }}>
						<div class="select-all-row">
							<label class="select-all-label">
								<input
									type="checkbox"
									checked={selectedSyndromeCount === $syndromes.size && $syndromes.size > 0}
									indeterminate={selectedSyndromeCount > 0 &&
										selectedSyndromeCount < $syndromes.size}
									on:change={(e) => toggleAll('syndromes', e.currentTarget.checked)}
								/>
								<span>Select All</span>
							</label>
						</div>

						<div class="filter-items">
							{#each Array.from($syndromes).sort() as syndrome}
								<div class="filter-item">
									<label class="checkbox-label">
										<input
											type="checkbox"
											checked={$selectedSyndromes.has(syndrome)}
											on:change={() =>
												($selectedSyndromes = toggleSelection($selectedSyndromes, syndrome))}
										/>
										<span class="label-text">{syndrome}</span>
									</label>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Legend -->
			<div class="legend">
				<h3>Pathogen Legend</h3>
				<div class="legend-items">
					{#each Array.from($pathogenColors.entries()) as [pathogen, color]}
						<div
							class="legend-item {$selectedPathogens.has(pathogen) || $selectedPathogens.size === 0
								? ''
								: 'faded'}"
							on:click={() => ($selectedPathogens = toggleSelection($selectedPathogens, pathogen))}
						>
							<span class="color-marker" style="background-color: {color}"></span>
							<span class="legend-text">{pathogen}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.map-sidebar {
		position: absolute;
		top: 10px;
		right: 10px; /* Moved to right side */
		width: 320px;
		max-width: 90%;
		max-height: calc(100% - 20px);
		background-color: white;
		border-radius: 8px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		z-index: 10;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		transition:
			width 0.3s ease,
			transform 0.3s ease;
	}

	.map-sidebar.collapsed {
		width: auto;
		min-width: 0;
	}

	.sidebar-header {
		padding: 12px 15px;
		background-color: white;
		border-bottom: 1px solid #eee;
		z-index: 2;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.toggle-button {
		background: none;
		border: none;
		cursor: pointer;
		color: #666;
		padding: 5px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.toggle-button:hover {
		color: #333;
	}

	.filter-content {
		flex: 1;
		overflow-y: auto;
		padding: 0 15px 15px 15px;
	}

	h2 {
		margin: 0;
		font-size: 1.2rem;
		color: #333;
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		color: #555;
		display: flex;
		align-items: center;
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		font-size: 0.9rem;
		color: #666;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(0, 0, 0, 0.1);
		border-left-color: #333;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.error-message {
		margin-top: 8px;
		color: #e53935;
		font-size: 0.9rem;
	}

	.data-summary {
		margin-top: 8px;
		font-size: 0.9rem;
		color: #555;
	}

	.point-count {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.clear-filters-button {
		background: none;
		border: none;
		color: #0066cc;
		cursor: pointer;
		font-size: 0.8rem;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.clear-filters-button:hover {
		background-color: #f0f4f8;
		text-decoration: underline;
	}

	.filter-section {
		margin-bottom: 5px;
		overflow: hidden;
		background-color: #fff;
		border-radius: 6px;
		border: 1px solid #eee;
	}

	.section-header {
		padding: 12px;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		user-select: none;
	}

	.section-header:hover {
		background-color: #f9f9f9;
	}

	.section-header.active {
		background-color: #f3f4f6;
	}

	.filter-badge {
		background-color: #6888c0;
		color: white;
		border-radius: 10px;
		padding: 2px 8px;
		font-size: 0.75rem;
		margin-left: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.accordion-icon {
		font-size: 1.2rem;
		font-weight: bold;
		color: #999;
	}

	.filter-body {
		padding: 0 12px 12px 12px;
	}

	.select-all-row {
		padding: 5px 0;
		margin-bottom: 8px;
		border-bottom: 1px solid #f0f0f0;
	}

	.select-all-label {
		display: flex;
		align-items: center;
		font-size: 0.85rem;
		font-weight: 500;
		color: #555;
		cursor: pointer;
	}

	.select-all-label input {
		margin-right: 8px;
	}

	.filter-items {
		max-height: 200px;
		overflow-y: auto;
		padding-right: 5px;
	}

	.filter-item {
		margin-bottom: 6px;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		cursor: pointer;
	}

	.checkbox-label input {
		margin-right: 8px;
	}

	.label-text {
		font-size: 0.9rem;
		color: #444;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.color-marker {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		margin-right: 8px;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.legend {
		margin-top: 15px;
		padding: 12px;
		border: 1px solid #eee;
		border-radius: 6px;
		background-color: #f9f9f9;
	}

	.legend h3 {
		margin-bottom: 10px;
		font-size: 0.95rem;
	}

	.legend-items {
		max-height: 150px;
		overflow-y: auto;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 8px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		padding: 4px;
		border-radius: 4px;
		cursor: pointer;
		transition: opacity 0.2s ease;
	}

	.legend-item:hover {
		background-color: #f0f0f0;
	}

	.legend-item.faded {
		opacity: 0.5;
	}

	.legend-text {
		font-size: 0.85rem;
		color: #333;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Scrollbar styling */
	.filter-items::-webkit-scrollbar,
	.legend-items::-webkit-scrollbar {
		width: 6px;
	}

	.filter-items::-webkit-scrollbar-thumb,
	.legend-items::-webkit-scrollbar-thumb {
		background-color: #ccc;
		border-radius: 3px;
	}

	.filter-items::-webkit-scrollbar-track,
	.legend-items::-webkit-scrollbar-track {
		background-color: #f5f5f5;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	/* Media query for mobile devices */
	@media (max-width: 768px) {
		.map-sidebar {
			width: 280px;
		}

		.legend-items {
			grid-template-columns: 1fr;
		}
	}
</style>
