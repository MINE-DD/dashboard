<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import type { Map as MaplibreMap } from 'maplibre-gl';
	import { formatItalicText, formatDropdownText } from '../utils/textFormatter';
	import type { PointProperties } from '$lib/types';
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';

	const dispatch = createEventDispatcher();

	interface Props {
		map: MaplibreMap | null;
		coordinates: [number, number] | null;
		features: maplibregl.MapGeoJSONFeature[];
		visible: boolean;
	}

	let { map = null, coordinates = null, features = [], visible = false }: Props = $props();

	let popup: maplibregl.Popup | null = null;
	let selectedFeature = $state<maplibregl.MapGeoJSONFeature | null>(null);

	$effect(() => {
		if (visible && map && coordinates && features.length > 0) {
			if (!selectedFeature) {
				showMultiPointMenu();
			} else {
				showDetailedView();
			}
		} else {
			cleanup();
		}
	});

	function cleanup() {
		if (popup) {
			popup.remove();
			popup = null;
		}
		selectedFeature = null;
		
		// Clean up global handlers
		if (typeof window !== 'undefined') {
			(window as any).__multiPointPopover = undefined;
		}
	}

	function selectFeature(index: number) {
		if (index >= 0 && index < features.length) {
			selectedFeature = features[index];
		}
	}

	function goBack() {
		selectedFeature = null;
	}

	function showMultiPointMenu() {
		if (!map || !coordinates || features.length === 0) return;

		// Store handlers globally for inline onclick
		(window as any).__multiPointPopover = {
			selectFeature: selectFeature,
			goBack: goBack
		};

		const html = createMenuContent();
		
		// Create popup instance if it doesn't exist
		if (!popup) {
			popup = new maplibregl.Popup({
				closeButton: true,
				closeOnClick: false,
				maxWidth: '320px',
				className: 'multi-point-popup',
				offset: 12
			});
			
			popup.on('close', () => {
				cleanup();
				dispatch('close');
			});
			
			popup
				.setLngLat(coordinates)
				.addTo(map);
		}
		
		// Update popup content and ensure correct styling
		popup.setHTML(html);
		
		// Update the popup's max width for menu view
		const popupElement = popup.getElement();
		if (popupElement) {
			popupElement.querySelector('.maplibregl-popup-content')?.setAttribute('style', 'max-width: 320px');
		}
	}

	function showDetailedView() {
		if (!map || !coordinates || !selectedFeature) return;

		const html = createDetailedContent(selectedFeature.properties as PointProperties);
		
		// Update existing popup or create new one
		if (!popup) {
			popup = new maplibregl.Popup({
				closeButton: true,
				closeOnClick: false,
				maxWidth: '360px',
				className: 'study-point-popup',
				offset: 12
			});
			
			popup.on('close', () => {
				cleanup();
				dispatch('close');
			});
			
			popup
				.setLngLat(coordinates)
				.addTo(map);
		}
		
		// Update popup content and class
		popup.setHTML(html);
		
		// Update the popup's max width for detailed view
		const popupElement = popup.getElement();
		if (popupElement) {
			popupElement.querySelector('.maplibregl-popup-content')?.setAttribute('style', 'max-width: 360px');
		}
	}

	function createMenuContent(): string {
		const title = `${features.length} data points at this location`;
		const subtitle = 'Click an item to view details';

		let itemsHtml = '';
		features.forEach((feature, index) => {
			const props = feature.properties as PointProperties;
			const prevalence = (props.prevalenceValue * 100).toFixed(1) + '%';
			const color = getPrevalenceColor(props.prevalenceValue);
			
			itemsHtml += `
				<div class="multi-point-item" onclick="window.__multiPointPopover && window.__multiPointPopover.selectFeature(${index})" style="cursor: pointer;">
					<div class="item-header">
						<span class="pathogen-name">${formatDropdownText(props.pathogen)}</span>
						<span class="prevalence-badge" style="background-color: ${color}">
							${prevalence}
						</span>
					</div>
					<div class="item-details">
						<span class="detail-chip">${formatDropdownText(props.ageRange)}</span>
						<span class="detail-chip">${formatDropdownText(props.syndrome)}</span>
					</div>
				</div>
			`;
		});

		return `
			<div class="multi-point-menu">
				<div class="menu-header">
					<h3>${title}</h3>
					<p>${subtitle}</p>
				</div>
				<div class="menu-items">
					${itemsHtml}
				</div>
			</div>
			<style>
				.multi-point-menu {
					padding: 4px;
				}
				.menu-header {
					padding: 8px 12px;
					border-bottom: 1px solid #e5e7eb;
				}
				.menu-header h3 {
					font-size: 14px;
					font-weight: 600;
					margin: 0 0 4px 0;
				}
				.menu-header p {
					font-size: 12px;
					color: #6b7280;
					margin: 0;
				}
				.menu-items {
					max-height: 300px;
					overflow-y: auto;
					padding: 4px 0;
				}
				.multi-point-item {
					padding: 8px 12px;
					border-bottom: 1px solid #f3f4f6;
					transition: background-color 0.2s;
				}
				.multi-point-item:hover {
					background-color: #f9fafb;
				}
				.multi-point-item:last-child {
					border-bottom: none;
				}
				.item-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 4px;
				}
				.pathogen-name {
					font-size: 13px;
					font-weight: 500;
				}
				.prevalence-badge {
					font-size: 11px;
					font-weight: 600;
					color: white;
					padding: 2px 6px;
					border-radius: 4px;
				}
				.item-details {
					display: flex;
					gap: 4px;
					flex-wrap: wrap;
				}
				.detail-chip {
					font-size: 11px;
					color: #6b7280;
					background: #f3f4f6;
					padding: 2px 6px;
					border-radius: 3px;
				}
			</style>
		`;
	}

	function createDetailedContent(props: PointProperties): string {
		// Convert prevalence value to percentage for display
		const prevalencePercent = typeof props.prevalenceValue === 'number' && isFinite(props.prevalenceValue) 
			? props.prevalenceValue * 100
			: 0;
		const prevalenceDisplay = prevalencePercent.toFixed(2) + '%';
		
		// Determine prevalence color based on decimal value
		const prevalenceColor = getPrevalenceColor(props.prevalenceValue);
		
		// Format pathogen name with italic support
		const pathogenFormatted = formatItalicText(props.pathogen);
		
		// Use heading as title (with italic formatting)
		const title = formatItalicText(props.heading);
		const subtitle = formatItalicText(props.subheading);

		return `
			<div class="popup-content">
				<button class="back-button" onclick="window.__multiPointPopover && window.__multiPointPopover.goBack()">
					← Back to list
				</button>
				<h3 class="popup-title">
					<span class="pathogen-name">
						${title}
					</span>
				</h3>
				${subtitle && subtitle.trim() ? `<div class="popup-subtitle">${subtitle}</div>` : ''}

				<div class="popup-section">
					<div class="info-row">
						<div class="info-label">Pathogen:</div>
						<div class="info-value">${pathogenFormatted}</div>
					</div>
					<div class="info-row">
						<div class="info-label">Prevalence:</div>
						<div class="info-value">
							<span class="prevalence-badge" style="background-color: ${prevalenceColor}">
								${prevalenceDisplay}
							</span>
						</div>
					</div>
					<div class="info-row">
						<div class="info-label">Age Group:</div>
						<div class="info-value">${formatItalicText(props.ageGroup)}</div>
					</div>
					<div class="info-row">
						<div class="info-label">Syndrome:</div>
						<div class="info-value">${formatItalicText(props.syndrome)}</div>
					</div>
					<div class="info-row">
						<div class="info-label">Location:</div>
						<div class="info-value">${formatItalicText(props.location)}</div>
					</div>
					<div class="info-row">
						<div class="info-label">Age Range:</div>
						<div class="info-value">${formatItalicText(props.ageRange)}</div>
					</div>
				</div>

				<div class="popup-section">
					<div class="info-row">
						<div class="info-label">Duration:</div>
						<div class="info-value">${formatItalicText(props.duration)}</div>
					</div>
					<div class="info-row">
						<div class="info-label">Design:</div>
						<div class="info-value">${formatItalicText(props.design)}</div>
					</div>
				</div>

				${props.footnote && props.footnote.trim() ? `
				<div class="popup-footnote">
					<small>${formatItalicText(props.footnote)}</small>
				</div>
				` : ''}

				<div class="popup-footer">
					<a href="${props.hyperlink}" target="_blank" class="source-link">
						${props.source}
						<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
							<polyline points="15 3 21 3 21 9"></polyline>
							<line x1="10" y1="14" x2="21" y2="3"></line>
						</svg>
					</a>
				</div>
			</div>
			<style>
				.back-button {
					background: none;
					border: none;
					color: #3b82f6;
					font-size: 12px;
					cursor: pointer;
					padding: 0;
					margin-bottom: 8px;
				}
				.back-button:hover {
					text-decoration: underline;
				}
				.popup-title {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin: 0 0 10px 0;
					padding-bottom: 8px;
					border-bottom: 1px solid #eee;
					font-size: 16px;
					font-weight: 600;
				}
				.pathogen-name {
					color: #333;
				}
				.pathogen-name em {
					font-style: italic;
					font-weight: 500;
				}
				.popup-subtitle {
					font-size: 14px;
					color: #666;
					margin: -5px 0 10px 0;
					font-style: italic;
				}
				.popup-footnote {
					margin-top: 10px;
					padding-top: 8px;
					border-top: 1px solid #eee;
					color: #666;
					font-size: 12px;
				}
				.popup-footnote em {
					font-style: italic;
				}
				.prevalence-badge {
					display: inline-block;
					padding: 2px 8px;
					margin-right: 10px;
					border-radius: 12px;
					color: white;
					font-size: 13px;
					font-weight: 600;
				}
				.popup-section {
					margin-bottom: 12px;
				}
				.info-row {
					display: flex;
					margin-bottom: 6px;
					font-size: 14px;
				}
				.info-label {
					flex: 0 0 100px;
					font-weight: 500;
					color: #666;
				}
				.info-value {
					flex: 1;
					color: #333;
				}
				.popup-footer {
					padding-top: 8px;
					margin-top: 8px;
					border-top: 1px solid #eee;
					font-size: 13px;
				}
				.source-link {
					display: flex;
					align-items: center;
					gap: 4px;
					color: #0066cc;
					text-decoration: none;
					font-size: 13px;
				}
				.source-link:hover {
					text-decoration: underline;
				}
			</style>
		`;
	}

	function getPrevalenceColor(prevalence: number): string {
		if (prevalence < 0.1) return '#4daf4a'; // Low: green
		if (prevalence < 0.3) return '#ff7f00'; // Medium: orange
		if (prevalence < 0.5) return '#E4581C'; // High: lighter red
		return '#e41a1c'; // Very high: red
	}

	onDestroy(() => {
		cleanup();
	});
</script>