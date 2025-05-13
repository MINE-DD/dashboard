<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { writable } from 'svelte/store';

	// Create event dispatcher to notify parent when password is correct
	const dispatch = createEventDispatcher();

	// Store for password input value
	const passwordInput = writable('');

	// Store for error state
	const showError = writable(false);

	// Correct password
	const correctPassword = 'pl@neo2025';

	// Function to check password
	function checkPassword() {
		if ($passwordInput === correctPassword) {
			// Password is correct, dispatch authenticated event
			dispatch('authenticated');
		} else {
			// Password is incorrect, show error
			showError.set(true);
			passwordInput.set('');
		}
	}

	// Function to handle keyup events (Enter key)
	function handleKeyup(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			checkPassword();
		}
	}

	// Focus on password input when component is mounted
	onMount(() => {
		const inputElement = document.getElementById('password-input');
		if (inputElement) {
			inputElement.focus();
		}
	});
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
	<div class="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
		<h2 class="mb-4 text-2xl font-bold text-gray-800">PLAN-EO Dashboard</h2>
		<p class="mb-6 text-gray-600">Please enter the password to access the application</p>

		{#if $showError}
			<div class="mb-4 text-sm text-red-600">Incorrect password. Please try again.</div>
		{/if}

		<input
			type="password"
			id="password-input"
			placeholder="Enter password"
			class="riinput mb-4 w-full"
			bind:value={$passwordInput}
			on:keyup={handleKeyup}
		/>

		<button class="btn btn-primary mb-4 w-full" on:click={checkPassword}>Submit</button>
	</div>
</div>
