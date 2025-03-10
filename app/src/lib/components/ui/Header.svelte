<script lang="ts">
	import Logo from '$lib/assets/icons/Logo.svelte';
	// import FeedbackButton from '$lib/components/ui/feedback/FeedbackButton.svelte';
	import { onMount } from 'svelte';
	import Login from '$lib/components/ui/Login/LoginButton.svelte';
	import { toggleMenu } from '$lib/stores/menu.store';
	import IconamoonMenuBurgerHorizontalBold from '~icons/iconamoon/menu-burger-horizontal-bold';
	import menuItems from '$lib/models/menu-itmes';

	let activeCategory = '';
	let isDesktop = $state(true);

	onMount(() => {
		const mediaQuery = window.matchMedia('(min-width: 640px)');
		isDesktop = mediaQuery.matches;

		const handleMediaQueryChange = (e: MediaQueryListEvent) => {
			isDesktop = e.matches;
		};

		mediaQuery.addEventListener('change', handleMediaQueryChange);

		return () => {
			mediaQuery.removeEventListener('change', handleMediaQueryChange);
		};
	});
</script>

<nav class="bien-nav mb-10 px-3">
	<div class="bien-glass"></div>
	<div class="bien-glass-edge"></div>
	<div class="container relative mx-auto py-2">
		<!--Desktop Header-->
		<header class="flex items-center gap-3 px-2 sm:px-0">
			<button
				class="hover:bg-base-200 rounded-md p-2 transition-colors duration-200 sm:hidden"
				onclick={toggleMenu}
				aria-label="Open menu"
			>
				<IconamoonMenuBurgerHorizontalBold class="size-6" />
			</button>
			<a
				class="no-drag mr-3 h-auto max-w-[140px] flex-initial flex-shrink-0 select-none sm:max-w-[160px]"
				href="/"
			>
				<Logo />
			</a>

			<!-- Desktop menu -->
			<div class="z-10 hidden w-full flex-1 justify-end space-x-4 sm:flex lg:space-x-8">
				{#each menuItems as link}
					<a
						class="menu-link"
						onclick={() => (active = link.title)}
						class:active={activeCategory === link.title}
						href={link.path}
					>
						{link.displayTitle}
					</a>
				{/each}
			</div>

			<!-- <FeedbackButton showButton={isDesktop} /> -->

			<Login />
		</header>
	</div>
</nav>

<style lang="postcss">
	.menu-link {
		@apply text-base-content hover:text-secondary font-medium text-opacity-80 transition hover:text-opacity-100;
	}

	.menu-link.active {
		@apply text-primary;
	}

	/* Frosted navigation header */
	nav {
		z-index: 10000;
		position: sticky;
		left: 0;
		right: 0;
		top: 0;
		/* height: 100px; */
	}

	/* Frosted Navigation bar */
	.bien-glass {
		position: absolute;
		inset: 0;
		/*   Extend the backdrop to the bottom for it to "collect the light" outside of the nav */
		--extended-by: 100px;
		bottom: calc(-1 * var(--extended-by));

		--filter: blur(30px);
		-webkit-backdrop-filter: var(--filter);
		backdrop-filter: var(--filter);
		pointer-events: none;

		/*   Cut the part of the backdrop that falls outside of <nav /> */
		--cutoff: calc(100% - var(--extended-by));
		-webkit-mask-image: linear-gradient(
			to bottom,
			black 0,
			black var(--cutoff),
			transparent var(--cutoff)
		);
	}

	.bien-glass-edge {
		position: absolute;
		z-index: -1;
		left: 0;
		right: 0;

		--extended-by: 80px;
		--offset: 20px;
		--thickness: 2px;
		height: calc(var(--extended-by) + var(--offset));
		/*   Offset is used to snuck the border backdrop slightly under the main backdrop for  smoother effect */
		top: calc(100% - var(--offset) + var(--thickness));

		/*   Make the blur bigger so that the light bleed effect spreads wider than blur on the first backdrop */
		/*   Increase saturation and brightness to fake smooth chamfered edge reflections */
		--filter: blur(90px) saturate(160%) brightness(1.3);
		-webkit-backdrop-filter: var(--filter);
		backdrop-filter: var(--filter);
		pointer-events: none;

		-webkit-mask-image: linear-gradient(
			to bottom,
			black 0,
			black var(--offset),
			transparent var(--offset)
		);
	}
</style>
