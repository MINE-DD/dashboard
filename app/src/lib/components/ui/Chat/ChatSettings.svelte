<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import MaterialSymbolsSettings from '~icons/material-symbols/settings';
	import MaterialSymbolsClose from '~icons/material-symbols/close';
	import MaterialSymbolsKey from '~icons/material-symbols/key';
	import MaterialSymbolsDataset from '~icons/material-symbols/dataset';
	import MaterialSymbolsVisibility from '~icons/material-symbols/visibility';
	import MaterialSymbolsVisibilityOff from '~icons/material-symbols/visibility-off';
	import MaterialSymbolsInfo from '~icons/material-symbols/info';
	import { chatSettings, geminiApiKey } from '$lib/stores/chatSettings.store';
	import { browser } from '$app/environment';

	const dispatch = createEventDispatcher();

	let apiKey = $state('');
	let showApiKey = $state(false);
	let useGemini = $state(false);
	let includeFilteredData = $state(false);
	let isSaving = $state(false);

	// Load current settings
	$effect(() => {
		if (browser) {
			const unsub = geminiApiKey.subscribe(key => {
				apiKey = key;
			});
			
			const unsub2 = chatSettings.subscribe(settings => {
				useGemini = settings.useGemini;
				includeFilteredData = settings.includeFilteredData;
			});

			return () => {
				unsub();
				unsub2();
			};
		}
	});

	function handleSave() {
		isSaving = true;
		
		// Save API key
		geminiApiKey.setKey(apiKey);
		
		// Save settings
		chatSettings.updateSettings({
			useGemini: !!apiKey && useGemini,
			includeFilteredData
		});

		setTimeout(() => {
			isSaving = false;
			dispatch('close');
		}, 300);
	}

	function handleCancel() {
		dispatch('close');
	}

	function toggleApiKeyVisibility() {
		showApiKey = !showApiKey;
	}

	function clearApiKey() {
		apiKey = '';
		useGemini = false;
		geminiApiKey.clearKey();
		chatSettings.updateSettings({
			useGemini: false
		});
	}
</script>

<!-- Modal backdrop -->
<div
	class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity"
	on:click={handleCancel}
	role="button"
	tabindex="0"
	on:keydown={(e) => e.key === 'Escape' && handleCancel()}
></div>

<!-- Settings Modal -->
<div class="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[32rem] max-w-[calc(100vw-2rem)]">
	<div class="bg-base-100 border-base-300 rounded-lg border shadow-2xl">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-base-300 px-6 py-4">
			<div class="flex items-center gap-2">
				<MaterialSymbolsSettings class="h-5 w-5 text-primary" />
				<h2 class="text-lg font-semibold">Chat Settings</h2>
			</div>
			<button
				class="btn btn-ghost btn-sm btn-circle"
				on:click={handleCancel}
				aria-label="Close settings"
			>
				<MaterialSymbolsClose class="h-4 w-4" />
			</button>
		</div>

		<!-- Content -->
		<div class="p-6 space-y-6">
			<!-- Gemini API Key Section -->
			<div class="space-y-3">
				<div class="flex items-center gap-2">
					<MaterialSymbolsKey class="h-4 w-4 text-primary" />
					<label class="font-medium">Gemini API Key</label>
				</div>
				
				<div class="relative">
					<input
						type={showApiKey ? 'text' : 'password'}
						bind:value={apiKey}
						placeholder="Enter your Gemini API key"
						class="input input-bordered w-full pr-20"
					/>
					<div class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
						<button
							class="btn btn-ghost btn-xs btn-circle"
							on:click={toggleApiKeyVisibility}
							aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
						>
							{#if showApiKey}
								<MaterialSymbolsVisibilityOff class="h-4 w-4" />
							{:else}
								<MaterialSymbolsVisibility class="h-4 w-4" />
							{/if}
						</button>
						{#if apiKey}
							<button
								class="btn btn-ghost btn-xs"
								on:click={clearApiKey}
								aria-label="Clear API key"
							>
								Clear
							</button>
						{/if}
					</div>
				</div>

				<div class="flex items-start gap-2 text-sm text-base-content/70">
					<MaterialSymbolsInfo class="h-4 w-4 flex-shrink-0 mt-0.5" />
					<p>Your API key is stored locally in your browser and is never sent to our servers.</p>
				</div>

				{#if apiKey}
					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={useGemini}
							class="checkbox checkbox-primary"
						/>
						<span class="text-sm">Use Gemini AI for chat responses</span>
					</label>
				{/if}
			</div>

			<!-- Filtered Data Section -->
			<div class="space-y-3">
				<div class="flex items-center gap-2">
					<MaterialSymbolsDataset class="h-4 w-4 text-primary" />
					<label class="font-medium">Data Context</label>
				</div>

				<label class="flex items-center gap-3 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={includeFilteredData}
						class="checkbox checkbox-primary"
						disabled={!apiKey || !useGemini}
					/>
					<span class="text-sm" class:opacity-50={!apiKey || !useGemini}>
						Include filtered data in chat context
					</span>
				</label>

				<div class="flex items-start gap-2 text-sm text-base-content/70">
					<MaterialSymbolsInfo class="h-4 w-4 flex-shrink-0 mt-0.5" />
					<p>
						When enabled, the AI will have access to your currently filtered dataset, 
						allowing it to answer questions about the specific data you're viewing.
					</p>
				</div>
			</div>

			<!-- API Key Instructions -->
			{#if !apiKey}
				<div class="rounded-lg bg-base-200 p-4 space-y-2">
					<p class="text-sm font-medium">How to get a Gemini API key:</p>
					<ol class="text-sm text-base-content/80 space-y-1 ml-4">
						<li>1. Visit <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="link link-primary">Google AI Studio</a></li>
						<li>2. Sign in with your Google account</li>
						<li>3. Click "Create API Key"</li>
						<li>4. Copy and paste the key here</li>
					</ol>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="flex justify-end gap-2 border-t border-base-300 px-6 py-4">
			<button class="btn btn-ghost" on:click={handleCancel}>
				Cancel
			</button>
			<button 
				class="btn btn-primary" 
				on:click={handleSave}
				disabled={isSaving}
			>
				{#if isSaving}
					<span class="loading loading-spinner loading-sm"></span>
					Saving...
				{:else}
					Save Settings
				{/if}
			</button>
		</div>
	</div>
</div>