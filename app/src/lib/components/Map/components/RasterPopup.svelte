<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import { fly } from 'svelte/transition';

	// Props
	export let map: maplibregl.Map;
	export let coordinates: [number, number];
	export let visible: boolean = false;
	export let prevalence: number = 0;
	export let lowerBound: number = 0;
	export let upperBound: number = 0;
	export let ageRange: string = '';
	export let study: string = '';
	export let duration: string = '';
	export let source: string = '';
	export let sourceUrl: string = '';

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Popup state
	let popup: maplibregl.Popup | null = null;
	let popupElement: HTMLElement;
	let isInitialized = false;

	// Format numbers for display
	$: formattedPrevalence = prevalence.toFixed(2);
	$: formattedLowerBound = lowerBound.toFixed(2);
	$: formattedUpperBound = upperBound.toFixed(2);
	$: confidenceInterval = `(${formattedLowerBound}, ${formattedUpperBound})`;

	// Initialize popup
	onMount(() => {
		if (map && coordinates && visible) {
			createPopup();
		}
	});

	// Update popup when props change
	$: {
		console.log('Reactive block triggered. Visible:', visible, 'Initialized:', isInitialized);
		if (map && coordinates && visible) {
			if (!isInitialized) {
				console.log('Creating new popup');
				createPopup();
			} else if (popup) {
				console.log('Updating popup coordinates');
				popup.setLngLat(coordinates);
			}
		} else if (!visible && popup) {
			console.log('Hiding popup');
			popup.remove();
			popup = null;
			isInitialized = false;
		}
	}

	// Create the popup
	function createPopup() {
		console.log('Creating popup with coordinates:', coordinates);
		console.log('Map object:', map);
		console.log('Popup data:', {
			prevalence,
			lowerBound,
			upperBound,
			ageRange,
			study,
			duration,
			source,
			sourceUrl
		});

		if (!map || !coordinates) {
			console.error('Map or coordinates not available');
			return;
		}

		// Remove existing popup if any
		if (popup) {
			// Remove the close event listener before removing the popup
			// to prevent it from triggering the close event
			try {
				// Use a no-op function as the second argument
				popup.off('close', () => {});
			} catch (error) {
				console.error('Error removing close event listener:', error);
			}
			popup.remove();
			popup = null;
		}

		try {
			// Create HTML content for the popup
			const popupContent = `
				<div class="raster-popup">
					<div class="popup-header">
						<h3 class="popup-title">Pathogen Prevalence</h3>
						<button class="close-button" id="popup-close-button" aria-label="Close popup">
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
							>
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>
					</div>

					<div class="popup-content">
						<div class="prevalence-section">
							<div class="prevalence-value">
								<span class="value">${formattedPrevalence}%</span>
								<span class="confidence-interval">${confidenceInterval}</span>
							</div>
							<div class="prevalence-label">Prevalence</div>
						</div>

						<div class="details-section">
							<div class="detail-row">
								<span class="detail-label">Age Range:</span>
								<span class="detail-value">${ageRange}</span>
							</div>
							<div class="detail-row">
								<span class="detail-label">Study:</span>
								<span class="detail-value">${study}</span>
							</div>
							<div class="detail-row">
								<span class="detail-label">Duration:</span>
								<span class="detail-value">${duration}</span>
							</div>
							<div class="detail-row">
								<span class="detail-label">Source:</span>
								<span class="detail-value">
									${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${source}</a>` : source}
								</span>
							</div>
						</div>
					</div>
				</div>
			`;

			// Create a new popup
			popup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				maxWidth: '400px',
				className: 'custom-popup',
				offset: [0, 0]
			})
				.setLngLat(coordinates)
				.setHTML(popupContent);

			// Add the popup to the map
			popup.addTo(map);

			console.log('Popup created and added to map:', popup);

			// Add event listener for popup close
			popup.on('close', () => {
				console.log('Popup closed by user');
				isInitialized = false;
				popup = null;
				dispatch('close');
			});

			// Add event listener for close button click
			setTimeout(() => {
				const closeButton = document.getElementById('popup-close-button');
				if (closeButton) {
					closeButton.addEventListener('click', handleClose);
				}
			}, 100);

			isInitialized = true;
		} catch (error) {
			console.error('Error creating popup:', error);
		}
	}

	// Clean up on component destroy
	onDestroy(() => {
		if (popup) {
			popup.remove();
			popup = null;
		}
	});

	// Handle close button click
	function handleClose() {
		if (popup) {
			popup.remove();
			popup = null;
		}
		dispatch('close');
	}

	// Handle source link click
	function handleSourceClick(event: MouseEvent) {
		if (sourceUrl) {
			window.open(sourceUrl, '_blank');
		}
		event.preventDefault();
	}
</script>

<div bind:this={popupElement} style="display: block;">
	<div class="raster-popup">
		<div class="popup-header">
			<h3 class="popup-title">Pathogen Prevalence</h3>
			<button class="close-button" on:click={handleClose} aria-label="Close popup">
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
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>

		<div class="popup-content">
			<div class="prevalence-section">
				<div class="prevalence-value">
					<span class="value">{formattedPrevalence}%</span>
					<span class="confidence-interval">{confidenceInterval}</span>
				</div>
				<div class="prevalence-label">Prevalence</div>
			</div>

			<div class="details-section">
				<div class="detail-row">
					<span class="detail-label">Age Range:</span>
					<span class="detail-value">{ageRange}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Study:</span>
					<span class="detail-value">{study}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Duration:</span>
					<span class="detail-value">{duration}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Source:</span>
					<span class="detail-value">
						{#if sourceUrl}
							<a
								href={sourceUrl}
								on:click={handleSourceClick}
								target="_blank"
								rel="noopener noreferrer"
							>
								{source}
							</a>
						{:else}
							{source}
						{/if}
					</span>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* Hide the container element */
	.hidden {
		display: none;
	}

	/* Custom styles for the popup content */
	:global(.custom-popup .raster-popup) {
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
		color: #333;
		padding: 0;
		width: 100%;
		max-width: 350px;
	}

	:global(.custom-popup .popup-header) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background-color: hsl(var(--p));
		color: white;
		border-radius: 8px 8px 0 0;
	}

	:global(.custom-popup .popup-title) {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	:global(.custom-popup .close-button) {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: background-color 0.2s;
	}

	:global(.custom-popup .close-button:hover) {
		background-color: rgba(255, 255, 255, 0.2);
	}

	:global(.custom-popup .popup-content) {
		padding: 16px;
		background-color: white;
		border-radius: 0 0 8px 8px;
	}

	:global(.custom-popup .prevalence-section) {
		text-align: center;
		margin-bottom: 16px;
		padding-bottom: 16px;
		border-bottom: 1px solid #eee;
	}

	:global(.custom-popup .prevalence-value) {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 4px;
	}

	:global(.custom-popup .value) {
		font-size: 28px;
		font-weight: 700;
		color: hsl(var(--p));
	}

	:global(.custom-popup .confidence-interval) {
		font-size: 14px;
		color: #666;
		margin-top: 4px;
	}

	:global(.custom-popup .prevalence-label) {
		font-size: 14px;
		color: #666;
		font-weight: 500;
	}

	:global(.custom-popup .details-section) {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	:global(.custom-popup .detail-row) {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	:global(.custom-popup .detail-label) {
		font-size: 12px;
		font-weight: 600;
		color: #666;
	}

	:global(.custom-popup .detail-value) {
		font-size: 14px;
		color: #333;
	}

	:global(.custom-popup .detail-value a) {
		color: hsl(var(--p));
		text-decoration: none;
	}

	:global(.custom-popup .detail-value a:hover) {
		text-decoration: underline;
	}

	/* Override MapLibre popup styles */
	:global(.maplibregl-popup-content) {
		padding: 0 !important;
		border-radius: 8px !important;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1) !important;
		overflow: hidden !important;
	}

	:global(.maplibregl-popup-close-button) {
		display: none !important;
	}

	:global(.maplibregl-popup-tip) {
		border-top-color: white !important;
		border-bottom-color: white !important;
	}

	/* Styles for the component's own content (not used in the popup) */
	.raster-popup {
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
		color: #333;
		padding: 0;
		width: 100%;
		max-width: 350px;
	}

	.popup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background-color: hsl(var(--p));
		color: white;
		border-radius: 8px 8px 0 0;
	}

	.popup-title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	.close-button {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: background-color 0.2s;
	}

	.close-button:hover {
		background-color: rgba(255, 255, 255, 0.2);
	}

	.popup-content {
		padding: 16px;
		background-color: red;
		border-radius: 0 0 8px 8px;
	}

	.prevalence-section {
		text-align: center;
		margin-bottom: 16px;
		padding-bottom: 16px;
		border-bottom: 1px solid #eee;
	}

	.prevalence-value {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 4px;
	}

	.value {
		font-size: 28px;
		font-weight: 700;
		color: hsl(var(--p));
	}

	.confidence-interval {
		font-size: 14px;
		color: #666;
		margin-top: 4px;
	}

	.prevalence-label {
		font-size: 14px;
		color: #666;
		font-weight: 500;
	}

	.details-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.detail-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.detail-label {
		font-size: 12px;
		font-weight: 600;
		color: #666;
	}

	.detail-value {
		font-size: 14px;
		color: #333;
	}

	.detail-value a {
		color: hsl(var(--p));
		text-decoration: none;
	}

	.detail-value a:hover {
		text-decoration: underline;
	}
</style>
