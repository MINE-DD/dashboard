<script lang="ts">
	interface Props {
		metricsDescription?: string;
		readonly?: boolean;
		onFieldChange?: () => void;
	}

	let {
		metricsDescription = $bindable(''),
		readonly = false,
		onFieldChange = () => {}
	}: Props = $props();

	// Store initial value to track actual changes
	let initialValue = $state(metricsDescription || '');

	// Track actual value changes
	$effect(() => {
		if (!readonly && onFieldChange) {
			const hasChanges = metricsDescription !== initialValue;
			if (hasChanges) {
				onFieldChange();
			}
		}
	});

	// Reset initial value when prop changes
	$effect(() => {
		initialValue = metricsDescription || '';
	});
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-lg font-medium">Validation metrics</h3>
		<textarea
			class="textarea textarea-bordered h-96 w-full"
			placeholder="Free text or structure"
			bind:value={metricsDescription}
			{readonly}
			oninput={onFieldChange}
		></textarea>
	</div>
</div>
