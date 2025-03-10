<script lang="ts">
	interface Props {
		datasetDescription?: string;
		readonly?: boolean;
		onFieldChange?: () => void;
	}

	let {
		datasetDescription = $bindable(''),
		readonly = false,
		onFieldChange = () => {}
	}: Props = $props();

	// Store initial value to track actual changes
	let initialValue = $state(datasetDescription || '');

	// Track actual value changes
	$effect(() => {
		if (!readonly && onFieldChange) {
			const hasChanges = datasetDescription !== initialValue;
			if (hasChanges) {
				onFieldChange();
			}
		}
	});

	// Reset initial value when prop changes
	$effect(() => {
		initialValue = datasetDescription || '';
	});
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-lg font-medium">Dataset characteristics</h3>
		<textarea
			class="textarea textarea-bordered h-96 w-full"
			placeholder="Free text or structure"
			bind:value={datasetDescription}
			{readonly}
			oninput={onFieldChange}
		></textarea>
	</div>
</div>
