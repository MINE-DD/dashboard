<script lang="ts">
	import { visualizationType, type VisualizationType } from '../store';

	// No need for selectedType prop since we're using the store directly

	const visualizationOptions = [
		{
			value: 'lite-dots' as VisualizationType,
			label: 'Lite Dots',
			description: 'Simple small colored dots'
		},
		{
			value: 'dots' as VisualizationType,
			label: 'Standard Dots',
			description: 'Standard colored circles'
		},
		{
			value: 'pie-charts' as VisualizationType,
			label: 'Pie Charts',
			description: 'Pie charts showing prevalence data'
		}
	];

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newType = target.value as VisualizationType;
		visualizationType.set(newType);
	}
</script>

<div class="visualization-selector">
	<label for="visualization-type" class="label">
		<span class="label-text">Visualization Type</span>
	</label>
	<select 
		id="visualization-type"
		bind:value={$visualizationType}
		on:change={handleChange}
		class="select"
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
			<p class="description">{option.description}</p>
		{/if}
	{/each}
</div>

<style>
	.visualization-selector {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 200px;
	}

	.label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.label-text {
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
	}

	.select {
		padding: 0.5rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background-color: white;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease-in-out;
	}

	.select:hover {
		border-color: #9ca3af;
	}

	.select:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.description {
		font-size: 0.75rem;
		color: #6b7280;
		margin: 0;
		font-style: italic;
	}
</style>
