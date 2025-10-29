/**
 * Mock MapLibre GL JS for testing
 * Provides a simplified mock of the MapLibre Map API
 */

export class MockMap {
	private sources: Map<string, any> = new Map();
	private layers: Map<string, any> = new Map();
	private images: Map<string, any> = new Map();
	private style: any = null;

	addSource(id: string, source: any): this {
		this.sources.set(id, source);
		return this;
	}

	removeSource(id: string): this {
		this.sources.delete(id);
		return this;
	}

	getSource(id: string): any {
		return this.sources.get(id);
	}

	addLayer(layer: any): this {
		this.layers.set(layer.id, layer);
		return this;
	}

	removeLayer(id: string): this {
		this.layers.delete(id);
		return this;
	}

	getLayer(id: string): any {
		return this.layers.get(id);
	}

	setLayoutProperty(layerId: string, property: string, value: any): this {
		const layer = this.layers.get(layerId);
		if (layer) {
			if (!layer.layout) layer.layout = {};
			layer.layout[property] = value;
		}
		return this;
	}

	setPaintProperty(layerId: string, property: string, value: any): this {
		const layer = this.layers.get(layerId);
		if (layer) {
			if (!layer.paint) layer.paint = {};
			layer.paint[property] = value;
		}
		return this;
	}

	addImage(id: string, image: any): this {
		this.images.set(id, image);
		return this;
	}

	removeImage(id: string): this {
		this.images.delete(id);
		return this;
	}

	hasImage(id: string): boolean {
		return this.images.has(id);
	}

	listImages(): string[] {
		return Array.from(this.images.keys());
	}

	setStyle(style: any): this {
		this.style = style;
		return this;
	}

	getStyle(): any {
		return this.style;
	}

	flyTo(_options: any): this {
		return this;
	}

	easeTo(_options: any): this {
		return this;
	}

	fitBounds(_bounds: any, _options?: any): this {
		return this;
	}

	getBounds(): any {
		return {
			getWest: () => -180,
			getSouth: () => -90,
			getEast: () => 180,
			getNorth: () => 90
		};
	}

	getZoom(): number {
		return 2;
	}

	setZoom(_zoom: number): this {
		return this;
	}

	getCenter(): { lng: number; lat: number } {
		return { lng: 0, lat: 0 };
	}

	setCenter(_center: [number, number]): this {
		return this;
	}

	on(_type: string, _listener: any): this {
		return this;
	}

	off(_type: string, _listener: any): this {
		return this;
	}

	once(_type: string, _listener: any): this {
		return this;
	}

	remove(): void {
		this.sources.clear();
		this.layers.clear();
		this.images.clear();
	}
}

/**
 * Create a mock MapLibre map instance
 */
export function createMockMap(): MockMap {
	return new MockMap();
}
