import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// SPA mode: serve index.html for all unmatched routes so client-side
			// routing works when the app is served from src/server.ts.
			fallback: 'index.html',
		}),
	},
};

export default config;
