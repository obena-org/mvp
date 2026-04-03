import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// In dev, proxy /api calls to the Hono API server (pnpm dev:api).
		proxy: {
			'/api': 'http://localhost:3000',
		},
	},
});
