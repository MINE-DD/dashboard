<script lang="ts">
	// Props
	export let visible = true;
	export let position = 'bottom-right'; // Options: 'bottom-right', 'bottom-left', 'top-right', 'top-left'

	// Define the color mappings for the legend
	const positiveNegativeColors = [
		{ label: 'Positive', color: '#808080' }, // Dark gray
		{ label: 'Negative', color: '#D3D3D3' } // Light gray
	];

	const designColors = [
		{ label: 'Surveillance', color: '#FFE5B4' }, // Pastel Orange (matches map dot)
		{ label: 'Intervention Trial', color: '#B7EFC5' }, // Pastel Green (matches map dot)
		{ label: 'Case control', color: '#FFB3C6' }, // Pastel Red (matches map dot)
		{ label: 'Cohort', color: '#9197FF' } // Pastel Blue (matches map dot)
	];

	// Calculate position classes
	let positionClasses = '';
	$: {
		switch (position) {
			case 'bottom-right':
				positionClasses = 'bottom-4 right-4';
				break;
			case 'bottom-left':
				positionClasses = 'bottom-4 left-4';
				break;
			case 'top-right':
				positionClasses = 'top-4 right-4';
				break;
			case 'top-left':
				positionClasses = 'top-4 left-4';
				break;
			default:
				positionClasses = 'bottom-4 right-4';
		}
	}
</script>

{#if visible}
	<div
		class={`absolute z-10 ${positionClasses} rounded-lg border border-white/30 bg-gradient-to-r from-white/80 to-white/70 p-3 shadow-lg backdrop-blur-md backdrop-filter`}
	>
		<!-- Positive/Negative section -->
		<div class="mb-3">
			{#each positiveNegativeColors as item}
				<div class="mb-1 flex items-center">
					<div class="mr-2 h-4 w-4 rounded-sm" style="background-color: {item.color};"></div>
					<span class="text-base-content text-sm">{item.label}</span>
				</div>
			{/each}
		</div>

		<!-- Design types section -->
		<div>
			{#each designColors as item}
				<div class="mb-1 flex items-center">
					<div class="mr-2 h-4 w-4 rounded-sm" style="background-color: {item.color};"></div>
					<span class="text-base-content text-sm">{item.label}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
