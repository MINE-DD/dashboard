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
		
		// Update the popup's max width and styling for menu view
		const popupElement = popup.getElement();
		if (popupElement) {
			const content = popupElement.querySelector('.maplibregl-popup-content');
			if (content) {
				content.setAttribute('style', 'max-width: 320px; padding: 0; border-radius: 8px; overflow: hidden;');
			}
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
		
		// Update the popup's max width and styling for detailed view
		const popupElement = popup.getElement();
		if (popupElement) {
			const content = popupElement.querySelector('.maplibregl-popup-content');
			if (content) {
				content.setAttribute('style', 'max-width: 360px; padding: 15px; border-radius: 8px;');
			}
		}
	}

	function createMenuContent(): string {
		const title = `${features.length} data points at this location`;
		const subtitle = 'Click an item to view details';

		let itemsHtml = '';
		features.forEach((feature, index) => {
			const props = feature.properties as PointProperties;
			const prevalence = (props.prevalence && props.prevalence.trim()) ||
				(props.prevalenceValue * 100).toFixed(1) + '%';
			const color = getPrevalenceColor(props.prevalenceValue);
			const designColor = getDesignColor(props.design);
			
			itemsHtml += `
				<div class="multi-point-item" onclick="window.__multiPointPopover && window.__multiPointPopover.selectFeature(${index})" style="cursor: pointer;">
					<div class="item-container">
						<div class="design-bar" style="background-color: ${designColor}"></div>
						<div class="item-content">
							<div class="item-header">
								<div class="pathogen-info">
									${props.heading ? `<span class="study-heading">${formatDropdownText(props.heading)}</span>` : `<span class="study-heading">${formatDropdownText(props.pathogen)}</span>`}
									<span class="pathogen-name">${formatDropdownText(props.pathogen)}</span>
									<div class="item-meta">
										<span class="meta-text">${formatDropdownText(props.ageRange)}</span>
										<span class="meta-separator">•</span>
										<span class="meta-text">${formatDropdownText(props.syndrome)}</span>
									</div>
								</div>
								<span class="prevalence-badge" style="background-color: ${color}">
									${prevalence}
								</span>
							</div>
							<div class="item-footer">
								<span class="design-label">${formatDropdownText(props.design)}</span>
							</div>
						</div>
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
					padding: 0;
					border-radius: 8px;
					overflow: hidden;
				}
				.menu-header {
					padding: 12px 14px;
					background: #fafafa;
					border-bottom: 1px solid #e5e7eb;
				}
				.menu-header h3 {
					font-size: 14px;
					font-weight: 600;
					margin: 0 0 2px 0;
					color: #1f2937;
				}
				.menu-header p {
					font-size: 12px;
					color: #6b7280;
					margin: 0;
				}
				.menu-items {
					max-height: 320px;
					overflow-y: auto;
					padding: 8px;
					background: #ffffff;
				}
				.menu-items::-webkit-scrollbar {
					width: 6px;
				}
				.menu-items::-webkit-scrollbar-track {
					background: #f3f4f6;
					border-radius: 3px;
				}
				.menu-items::-webkit-scrollbar-thumb {
					background: #d1d5db;
					border-radius: 3px;
				}
				.menu-items::-webkit-scrollbar-thumb:hover {
					background: #9ca3af;
				}
				.multi-point-item {
					margin-bottom: 6px;
					border-radius: 6px;
					overflow: hidden;
					transition: background-color 0.15s ease;
					background: #ffffff;
					border: 1px solid #e5e7eb;
				}
				.multi-point-item:hover {
					background-color: #f9fafb;
					border-color: #d1d5db;
				}
				.multi-point-item:last-child {
					margin-bottom: 0;
				}
				.item-container {
					display: flex;
				}
				.design-bar {
					width: 3px;
					flex-shrink: 0;
				}
				.item-content {
					flex: 1;
					padding: 10px 12px;
				}
				.item-header {
					display: flex;
					justify-content: space-between;
					align-items: flex-start;
					margin-bottom: 4px;
				}
				.pathogen-info {
					flex: 1;
				}
				.study-heading {
					font-size: 13px;
					font-weight: 600;
					color: #1f2937;
					display: block;
					margin-bottom: 2px;
					line-height: 1.3;
				}
				.pathogen-name {
					font-size: 11px;
					color: #6b7280;
					display: block;
					margin-bottom: 3px;
					font-style: italic;
				}
				.item-meta {
					display: flex;
					align-items: center;
					gap: 4px;
					font-size: 11px;
					color: #6b7280;
				}
				.meta-text {
					color: #6b7280;
				}
				.meta-separator {
					color: #d1d5db;
					font-size: 10px;
				}
				.prevalence-badge {
					font-size: 11px;
					font-weight: 600;
					color: white;
					padding: 2px 6px;
					border-radius: 10px;
				}
				.item-footer {
					padding-top: 4px;
					border-top: 1px solid #f3f4f6;
				}
				.design-label {
					font-size: 10px;
					color: #9ca3af;
					font-weight: 500;
					text-transform: uppercase;
					letter-spacing: 0.3px;
				}
			</style>
		`;
	}

	function createDetailedContent(props: PointProperties): string {
		// Label comes from Prevalence (with CI); fallback to PREV-derived percent
		const prevalencePercent = typeof props.prevalenceValue === 'number' && isFinite(props.prevalenceValue) 
			? props.prevalenceValue * 100
			: 0;
		const prevalenceDisplay = (props.prevalence && props.prevalence.trim()) ||
			prevalencePercent.toFixed(2) + '%';
		
		// Determine prevalence color based on decimal value
		const prevalenceColor = getPrevalenceColor(props.prevalenceValue);
		
		// Format pathogen name with italic support
		const pathogenFormatted = formatItalicText(props.pathogen);
		
		// Use heading as title (with italic formatting)
		const title = formatItalicText(props.heading);
		const subtitle = formatItalicText(props.subheading);
		
		// Get design color
		const designColor = getDesignColor(props.design);

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
						<div class="info-label">Age Range:</div>
						<div class="info-value">${formatDropdownText(props.ageRange)}</div>
					</div>
					<div class="info-row">
						<div class="info-label">Syndrome:</div>
						<div class="info-value">${formatDropdownText(props.syndrome)}</div>
					</div>
					<div class="info-row">
						<div class="info-label">Location:</div>
						<div class="info-value">${formatItalicText(props.location)}</div>
					</div>
				</div>

				<div class="popup-section">
					<div class="info-row">
						<div class="info-label">Duration:</div>
						<div class="info-value">${formatItalicText(props.duration)}</div>
					</div>
					<div class="info-row">
						<div class="info-label">Design:</div>
						<div class="info-value">
							<span class="design-indicator-inline" style="background-color: ${designColor}"></span>
							${formatItalicText(props.design)}
						</div>
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
					display: flex;
					align-items: center;
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
				.design-indicator-inline {
					display: inline-block;
					width: 10px;
					height: 10px;
					border-radius: 50%;
					margin-right: 6px;
					border: 1px solid rgba(0, 0, 0, 0.2);
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

	function getDesignColor(design: string): string {
		// Design type color mapping (consistent with map dots)
		const designColors: { [key: string]: string } = {
			'Surveillance': '#FFE5B4',               // Pastel Orange
			'Intervention Trial': '#B7EFC5',         // Pastel Green
			'Case-Control': '#FFB3C6',               // Pastel Red
			'Cohort': '#9197FF',                     // Pastel Blue
			'Cross-Sectional': '#E6B3FF',            // Pastel Purple
			'Other: Cohort': '#9197FF',              // Same as Cohort
			'Other: Mixed Design': '#C0C0C0'         // Light Gray
		};
		return designColors[design] || '#C0C0C0'; // Default to gray if not found
	}

	onDestroy(() => {
		cleanup();
	});
</script>