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
		cleanup();
		
		if (!map || !coordinates || features.length === 0) return;

		// Store handlers globally for inline onclick
		(window as any).__multiPointPopover = {
			selectFeature: selectFeature,
			goBack: goBack
		};

		const html = createMenuContent();
		
		popup = new maplibregl.Popup({
			closeButton: true,
			closeOnClick: false,
			maxWidth: '320px',
			className: 'multi-point-popup',
			offset: 12
		})
			.setLngLat(coordinates)
			.setHTML(html)
			.addTo(map);

		popup.on('close', () => {
			cleanup();
			dispatch('close');
		});
	}

	function showDetailedView() {
		if (popup) {
			popup.remove();
		}

		if (!map || !coordinates || !selectedFeature) return;

		const html = createDetailedContent(selectedFeature.properties as PointProperties);
		
		popup = new maplibregl.Popup({
			closeButton: true,
			closeOnClick: false,
			maxWidth: '360px',
			className: 'study-point-popup',
			offset: 12
		})
			.setLngLat(coordinates)
			.setHTML(html)
			.addTo(map);

		popup.on('close', () => {
			cleanup();
			dispatch('close');
		});
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
						<span class="detail-chip">${formatDropdownText(props.ageGroup)}</span>
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
		const prevalence = (props.prevalenceValue * 100).toFixed(1) + '%';
		const color = getPrevalenceColor(props.prevalenceValue);

		return `
			<div class="study-point-content">
				<button class="back-button" onclick="window.__multiPointPopover && window.__multiPointPopover.goBack()">
					← Back to list
				</button>
				<h3 class="pathogen-title">${formatItalicText(props.pathogen)}</h3>
				<div class="prevalence-display">
					<span class="prevalence-value" style="background-color: ${color}">
						${prevalence}
					</span>
				</div>
				<div class="details-grid">
					<div class="detail-row">
						<span class="detail-label">Age Group:</span>
						<span class="detail-value">${props.ageGroup}</span>
					</div>
					<div class="detail-row">
						<span class="detail-label">Syndrome:</span>
						<span class="detail-value">${props.syndrome}</span>
					</div>
					<div class="detail-row">
						<span class="detail-label">District:</span>
						<span class="detail-value">${props.district}</span>
					</div>
					<div class="detail-row">
						<span class="detail-label">Sample Size:</span>
						<span class="detail-value">${props.n}</span>
					</div>
				</div>
			</div>
			<style>
				.study-point-content {
					padding: 12px;
				}
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
				.pathogen-title {
					font-size: 16px;
					font-weight: 600;
					margin: 0 0 8px 0;
				}
				.prevalence-display {
					margin-bottom: 12px;
				}
				.prevalence-value {
					font-size: 14px;
					font-weight: 600;
					color: white;
					padding: 4px 8px;
					border-radius: 4px;
				}
				.details-grid {
					display: flex;
					flex-direction: column;
					gap: 6px;
				}
				.detail-row {
					display: flex;
					justify-content: space-between;
					font-size: 13px;
				}
				.detail-label {
					color: #6b7280;
				}
				.detail-value {
					font-weight: 500;
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