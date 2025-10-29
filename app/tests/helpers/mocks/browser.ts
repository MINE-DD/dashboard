/**
 * Mock browser APIs for testing
 * Provides stubs for Canvas, Image, fetch, and other browser-specific APIs
 */

/**
 * Mock Canvas 2D Context
 */
export class MockCanvasRenderingContext2D {
	canvas: MockHTMLCanvasElement;
	fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
	strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
	lineWidth = 1;
	globalAlpha = 1;

	constructor(canvas: MockHTMLCanvasElement) {
		this.canvas = canvas;
	}

	clearRect(_x: number, _y: number, _width: number, _height: number): void {}

	fillRect(_x: number, _y: number, _width: number, _height: number): void {}

	strokeRect(_x: number, _y: number, _width: number, _height: number): void {}

	beginPath(): void {}

	closePath(): void {}

	moveTo(_x: number, _y: number): void {}

	lineTo(_x: number, _y: number): void {}

	arc(
		_x: number,
		_y: number,
		_radius: number,
		_startAngle: number,
		_endAngle: number
	): void {}

	fill(): void {}

	stroke(): void {}

	createImageData(width: number, height: number): ImageData {
		return {
			width,
			height,
			data: new Uint8ClampedArray(width * height * 4),
			colorSpace: 'srgb'
		};
	}

	putImageData(_imageData: ImageData, _dx: number, _dy: number): void {}

	getImageData(_sx: number, _sy: number, _sw: number, _sh: number): ImageData {
		return this.createImageData(_sw, _sh);
	}

	save(): void {}

	restore(): void {}

	scale(_x: number, _y: number): void {}

	rotate(_angle: number): void {}

	translate(_x: number, _y: number): void {}

	transform(
		_a: number,
		_b: number,
		_c: number,
		_d: number,
		_e: number,
		_f: number
	): void {}

	setTransform(
		_a: number,
		_b: number,
		_c: number,
		_d: number,
		_e: number,
		_f: number
	): void {}

	resetTransform(): void {}
}

/**
 * Mock HTMLCanvasElement
 */
export class MockHTMLCanvasElement {
	width = 300;
	height = 150;
	private _context: MockCanvasRenderingContext2D | null = null;
	private static _counter = 0;

	getContext(contextId: string): MockCanvasRenderingContext2D | null {
		if (contextId === '2d') {
			if (!this._context) {
				this._context = new MockCanvasRenderingContext2D(this);
			}
			return this._context;
		}
		return null;
	}

	toDataURL(_type?: string, _quality?: number): string {
		// Generate unique data URLs based on canvas dimensions
		// This ensures different canvas sizes produce different URLs
		MockHTMLCanvasElement._counter++;
		const uniqueId = `${this.width}x${this.height}-${MockHTMLCanvasElement._counter}`;
		return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==${uniqueId}`;
	}

	toBlob(_callback: (blob: Blob | null) => void, _type?: string, _quality?: number): void {
		setTimeout(() => _callback(new Blob()), 0);
	}
}

/**
 * Mock HTMLImageElement
 */
export class MockHTMLImageElement {
	src = '';
	width = 0;
	height = 0;
	onload: (() => void) | null = null;
	onerror: ((error: Error) => void) | null = null;

	constructor() {
		// Simulate async image loading
		setTimeout(() => {
			if (this.onload) {
				this.width = 100;
				this.height = 100;
				this.onload();
			}
		}, 0);
	}
}

/**
 * Mock document.createElement
 */
export function mockDocumentCreateElement(tagName: string): any {
	if (tagName === 'canvas') {
		return new MockHTMLCanvasElement();
	}
	return {};
}

/**
 * Mock Image constructor
 */
export function mockImageConstructor(): MockHTMLImageElement {
	return new MockHTMLImageElement();
}

/**
 * Mock fetch API
 */
export function mockFetch(url: string, init?: RequestInit): Promise<Response> {
	return Promise.resolve(
		new Response(JSON.stringify({ url, init }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		})
	);
}

/**
 * Setup browser mocks in global scope
 */
export function setupBrowserMocks(): void {
	// @ts-ignore - Mock global document
	global.document = {
		createElement: mockDocumentCreateElement
	};

	// @ts-ignore - Mock global Image
	global.Image = mockImageConstructor;

	// @ts-ignore - Mock global fetch if not already present
	if (!global.fetch) {
		global.fetch = mockFetch as any;
	}
}

/**
 * Cleanup browser mocks
 */
export function cleanupBrowserMocks(): void {
	// @ts-ignore
	delete global.document;
	// @ts-ignore
	delete global.Image;
}
