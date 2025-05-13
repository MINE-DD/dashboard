import type { Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl';
import { extractLayerInfo } from './rasterDataProcessor';

// Note: The handleRasterLayerClick function has been removed as we now use MapPopover for all clicks
// The functionality has been integrated directly into the Map.svelte component
