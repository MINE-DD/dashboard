/**
 * Mock GeoTIFF library for testing
 */

export class MockGeoTIFFImage {
	private width: number;
	private height: number;
	private bounds: number[];
	private data: Float32Array;

	constructor(
		width: number = 100,
		height: number = 100,
		bounds: number[] = [-180, -90, 180, 90]
	) {
		this.width = width;
		this.height = height;
		this.bounds = bounds;
		// Generate sample data
		this.data = new Float32Array(width * height);
		for (let i = 0; i < this.data.length; i++) {
			this.data[i] = Math.random();
		}
	}

	getWidth(): number {
		return this.width;
	}

	getHeight(): number {
		return this.height;
	}

	getBoundingBox(): number[] {
		return this.bounds;
	}

	getResolution(): [number, number] {
		const [west, south, east, north] = this.bounds;
		return [
			(east - west) / this.width,
			(north - south) / this.height
		];
	}

	getSamplesPerPixel(): number {
		return 1;
	}

	getGeoKeys(): any {
		return {
			GTModelTypeGeoKey: 2, // Geographic
			GeographicTypeGeoKey: 4326 // WGS84
		};
	}

	async readRasters(): Promise<Float32Array[]> {
		return [this.data];
	}
}

export class MockGeoTIFF {
	private image: MockGeoTIFFImage;

	constructor(image?: MockGeoTIFFImage) {
		this.image = image || new MockGeoTIFFImage();
	}

	async getImage(): Promise<MockGeoTIFFImage> {
		return this.image;
	}
}

/**
 * Mock GeoTIFF.fromUrl
 */
export async function fromUrl(_url: string): Promise<MockGeoTIFF> {
	return new MockGeoTIFF();
}

/**
 * Setup GeoTIFF mocks in global scope
 */
export function setupGeoTIFFMocks(): void {
	// @ts-ignore - Mock window.GeoTIFF
	global.window = global.window || {};
	(global.window as any).GeoTIFF = {
		fromUrl
	};
}

/**
 * Cleanup GeoTIFF mocks
 */
export function cleanupGeoTIFFMocks(): void {
	if (global.window && (global.window as any).GeoTIFF) {
		delete (global.window as any).GeoTIFF;
	}
}
