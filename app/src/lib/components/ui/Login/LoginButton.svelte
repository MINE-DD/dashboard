<script lang="ts">
	import { page } from '$app/stores';
	import LoginForm from './LoginForm.svelte';
	import { Role } from '$lib/types';
</script>

<div>
	<!-- Logged in -->
	{#if $page.data.session}
		<div class="dropdown dropdown-end">
			<button
				type="button"
				aria-haspopup="true"
				aria-expanded="false"
				class="hover:bg-base-200 flex h-12 w-12 items-center justify-center rounded-full transition active:scale-95"
			>
				<img
					alt="User avatar"
					class="ring-primary ring-offset-base-100 size-8 cursor-pointer rounded-full ring-offset-2"
					class:ring-2={$page.data.session?.user?.roles?.includes(Role.ADMIN)}
					src={$page.data?.session?.user?.image ?? '/images/profile.avif'}
					referrerpolicy="no-referrer"
					on:error={(e: Event) => {
						if (e.target instanceof HTMLImageElement) {
							console.error('Image failed to load:', e.target.src);
							e.target.onerror = null; // Prevent infinite loop
							e.target.src = '/images/profile.avif';
						}
					}}
				/>
			</button>
			<ul class="menu dropdown-content rounded-box bg-base-100 z-[1] w-52 p-2 shadow" role="menu">
				<li class="flex gap-2">
					<a href="/profile" class="flex items-center gap-2">Profile</a>
				</li>
				{#if $page.data.session?.user?.roles?.includes(Role.ADMIN)}
					<li class="flex gap-2">
						<a
							href="/admin"
							class="hover:text-primary-focus text-primary flex items-center gap-2 font-medium"
						>
							<span class="bg-primary/10 rounded-md p-1">Admin Panel</span>
						</a>
					</li>
				{/if}
				<div class="divider my-0"></div>
				<form action="/auth/signout" method="POST">
					<li class="flex gap-2">
						<button type="submit" class="items-center gap-2">Logout</button>
					</li>
				</form>
			</ul>
		</div>
		<!-- Not logged in-->
	{/if}
</div>
