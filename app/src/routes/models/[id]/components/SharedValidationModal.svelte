<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import DatasetStep from './steps/DatasetStep.svelte';
	import DatasetCharacteristicsStep from './steps/DatasetCharacteristicsStep.svelte';
	import MetricsForValidationStep from './steps/MetricsForValidationStep.svelte';
	import PerformanceMetricsStep from './steps/PerformanceMetricsStep.svelte';
	interface ValidationJob {
		val_id: string;
		start_datetime: string;
		validation_status: 'pending' | 'running' | 'completed' | 'failed';
		validation_result: {
			dataProvided?: boolean;
			dataCharacteristics?: boolean;
			metrics?: boolean;
			published?: boolean;
		};
		userName?: string;
		datasetDescription?: string;
		metricsDescription?: string;
		performanceMetrics?: string;
	}

	const dispatch = createEventDispatcher<{
		close: void;
		validationChange: void;
	}>();

	interface Props {
		open?: boolean;
		validation?: ValidationJob;
		mode?: 'create' | 'view' | 'edit';
		modelId?: string;
	}

	let {
		open = $bindable(false),
		validation = undefined,
		mode = $bindable('create'),
		modelId
	}: Props = $props();

	let currentStep = $state(0);
	let hasChanges = $state(false);
	let initialFormData = $state({
		userName: '',
		date: '',
		uploadedFile: null as File | null,
		datasetDescription: '',
		metricsDescription: '',
		performanceMetrics: ''
	});
	const steps = $state([
		{ title: 'Dataset', active: true },
		{ title: 'Dataset Characteristics', active: false },
		{ title: 'Metrics for validation', active: false },
		{ title: 'Performance metrics', active: false }
	]);

	// Track actual changes by comparing with initial values
	$effect(() => {
		if (mode !== 'view') {
			const currentFormData = {
				userName,
				date,
				uploadedFile,
				datasetDescription,
				metricsDescription,
				performanceMetrics
			};

			const hasChanged = Object.entries(currentFormData).some(([key, value]) => {
				return value !== initialFormData[key as keyof typeof initialFormData];
			});

			if (hasChanged !== hasChanges) {
				hasChanges = hasChanged;
			}
		}
	});

	// Form data
	let userName = $state(validation?.userName || '');
	let date = $state(validation?.start_datetime || '');
	let uploadedFile: File | null = $state(null);
	let datasetDescription = $state(validation?.datasetDescription || '');
	let metricsDescription = $state(validation?.metricsDescription || '');
	let performanceMetrics = $state(validation?.performanceMetrics || '');

	function goToStep(stepIndex: number) {
		if (stepIndex >= 0 && stepIndex < steps.length) {
			steps[currentStep].active = false;
			currentStep = stepIndex;
			steps[currentStep].active = true;
		}
	}

	function nextStep() {
		if (currentStep < steps.length - 1) {
			steps[currentStep].active = false;
			currentStep++;
			steps[currentStep].active = true;
		}
	}

	function prevStep() {
		if (currentStep > 0) {
			steps[currentStep].active = false;
			currentStep--;
			steps[currentStep].active = true;
		}
	}

	async function closeModal() {
		if (hasChanges) {
			const confirmed = confirm('You have unsaved changes. Do you want to save before closing?');
			if (confirmed) {
				await handleSave();
			}
		}
		open = false;
		dispatch('close');
	}

	async function handleSubmit() {
		// Only allow submit in create/edit modes
		if (mode === 'view') return;

		// Save any pending changes first
		if (hasChanges) {
			await handleSave();
		}

		console.log('Submitting validation with modelId:', modelId);

		const formData = {
			userName,
			date,
			uploadedFile,
			datasetDescription,
			metricsDescription,
			performanceMetrics,
			modelId
		};

		try {
			if (mode === 'create') {
				const response = await fetch('/api/validations', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(formData)
				});
				const result = await response.json();
				console.log('Validation creation response:', result);

				if (!result.success) {
					throw new Error(result.error || 'Failed to create validation');
				}

				dispatch('validationChange');
				closeModal();
			} else if (mode === 'edit' && validation) {
				const response = await fetch(`/api/validations/${validation.val_id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(formData)
				});
				const result = await response.json();
				console.log('Validation update response:', result);

				if (!result.success) {
					throw new Error(result.error || 'Failed to update validation');
				}

				hasChanges = false;
				dispatch('validationChange');
				closeModal();
			}
		} catch (error) {
			console.error('Error submitting validation:', error);
			// TODO: Show error toast
		}
	}

	async function handleSave() {
		const formData = {
			userName,
			date,
			uploadedFile,
			datasetDescription,
			metricsDescription,
			performanceMetrics,
			modelId
		};

		try {
			if (validation?.val_id) {
				await fetch(`/api/validations/${validation.val_id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(formData)
				});
			} else {
				await fetch('/api/validations', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(formData)
				});
			}
			hasChanges = false;
			dispatch('validationChange');
		} catch (error) {
			console.error('Error saving validation:', error);
			// TODO: Show error toast
		}
	}

	async function handleResubmit() {
		if (!validation?.val_id) return;

		const confirmed = confirm('Are you sure you want to resubmit this validation?');
		if (!confirmed) return;

		// Save any pending changes first
		if (hasChanges) {
			await handleSave();
		}

		try {
			await fetch(`/api/validations/${validation.val_id}/resubmit`, {
				method: 'POST'
			});
			dispatch('validationChange');
			closeModal();
		} catch (error) {
			console.error('Error resubmitting validation:', error);
			// TODO: Show error toast
		}
	}

	function trackChanges() {
		if (mode !== 'view') {
			hasChanges = true;
		}
	}

	function handleKeydown(e: KeyboardEvent, index: number) {
		if (e.key === 'Enter') {
			goToStep(index);
		}
	}

	// Update form data when validation changes
	$effect(() => {
		if (validation) {
			userName = validation.userName || '';
			date = validation.start_datetime;
			datasetDescription = validation.datasetDescription || '';
			metricsDescription = validation.metricsDescription || '';
			performanceMetrics = validation.performanceMetrics || '';

			// Store initial values
			initialFormData = {
				userName: userName,
				date: date,
				uploadedFile: null,
				datasetDescription: datasetDescription,
				metricsDescription: metricsDescription,
				performanceMetrics: performanceMetrics
			};
		} else {
			// Reset form for new validation
			userName = '';
			date = '';
			uploadedFile = null;
			datasetDescription = '';
			metricsDescription = '';
			performanceMetrics = '';

			// Reset initial values
			initialFormData = {
				userName: '',
				date: '',
				uploadedFile: null,
				datasetDescription: '',
				metricsDescription: '',
				performanceMetrics: ''
			};
		}
		hasChanges = false;
	});

	$effect(() => {
		if (mode === 'view') {
			// Reset step to first when opening in view mode
			currentStep = 0;
			steps.forEach((step, i) => {
				step.active = i === 0;
			});
		}
	});
</script>

<dialog
	id="shared_validation_modal"
	class="modal modal-bottom sm:modal-middle z-[10000] !mt-0 h-full w-full"
	class:modal-open={open}
>
	<div class="modal-box bg-base-100 h-[90vh] max-h-none w-full !max-w-full p-8">
		<!-- Stepper -->
		<ul class="steps mb-8 w-full">
			{#each steps as step, i}
				<li
					class="step transition-all {step.active || i < currentStep
						? 'step-primary'
						: ''}  cursor-pointer"
					onclick={() => goToStep(i)}
					onkeydown={(e) => handleKeydown(e, i)}
					role="button"
					tabindex="0"
				>
					{step.title}
				</li>
			{/each}
		</ul>

		<!-- Content -->
		<div class="h-[calc(100%-12rem)] w-full overflow-y-auto">
			{#if currentStep === 0}
				<DatasetStep
					bind:userName
					bind:date
					bind:uploadedFile
					readonly={mode === 'view'}
					onFieldChange={trackChanges}
				/>
			{:else if currentStep === 1}
				<DatasetCharacteristicsStep
					bind:datasetDescription
					readonly={mode === 'view'}
					onFieldChange={trackChanges}
				/>
			{:else if currentStep === 2}
				<MetricsForValidationStep
					bind:metricsDescription
					readonly={mode === 'view'}
					onFieldChange={trackChanges}
				/>
			{:else if currentStep === 3}
				<PerformanceMetricsStep
					bind:performanceMetrics
					readonly={mode === 'view'}
					onFieldChange={trackChanges}
				/>
			{/if}
		</div>

		<!-- Navigation -->
		<div class="modal-action mt-8">
			<!-- Save Changes Button -->
			{#if mode !== 'view' && hasChanges}
				<button class="btn btn-outline" onclick={handleSave}>Save Changes</button>
			{/if}

			<!-- Edit Button -->
			{#if mode === 'view'}
				<button class="btn btn-outline" onclick={() => (mode = 'edit')}>Edit</button>
			{/if}

			<!-- Resubmit Button -->
			{#if validation && mode !== 'create'}
				<button class="btn btn-primary" onclick={handleResubmit}>Resubmit Validation</button>
			{/if}

			<!-- Close Button -->
			<button class="btn" onclick={closeModal}>Close</button>

			<!-- Standard Navigation -->
			<div class="flex-1"></div>
			{#if currentStep > 0}
				<button class="btn btn-outline" onclick={prevStep}>Previous</button>
			{/if}
			{#if currentStep < steps.length - 1}
				<button class="btn btn-primary" onclick={nextStep}>Next</button>
			{:else if mode !== 'view'}
				<button class="btn btn-primary" onclick={handleSubmit}>Submit</button>
			{/if}
		</div>
	</div>

	<div class="modal-backdrop" onclick={closeModal}>
		<button>close</button>
	</div>
</dialog>
