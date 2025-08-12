<script lang="ts">
	import { formatItalicText } from '../utils/textFormatter';
	import { onMount } from 'svelte';
	import MdiEarthBox from '~icons/mdi/earth-box';

	interface Props {
		id: string;
		label: string;
		placeholder?: string;
		options: Array<{
			value: string;
			label: string;
			count?: number;
			hasRasterLayer?: boolean;
		}>;
		selectedValue: string;
		onSelect: (value: string) => void;
		class?: string;
	}

	let {
		id,
		label,
		placeholder = 'Select an option',
		options = [],
		selectedValue = '',
		onSelect,
		class: className = ''
	}: Props = $props();

	let isOpen = $state(false);
	let dropdownRef: HTMLDetailsElement;
	let summaryRef: HTMLElement;
	let dropdownPosition = $state({ top: 0, left: 0, width: 0, maxHeight: 240 });

	// Get display text for current selection
	let displayText = $derived(() => {
		if (!selectedValue) return placeholder;
		const selected = options.find((opt) => opt.value === selectedValue);
		return selected ? selected.label : placeholder;
	});

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			isOpen = false;
		}
	}

	// Handle option selection
	function handleSelect(value: string) {
		onSelect(value);
		isOpen = false;
		// Update the details element state
		if (dropdownRef) {
			dropdownRef.open = false;
		}
	}

	// Calculate dropdown position when opened
	function updateDropdownPosition() {
		if (summaryRef && isOpen) {
			const rect = summaryRef.getBoundingClientRect();
			const viewportHeight = window.innerHeight;

			// Calculate available space below the button
			const spaceBelow = viewportHeight - rect.bottom;

			// Set max height to use most of available space, leaving some padding
			const padding = 20; // Leave 20px padding from viewport edge
			const maxDropdownHeight = Math.max(200, spaceBelow - padding); // Minimum 200px

			dropdownPosition = {
				top: rect.bottom - 90, // Adjusted to move up by 100px
				left: rect.left - 25, // Shift left by 30px as requested
				width: rect.width, // Adjust width to compensate for left shift
				maxHeight: maxDropdownHeight - 40
			};
		}
	}

	$effect(() => {
		if (isOpen) {
			updateDropdownPosition();
		}
	});

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class={'form-control w-full ' + className}>
	<div class="rounded-lg border border-white/50 bg-white/50 p-3 shadow-sm">
		<label for={id} class="label px-0 py-1">
			<span class="label-text text-secondary-focus flex items-center text-base font-medium">
				{label}
			</span>
		</label>

		<details bind:this={dropdownRef} bind:open={isOpen} class="dropdown w-full">
			<summary
				bind:this={summaryRef}
				class="btn btn-sm border-base-300 w-full justify-between bg-white/80 normal-case hover:bg-white/90"
			>
				<span class="flex-1 truncate text-left">
					{#if selectedValue}
						{@html formatItalicText(displayText())}
					{:else}
						<span class="text-base-content/60">{displayText()}</span>
					{/if}
				</span>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="ml-2 transition-transform {isOpen ? 'rotate-180' : ''}"
				>
					<polyline points="6 9 12 15 18 9"></polyline>
				</svg>
			</summary>

			{#if isOpen}
				<ul
					class="menu rounded-box border-base-300 flex-nowrap overflow-y-auto border bg-white/95 p-1 shadow-lg backdrop-blur-sm"
					style="position: fixed; z-index: 9999; top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; width: {dropdownPosition.width}px; max-height: {dropdownPosition.maxHeight}px;"
				>
					<!-- Clear selection option -->
					<li>
						<button
							class="hover:bg-base-200 flex items-center justify-between rounded px-3 py-2 {!selectedValue
								? 'bg-primary/10 font-medium'
								: ''}"
							onclick={() => handleSelect('')}
						>
							<span class="text-base-content/60">{placeholder}</span>
						</button>
					</li>

					<!-- Options -->
					{#each options as option}
						<li>
							<button
								class="hover:bg-base-200 flex items-center justify-between rounded px-3 py-2 {selectedValue ===
								option.value
									? 'bg-primary/10 font-medium'
									: ''}"
								onclick={() => handleSelect(option.value)}
							>
								<span class="flex-1 text-left">
									{@html formatItalicText(option.label)}
								</span>
								<span class="text-base-content/70 flex items-center gap-1 text-sm">
									{#if option.count !== undefined}
										<span>({option.count})</span>
									{/if}
									{#if option.hasRasterLayer}
										<MdiEarthBox class="h-4 w-4" aria-label="Has raster layer" />
									{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</details>
	</div>
</div>

<style>
	/* Style for italic text within options */
	:global(.dropdown-content em) {
		font-style: italic;
		color: inherit;
	}
</style>
