<script lang="ts">
	import { Role } from '$lib/types';
	import UserPlus from '~icons/lucide/user-plus';

	export let onUserCreated: () => void;

	let modalOpen = false;
	let availableRoles = [Role.USER, Role.ADMIN];

	// New user form
	let newUser = {
		email: '',
		password: '',
		name: '',
		role: Role.USER
	};
	let createUserLoading = false;
	let createUserError: string | null = null;
	let createUserSuccess = false;

	async function handleCreateUser() {
		createUserLoading = true;
		createUserError = null;
		createUserSuccess = false;

		try {
			const response = await fetch('/api/admin/users', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(newUser)
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to create user');
			}

			// Clear form and show success
			newUser = { email: '', password: '', name: '', role: Role.USER };
			createUserSuccess = true;
			onUserCreated();

			// Close modal after a short delay
			setTimeout(() => {
				modalOpen = false;
				createUserSuccess = false;
			}, 1500);
		} catch (e: unknown) {
			createUserError = e instanceof Error ? e.message : 'An unknown error occurred';
		} finally {
			createUserLoading = false;
		}
	}
</script>

<!-- Modal toggle button -->
<button class="btn btn-primary" onclick={() => (modalOpen = true)}>
	<UserPlus class="h-5 w-5" />
	Add User
</button>

<!-- Modal -->
<dialog class="modal" class:modal-open={modalOpen}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">Add New User</h3>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleCreateUser();
			}}
		>
			<div class="space-y-4 py-4">
				<div class="form-control w-full">
					<label class="label" for="name">
						<span class="label-text">Name</span>
					</label>
					<input
						type="text"
						id="name"
						bind:value={newUser.name}
						class="input input-bordered w-full"
						placeholder="John Doe"
					/>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="form-control w-full">
						<label class="label" for="email">
							<span class="label-text">Email</span>
						</label>
						<input
							type="email"
							id="email"
							bind:value={newUser.email}
							class="input input-bordered w-full"
							placeholder="user@example.com"
							required
						/>
					</div>

					<div class="form-control w-full">
						<label class="label" for="password">
							<span class="label-text">Password</span>
						</label>
						<input
							type="password"
							id="password"
							bind:value={newUser.password}
							class="input input-bordered w-full"
							placeholder="••••••••"
							required
						/>
					</div>
				</div>
				<div class="form-control w-full">
					<label class="label" for="role">
						<span class="label-text">Role</span>
					</label>
					<select id="role" bind:value={newUser.role} class="select select-bordered w-full">
						{#each availableRoles as role}
							<option value={role}>
								{role}
							</option>
						{/each}
					</select>
				</div>

				{#if createUserError}
					<div class="alert alert-error">
						<span>{createUserError}</span>
					</div>
				{/if}

				{#if createUserSuccess}
					<div class="alert alert-success">
						<span>User created successfully!</span>
					</div>
				{/if}
			</div>

			<div class="modal-action">
				<button type="button" class="btn" onclick={() => (modalOpen = false)}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={createUserLoading}>
					{#if createUserLoading}
						<span class="loading loading-spinner"></span>
					{/if}
					Create User
				</button>
			</div>
		</form>
	</div>
	<div class="modal-backdrop" onclick={() => (modalOpen = false)} />
</dialog>
