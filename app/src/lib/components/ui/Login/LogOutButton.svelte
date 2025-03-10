<script lang="ts">
	import { signOut } from '@auth/sveltekit/client';

	async function handleSignOut() {
		await signOut();
	}
</script>

<button
	on:click={handleSignOut}
	class="border-content text-content hover:bg-base-300 mr-6 mt-5 cursor-pointer rounded-lg border-2 px-2 py-2 font-bold transition duration-200 ease-in-out hover:text-white"
>
	LOG OUT
</button>
