<script lang="ts">
	import { rasterLayers } from '../store';
	import type { RasterLayer } from '$lib/types';

	export let visible: boolean = true;

	// Get the first visible raster layer
	$: visibleRaster = Array.from($rasterLayers.values()).find((layer) => layer.isVisible);

	// Generate gradient stops for viridis colormap
	const viridisColors = [
		{ stop: 0, color: 'rgb(68, 1, 84)' }, // Dark purple
		{ stop: 0.11, color: 'rgb(72, 40, 120)' }, // Purple
		{ stop: 0.22, color: 'rgb(62, 73, 137)' }, // Blue
		{ stop: 0.33, color: 'rgb(49, 104, 142)' }, // Light blue
		{ stop: 0.44, color: 'rgb(38, 130, 142)' }, // Cyan
		{ stop: 0.55, color: 'rgb(31, 158, 137)' }, // Teal
		{ stop: 0.66, color: 'rgb(53, 183, 121)' }, // Green
		{ stop: 0.77, color: 'rgb(109, 205, 89)' }, // Light green
		{ stop: 0.88, color: 'rgb(180, 222, 44)' }, // Yellow-green
		{ stop: 1, color: 'rgb(253, 231, 37)' } // Yellow
	];

	// Create gradient string
	$: gradientStyle = `linear-gradient(to right, ${viridisColors.map((c) => `${c.color} ${c.stop * 100}%`).join(', ')})`;

	// Get min/max from layer's rescale (fallback to 0-11)
	$: minValue = visibleRaster?.rescale?.[0] ?? 0;
	$: maxValue = visibleRaster?.rescale?.[1] ?? 11;

	// Calculate tick marks dynamically: aim ~6 ticks including endpoints
	$: tickValues = (() => {
		const ticks: number[] = [];
		const steps = 6;
		const span = maxValue - minValue || 1;
		const step = span / steps;
		for (let i = 0; i <= steps; i++) {
			const v = minValue + step * i;
			// Round nicely to 1 decimal when needed
			const rounded = Math.round(v * 10) / 10;
			ticks.push(rounded);
		}
		// Ensure min/max are exact
		ticks[0] = Math.round(minValue * 10) / 10;
		ticks[ticks.length - 1] = Math.round(maxValue * 10) / 10;
		return ticks;
	})();
</script>

{#if visible && visibleRaster}
	<div class="raster-legend">
		<div class="legend-title">
			<span class="font-semibold">Prevalence (%)</span>
			{#if visibleRaster}
				<span class="text-xs opacity-75">({visibleRaster.name})</span>
			{/if}
		</div>

		<!-- Color gradient bar -->
		<div class="gradient-container">
			<div class="gradient-bar" style="background: {gradientStyle}"></div>

			<!-- Tick marks and labels -->
			<div class="tick-container">
				{#each tickValues as value}
					<div
						class="tick-mark"
						style="left: {((value - minValue) / (maxValue - minValue)) * 100}%"
					>
						<div class="tick-line"></div>
						<div class="tick-label">{value}%</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Debug info -->
		<!-- 		<div class="debug-info">
			<div class="text-xs opacity-60">
				Data range: {minValue}% - {maxValue}%
			</div>
			{#if visibleRaster.rasterData}
				<div class="text-xs opacity-60">
					Raster size: {visibleRaster.width}×{visibleRaster.height}
				</div>
				<div class="text-xs opacity-60">
					Bounds: [{visibleRaster.bounds?.map(b => b.toFixed(1)).join(', ')}]
				</div>
			{/if}
		</div> -->
	</div>
{/if}

<style>
	.raster-legend {
		position: absolute;
		bottom: 80px;
		left: 50%;
		transform: translateX(-50%);
		background: white;
		padding: 10px 30px 0px;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 10;
	}

	.legend-title {
		margin-bottom: 8px;
		font-size: 14px;
	}

	.gradient-container {
		position: relative;
		margin-bottom: 8px;
	}

	.gradient-bar {
		height: 20px;
		border-radius: 4px;
		border: 1px solid #ddd;
		width: 100%;
	}

	.tick-container {
		position: relative;
		height: 30px;
		margin-top: 4px;
	}

	.tick-mark {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		transform: translateX(-50%);
	}

	.tick-line {
		width: 1px;
		height: 6px;
		background: #666;
	}

	.tick-label {
		font-size: 11px;
		margin-top: 2px;
		white-space: nowrap;
		color: #666;
	}

	.debug-info {
		border-top: 1px solid #e5e7eb;
		margin-top: 8px;
		padding-top: 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
</style>
