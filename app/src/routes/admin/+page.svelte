<script lang="ts">
	import { onMount } from 'svelte';
	import UserCircle from '~icons/heroicons/user-circle';
	import ShieldCheck from '~icons/heroicons/shield-check';
	import MoreVertical from '~icons/lucide/more-vertical';
	import Trash from '~icons/lucide/trash';
	import CreateUserModal from './CreateUserModal.svelte';

	interface User {
		id: number;
		email: string;
		name: string | null;
		roles: string[];
	}

	let users: User[] = [];
	let loading = true;
	let error: string | null = null;
	import { Role } from '$lib/types';
	let availableRoles = [Role.USER, Role.ADMIN];

	async function deleteUser(userId: number) {
		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: 'DELETE'
			});

			if (!response.ok) throw new Error('Failed to delete user');

			// Refresh user list
			users = users.filter((user) => user.id !== userId);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'An unknown error occurred';
		}
	}

	async function updateUserRole(userId: number, role: string, currentRoles: string[]) {
		try {
			const response = await fetch(`/api/admin/users/${userId}/roles`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ role, action: currentRoles.includes(role) ? 'remove' : 'add' })
			});

			if (!response.ok) throw new Error('Failed to update user role');

			// Refresh user list
			const usersResponse = await fetch('/api/admin/users');
			if (!usersResponse.ok) throw new Error('Failed to fetch users');
			users = await usersResponse.json();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'An unknown error occurred';
		}
	}

	onMount(async () => {
		try {
			const response = await fetch('/api/admin/users');
			if (!response.ok) throw new Error('Failed to fetch users');
			users = await response.json();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'An unknown error occurred';
		} finally {
			loading = false;
		}
	});
</script>

<div class="container mx-auto grid grid-rows-[auto_1fr] space-y-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">User Management</h1>
			<div class="badge mt-2">{users.length} Users</div>
		</div>

		<CreateUserModal
			onUserCreated={async () => {
				const response = await fetch('/api/admin/users');
				if (!response.ok) throw new Error('Failed to fetch users');
				users = await response.json();
			}}
		/>
	</div>

	{#if loading}
		<div class="flex justify-center">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="table w-full">
				<thead>
					<tr>
						<th>ID</th>
						<th>User</th>
						<th>Email</th>
						<th>Roles</th>
						<th class="w-20">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each users as user (user.id)}
						<tr class="hover">
							<td>{user.id}</td>
							<td class="flex items-center gap-2">
								<UserCircle class="h-6 w-6" />
								<span class:font-medium={user.roles.includes(Role.ADMIN)}>
									{user.name || 'No name'}
								</span>
								{#if user.roles.includes(Role.ADMIN)}
									<span class="badge badge-primary badge-sm">Admin</span>
								{/if}
							</td>
							<td>{user.email}</td>
							<td class="min-w-[200px]">
								<div class="flex items-center gap-2">
									<select
										class="select w-full max-w-xs {user.roles.includes(Role.ADMIN)
											? 'select-primary font-medium'
											: 'select-bordered'}"
										value={user.roles[0] || Role.USER}
										onchange={async (e) => {
											const newRole = e.currentTarget.value;
											const currentRole = user.roles[0] || 'user';

											try {
												if (newRole === Role.USER) {
													// Just remove admin role, no need to add 'user'
													if (currentRole === Role.ADMIN) {
														await updateUserRole(user.id, Role.ADMIN, user.roles);
													}
												} else {
													// Adding admin role
													await updateUserRole(user.id, newRole, []);
												}
											} catch (err) {
												// Revert select value on error
												e.currentTarget.value = currentRole;
												error = err instanceof Error ? err.message : 'Failed to update role';
											}
										}}
									>
										{#each availableRoles as role}
											<option value={role}>
												{role}
											</option>
										{/each}
									</select>
									<div class="flex-shrink-0">
										{#if user.roles.includes(Role.ADMIN)}
											<div class="tooltip tooltip-left" data-tip="Admin user">
												<ShieldCheck class="text-primary h-5 w-5" />
											</div>
										{:else}
											<div class="tooltip tooltip-left" data-tip="Regular user">
												<UserCircle class="text-base-content/70 h-5 w-5" />
											</div>
										{/if}
									</div>
								</div>
							</td>
							<td>
								<div class="dropdown dropdown-end">
									<button tabindex="0" class="btn btn-ghost btn-sm">
										<MoreVertical class="h-5 w-5" />
									</button>
									<ul
										tabindex="0"
										class="menu dropdown-content rounded-box bg-base-100 z-[1] w-52 p-2 shadow"
									>
										<li>
											<button
												class="text-error"
												onclick={() => {
													if (confirm('Are you sure you want to delete this user?')) {
														deleteUser(user.id);
													}
												}}
											>
												<Trash class="h-4 w-4" />
												Delete User
											</button>
										</li>
									</ul>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
