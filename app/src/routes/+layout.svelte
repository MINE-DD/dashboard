<script lang="ts">
	import '$lib/assets/css/app.css';
	import '$lib/assets/css/code-highlighted-prisma.css';
	import Header from '$components/ui/Header.svelte';
	import Analytics from '$components/ui/Analytics.svelte';
	import SideMenu from '$components/ui/SideMenu.svelte';
	import GlobalToast from '$components/ui/GlobalToast.svelte';
	import { env } from '$env/dynamic/public';
	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
	// import FooterMain from '$components/ui/footerMain.svelte';
</script>

<Analytics />
<GlobalToast />

<svelte:head>
	<title>PLAN-EO</title>
</svelte:head>

<div
	class="relative grid h-dvh w-dvw grid-rows-[auto_auto_1fr] overflow-clip sm:grid-rows-[auto_1fr]"
>
	<Header />
	<SideMenu />
	{#if children}{@render children()}{:else}
		<!-- Content here -->
	{/if}
	<!-- <FooterMain /> -->
	{#if env.PUBLIC_LOCALHOST}
		<div class="bg-warning text-warning-content fixed bottom-0 left-0 w-full pl-4 text-xs">
			dev database
		</div>
	{/if}
</div>
