<script lang="ts">
	import MaterialSymbolsSearch from '~icons/material-symbols/search';
	import MaterialSymbolsClose from '~icons/material-symbols/close';
	import MaterialSymbolsDocumentScannerOutline from '~icons/material-symbols/document-scanner-outline';
	import { searchModels } from '$lib/stores/models/index.svelte';
	import type { Model } from '$lib/stores/models/index.svelte';

	const props = $props();

	let searchQuery = $state('');
	let searchResults = $state<Model[]>([]);
	let isSearching = $state(false);

	$effect(() => {
		if (!searchQuery) {
			searchResults = [];
			return;
		}

		const debounce = setTimeout(async () => {
			isSearching = true;
			try {
				searchResults = await searchModels(searchQuery);
			} catch (error) {
				console.error('Error searching models:', error);
				searchResults = [];
			} finally {
				isSearching = false;
			}
		}, 300);

		return () => clearTimeout(debounce);
	});

	const handleUseModel = (model: Model) => {
		window.location.href = `/models/${encodeURIComponent(model.checkpoint_id)}`;
		props.onClose?.();
	};
</script>

<dialog class="modal" class:modal-open={props.open}>
	<div class="modal-box max-w-6xl">
		<!-- Top bar -->
		<div class="mb-6 flex items-center justify-between">
			<h3 class="text-2xl font-bold">Available models</h3>
			<button class="btn btn-ghost btn-sm" on:click={props.onClose}>
				<MaterialSymbolsClose class="h-5 w-5" />
			</button>
		</div>

		<div class="grid grid-cols-[1fr_auto] gap-6">
			<div>
				<!-- Search input -->
				<div class="form-control mb-6">
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2">
							<MaterialSymbolsSearch class="text-base-content/70 h-5 w-5" />
						</span>
						<input
							type="text"
							placeholder="Search"
							class="input input-bordered w-full pl-10"
							bind:value={searchQuery}
						/>
					</div>
				</div>

				<!-- Models list -->
				<div class="mb-6 space-y-4">
					{#if isSearching}
						<div class="flex justify-center py-8">
							<span class="loading loading-spinner loading-lg"></span>
						</div>
					{:else if searchResults.length === 0 && searchQuery}
						<div class="text-base-content/70 py-8 text-center">
							No models found matching "{searchQuery}"
						</div>
					{:else if searchResults.length > 0}
						{#each searchResults as model}
							<div class="bg-base-200 flex items-center justify-between rounded-lg p-4">
								<div>
									<h4 class="font-semibold">{model.fair_model_id}</h4>
									<p class="text-base-content/70">{model.description}</p>
									{#if model.metadata.applicabilityCriteria}
										<div class="mt-2 flex flex-wrap gap-2">
											{#each model.metadata.applicabilityCriteria as criteria}
												<span class="badge badge-sm badge-outline">{criteria}</span>
											{/each}
										</div>
									{/if}
								</div>
								<button class="btn btn-primary gap-2" on:click={() => handleUseModel(model)}>
									View model
								</button>
							</div>
						{/each}
					{:else}
						<div class="text-base-content/70 py-8 text-center">Type to search for models</div>
					{/if}
				</div>
			</div>

			<!-- Learn how to containerize -->
			<div class="btn btn-outline text-left">
				<MaterialSymbolsDocumentScannerOutline class="mr-2 h-8 w-8" />
				Learn how to
				<br />
				containerize a model
			</div>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button on:click={props.onClose}>close</button>
	</form>
</dialog>
