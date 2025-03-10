<script lang="ts">
	import { enhance } from '$app/forms';
	import AlertCircle from '~icons/lucide/alert-circle';
	import CheckCircle from '~icons/lucide/check-circle';
	import { invalidateAll } from '$app/navigation';

	export let showModal = false;
	let oldPassword = '';
	let newPassword = '';
	let confirmPassword = '';
	let error = '';
	let success = '';

	const handleSubmit = async () => {
		if (newPassword !== confirmPassword) {
			error = 'New passwords do not match';
			return;
		}

		try {
			const response = await fetch('/api/user/password', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					oldPassword,
					newPassword
				})
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.message || 'Failed to update password';
				success = '';
			} else {
				success = 'Password updated successfully';
				error = '';
				// Reset form
				oldPassword = '';
				newPassword = '';
				confirmPassword = '';
				// Close modal after a delay
				setTimeout(() => {
					showModal = false;
					success = '';
				}, 2000);
			}
		} catch (e) {
			error = 'An error occurred while updating password';
			success = '';
		}
	};

	$: if (showModal) {
		error = '';
		success = '';
	}
</script>

<dialog class="modal" class:modal-open={showModal}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">Change Password</h3>
		<div class="py-4">
			<form on:submit|preventDefault={handleSubmit}>
				<div class="form-control w-full">
					<label class="label" for="oldPassword">
						<span class="label-text">Current Password</span>
					</label>
					<input
						type="password"
						id="oldPassword"
						bind:value={oldPassword}
						class="input input-bordered w-full"
						required
					/>
				</div>

				<div class="form-control mt-4 w-full">
					<label class="label" for="newPassword">
						<span class="label-text">New Password</span>
					</label>
					<input
						type="password"
						id="newPassword"
						bind:value={newPassword}
						class="input input-bordered w-full"
						required
						minlength="8"
					/>
				</div>

				<div class="form-control mt-4 w-full">
					<label class="label" for="confirmPassword">
						<span class="label-text">Confirm New Password</span>
					</label>
					<input
						type="password"
						id="confirmPassword"
						bind:value={confirmPassword}
						class="input input-bordered w-full"
						required
						minlength="8"
					/>
				</div>

				{#if error}
					<div class="alert alert-error mt-4">
						<AlertCircle />
						<span>{error}</span>
					</div>
				{/if}

				{#if success}
					<div class="alert alert-success mt-4">
						<CheckCircle />
						<span>{success}</span>
					</div>
				{/if}

				<div class="modal-action">
					<button type="button" class="btn" on:click={() => (showModal = false)}>Cancel</button>
					<button type="submit" class="btn btn-primary">Update Password</button>
				</div>
			</form>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button on:click={() => (showModal = false)}>close</button>
	</form>
</dialog>
