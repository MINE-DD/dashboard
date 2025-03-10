<script lang="ts">
	// import LogOutButton from '$lib/components/Login/LogOutButton.svelte';
	import { page } from '$app/stores';
	import Key from '~icons/lucide/key';
	import ChangePasswordModal from './ChangePasswordModal.svelte';

	let showPasswordModal = false;
	$: isCredentialsProvider = $page.data?.session?.provider === 'credentials';
</script>

<div class="w-11/12">
	<div class="flex justify-center pb-10">
		<div class="avatar pointer-events-none select-none">
			<div class="mask mask-hexagon w-40">
				<img
					class="!object-contain"
					src={$page.data?.session?.user?.image ?? '/images/profile.avif'}
					alt="username"
					on:error={(e: Event) => {
						if (e.target instanceof HTMLImageElement) {
							console.error('Image failed to load:', e.target.src);
							e.target.onerror = null; // Prevent infinite loop
							e.target.src = '/images/profile.avif';
						}
					}}
				/>
			</div>
		</div>

		<div class="ml-10">
			<div class="">
				<div class="block text-3xl font-light leading-relaxed">
					{$page.data?.session?.user?.name ||
						$page.data?.session?.user?.email?.split('@')[0] ||
						'User'}
				</div>
				<div class="block font-light leading-relaxed">
					{$page.data?.session?.user?.email || ''}
				</div>
			</div>

			<!-- <LogOutButton /> -->
			{#if isCredentialsProvider}
				<button class="btn btn-outline mt-4" on:click={() => (showPasswordModal = true)}>
					<Key />
					Change Password
				</button>
			{/if}
		</div>
	</div>
	<div class="border-b border-base-300"></div>

	<ChangePasswordModal bind:showModal={showPasswordModal} />
</div>
