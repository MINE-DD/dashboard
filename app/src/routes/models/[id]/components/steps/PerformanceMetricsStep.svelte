<script lang="ts">
	interface Props {
		performanceMetrics?: string;
		readonly?: boolean;
		onFieldChange?: () => void;
	}

	let {
		performanceMetrics = $bindable(''),
		readonly = false,
		onFieldChange = () => {}
	}: Props = $props();

	// Store initial value to track actual changes
	let initialValue = $state(performanceMetrics || '');

	// Track actual value changes
	$effect(() => {
		if (!readonly && onFieldChange) {
			const hasChanges = performanceMetrics !== initialValue;
			if (hasChanges) {
				onFieldChange();
			}
		}
	});

	// Reset initial value when prop changes
	$effect(() => {
		initialValue = performanceMetrics || '';
	});
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-lg font-medium">Model performance metrics</h3>
		<textarea
			class="textarea textarea-bordered h-96 w-full"
			placeholder="Free text or structure"
			bind:value={performanceMetrics}
			{readonly}
			oninput={onFieldChange}
		></textarea>
	</div>
</div>
