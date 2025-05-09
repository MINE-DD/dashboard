import path from 'path';
// import adapter from 'svelte-adapter-bun';
import adapter from '@sveltejs/adapter-static';
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
			// default options are shown
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true

		}),
		paths: {
			base: process.argv.includes('dev') ? '' : process.env.BASE_PATH
		},

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
