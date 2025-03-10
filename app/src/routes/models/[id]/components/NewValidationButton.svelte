<script lang="ts">
	import ValidationModal from './ValidationModal.svelte';

	let isModalOpen = $state(false);

	function openModal() {
		isModalOpen = true;
	}

	function handleClose() {
		isModalOpen = false;
	}
</script>

<button class="btn btn-primary" onclick={openModal}>New Validation</button>

<ValidationModal bind:open={isModalOpen} on:close={handleClose} />
