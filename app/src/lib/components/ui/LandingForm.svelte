<script lang="ts">
	import { goto } from '$app/navigation';
	import LoginForm from './Login/LoginForm.svelte';
	import { PUBLIC_ORGANIZATION_NAME } from '$env/static/public';

	const handleSubmit = () => {
		// TODO: Implement actual password validation in a store
		goto('/models');
	};
</script>

<div class="flex min-h-screen flex-col items-center justify-center p-4">
	<!-- Logo and Organization Name -->
	<div class="mb-16 flex items-center gap-4">
		<div class="bg-base-200 h-16 w-16 rounded-lg"></div>
		<h1 class="text-4xl font-bold">{PUBLIC_ORGANIZATION_NAME}</h1>
	</div>

	<LoginForm />

	<!-- Password Form -->
	<!-- <div class="card bg-base-100 w-full max-w-md shadow-xl">
		<div class="card-body">
			<form onsubmit={preventDefault(handleSubmit)} class="space-y-4">
				<div class="form-control">
					<label for="password" class="label">
						<span class="label-text text-xl">Password</span>
					</label>
					<input
						type="password"
						id="password"
						bind:value={password}
						class="input input-bordered w-full"
						placeholder="****"
					/>
				</div>
				<button type="submit" class="btn btn-primary w-full">Access</button>
			</form>
		</div>
	</div> -->
</div>
