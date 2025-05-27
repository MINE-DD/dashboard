<script lang="ts">
	import MaterialSymbolsChat from '~icons/material-symbols/chat';
	import MaterialSymbolsClose from '~icons/material-symbols/close';
	import ChatModal from './ChatModal.svelte';

	let showChat = $state(false);

	function toggleChat() {
		showChat = !showChat;
	}

	function closeChat() {
		showChat = false;
	}
</script>

<!-- Floating Action Button -->
<div class="fixed bottom-10 right-12 z-50">
	<button
		class="btn btn-primary btn-circle h-14 w-14 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
		class:rotate-45={showChat}
		on:click={toggleChat}
		aria-label={showChat ? 'Close chat' : 'Open chat'}
	>
		{#if showChat}
			<MaterialSymbolsClose class="h-6 w-6" />
		{:else}
			<MaterialSymbolsChat class="h-6 w-6" />
		{/if}
	</button>
</div>

<!-- Chat Modal -->
{#if showChat}
	<ChatModal on:close={closeChat} />
{/if}

<style>
	.btn-circle {
		transition: transform 0.2s ease-in-out;
	}

	.rotate-45 {
		transform: rotate(45deg);
	}
</style>
