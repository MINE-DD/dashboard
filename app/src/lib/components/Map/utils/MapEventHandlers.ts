import type { Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import { isLoading } from '../store';
import { extractLayerInfo } from './rasterDataProcessor';
import { processPathogenData } from './csvDataProcessor';

/**
 * Handle map click events for raster layers
 * @param e The map mouse event
 * @param map The map instance
 * @param visibleRasterLayers Array of visible raster layer IDs
 * @param rasterLayers Map of raster layers
 */
export async function handleRasterLayerClick(
  e: MapMouseEvent,
  map: MaplibreMap,
  visibleRasterLayers: string[],
  rasterLayers: Map<string, any>
): Promise<void> {
  // Only process if map exists and a raster layer is visible
  if (!map || visibleRasterLayers.length === 0) return;

  // Get the clicked coordinates
  const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];

  // Use the first visible raster layer
  const layerId = visibleRasterLayers[0];
  const layer = rasterLayers.get(layerId);

  if (!layer) return;

  // Get the layer name
  const layerName = layer.name;

  // Extract layer info
  const { pathogen, ageGroup, syndrome } = extractLayerInfo(layerName);

  // Show loading state
  isLoading.set(true);

  try {
    // Process pathogen data for the popup
    const popupData = await processPathogenData(pathogen, coordinates, ageGroup, syndrome);

    // Create HTML content for the popup
    const popupContent = createRasterPopupContent(popupData);

    // Create a new popup
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true,
      maxWidth: '400px',
      className: 'custom-popup',
      offset: [0, 0]
    })
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);

    // Add event listener for close button click
    setTimeout(() => {
      const closeButton = document.getElementById('popup-close-button');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          popup.remove();
        });
      }
    }, 100);

    // Add event listener for map click to close popup
    const mapClickHandler = (e: MapMouseEvent) => {
      // Check if click is outside the popup
      const popupElement = document.querySelector('.maplibregl-popup');
      if (popupElement) {
        const rect = popupElement.getBoundingClientRect();
        const clickX = e.originalEvent.clientX;
        const clickY = e.originalEvent.clientY;

        // If click is outside the popup, close it
        if (
          clickX < rect.left ||
          clickX > rect.right ||
          clickY < rect.top ||
          clickY > rect.bottom
        ) {
          popup.remove();
          if (map) {
            map.off('click', mapClickHandler);
          }
        }
      }
    };

    // Add the click handler to the map
    map.on('click', mapClickHandler);

    // Remove the click handler when the popup is closed
    popup.on('close', () => {
      map.off('click', mapClickHandler);
    });
  } catch (error) {
    console.error('Error processing pathogen data:', error);
  } finally {
    // Hide loading state
    isLoading.set(false);
  }
}

/**
 * Create HTML content for the raster popup
 * @param popupData The data to display in the popup
 * @returns HTML content for the popup
 */
function createRasterPopupContent(popupData: {
  prevalence: number;
  lowerBound: number;
  upperBound: number;
  ageRange: string;
  study: string;
  duration: string;
  source: string;
  sourceUrl: string;
}): string {
  return `
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
            <span class="value">${popupData.prevalence.toFixed(2)}%</span>
            <span class="confidence-interval">(${popupData.lowerBound.toFixed(2)}, ${popupData.upperBound.toFixed(2)})</span>
          </div>
          <div class="prevalence-label">Prevalence</div>
        </div>

        <div class="details-section">
          <div class="detail-row">
            <span class="detail-label">Age Range:</span>
            <span class="detail-value">${popupData.ageRange}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Study:</span>
            <span class="detail-value">${popupData.study}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Duration:</span>
            <span class="detail-value">${popupData.duration}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Source:</span>
            <span class="detail-value">
              ${popupData.sourceUrl ? `<a href="${popupData.sourceUrl}" target="_blank" rel="noopener noreferrer">${popupData.source}</a>` : popupData.source}
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}
