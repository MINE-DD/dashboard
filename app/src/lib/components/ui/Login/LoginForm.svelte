<script lang="ts">
	import EmailLoginForm from './EmailLoginForm.svelte';
	import RegisterForm from './RegisterForm.svelte';

	let isRegistering = $state(false);

	function handleRegistrationSuccess() {
		isRegistering = false;
	}
</script>

<div class="w-full max-w-md space-y-8 rounded-lg p-8 shadow-lg">
	<h1 class="mb-5 text-center text-2xl font-bold">
		<!-- {isRegistering ? 'Create Account' : 'Login Access'} -->
		{isRegistering ? 'Create Account' : ''}
	</h1>

	<div class="flex flex-col gap-4">
		{#if isRegistering}
			<RegisterForm on:registrationSuccess={handleRegistrationSuccess} />
		{:else}
			<div class="space-y-4">
				<EmailLoginForm />
			</div>
		{/if}

		<div class="mt-4 text-center">
			{#if isRegistering}
				<span>Already have an account?</span>
				<button
					type="button"
					class="link link-primary ml-2"
					onclick={(e) => (isRegistering = false)}
				>
					Sign in
				</button>
			{:else}
				<span>Don't have an account?</span>
				<button
					type="button"
					class="link link-primary ml-2"
					onclick={(e) => (isRegistering = true)}
				>
					Create one
				</button>
			{/if}
		</div>
	</div>
</div>
