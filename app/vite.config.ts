import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import Icons from 'unplugin-icons/vite'
import VitePluginRestart from 'vite-plugin-restart';


export default defineConfig({
	server: {
		host: '0.0.0.0',
		port: 4000,
		fs: {
			// Allow serving files from one level up to the project root
			allow: ['..']
		}
	},
	plugins: [
		VitePluginRestart({ restart: ['./content/**'] }),
		sveltekit(),
		Icons({
			compiler: 'svelte',
			autoInstall: true,
		}),
	],
	// Set base path for GitHub Pages deployment, will be the repository name
	base: process.env.BASE_PATH || '',
	// Explicitly mark geotiff as external to fix the build error
	build: {
		rollupOptions: {
			external: ['geotiff']
		}
	},
	// optimizeDeps: {
	// 	disabled: true,
	// },
});
