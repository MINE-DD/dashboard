import path from 'path';
// import adapter from 'svelte-adapter-bun';
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from "mdsvex";
import mdsvexConfig from './mdsvex.config.js'


/** @type {import('@sveltejs/kit').Config} */
const config = {

	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: [
		vitePreprocess(),
		mdsvex(mdsvexConfig),
	],
	// extensions: ['.svelte', '.md', '.svx'],
	extensions: [
		'.svelte',
		...mdsvexConfig.extensions
	],
	kit: {
		// https://kit.svelte.dev/docs/adapter-static
		adapter: adapter({
				runtime: 'edge',
				// fallback: '200.html', // may differ from host to host
			// dynamic_origin: true,
			// precompress: {
			// 	brotli: true,
			// 	gzip: true,
			// 	files: ['html', 'js', 'json', 'css', 'svg', 'xml', 'wasm']
			// }
		}),

		alias: {
			// these are the aliases and paths to them
			$api: path.resolve('./src/api'),
			$components: path.resolve('./src/lib/components'),
			$assets: path.resolve('./src/assets'),
			$content: path.resolve('./src/content'),
			$lib: path.resolve('./src/lib') // Explicitly define $lib
		}
	}
};

export default config;
