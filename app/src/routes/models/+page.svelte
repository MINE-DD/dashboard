<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import SearchModelsModal from '$lib/components/ui/models/SearchModelsModal.svelte';
	import { PUBLIC_ORGANIZATION_NAME } from '$env/static/public';

	const props = $props();
	const models = $derived(props.data.models);

	let modelUrl = $state('');
	let isSearchModalOpen = $state(false);
	let isImporting = $state(false);

	async function handleImport() {
		if (!modelUrl) return;

		isImporting = true;
		try {
			const response = await fetch('/api/models', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: modelUrl })
			});

			if (!response.ok) {
				throw new Error('Failed to import model');
			}

			// Refresh the page to show the new model
			window.location.reload();
		} catch (error) {
			console.error('Error importing model:', error);
			// TODO: Show error toast
		} finally {
			isImporting = false;
		}
	}

	const handleFindRepositories = () => {
		isSearchModalOpen = true;
	};

	const handleModelClick = (checkpointId: string) => {
		goto(`/models/${encodeURIComponent(checkpointId)}`);
	};

	const handleModalClose = () => {
		isSearchModalOpen = false;
	};
</script>

<div class="container mx-auto space-y-8 p-4">
	<!-- Header -->
	<div class="text-2xl font-bold">{PUBLIC_ORGANIZATION_NAME}</div>

	<!-- URL Input and Buttons -->
	<div class="flex items-center gap-4">
		<div class="form-control flex-1">
			<input
				type="text"
				placeholder="model url: // place your url here"
				class="input input-bordered w-full"
				bind:value={modelUrl}
			/>
		</div>
		<button class="btn btn-primary" on:click={handleImport}>Import model</button>
		<button class="btn btn-outline" on:click={handleFindRepositories}>Find repositories</button>
	</div>

	<!-- Models Section -->
	<div>
		<h2 class="mb-4 text-4xl font-bold">Models</h2>

		<div class="overflow-x-auto">
			<table class="table w-full">
				<!-- Headers -->
				<thead>
					<tr>
						<th>Model name</th>
						<th>Small description</th>
						<th class="text-center">
							Overall number
							<br />
							of validations
						</th>
						<th class="text-center">
							Date of last
							<br />
							validation
						</th>
						<th class="text-center">
							Status of last
							<br />
							validation
						</th>
					</tr>
				</thead>
				<!-- Body -->
				<tbody>
					{#each models as model}
						<tr class="hover cursor-pointer" on:click={() => handleModelClick(model.checkpoint_id)}>
							<td class="font-bold">{model.fair_model_id}</td>
							<td>{model.description}</td>
							<td class="text-center">{model.validations?.count ?? 0}</td>
							<td class="text-center">
								{#if model.validations?.latest}
									{new Date(model.validations.latest.date).toLocaleDateString()}
								{:else}
									-
								{/if}
							</td>
							<td class="text-center">
								{#if model.validations?.latest}
									<span
										class="badge {model.validations.latest.status === 'completed'
											? 'badge-success'
											: model.validations.latest.status === 'failed'
												? 'badge-error'
												: model.validations.latest.status === 'running'
													? 'badge-warning'
													: 'badge-ghost'}"
									>
										{model.validations.latest.status}
									</span>
								{:else}
									<span class="badge badge-ghost">No validations</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<SearchModelsModal open={isSearchModalOpen} onClose={handleModalClose} />
