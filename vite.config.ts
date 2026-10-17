import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const segment = (process.env.BASE_PATH ?? '').replace(/^\/+|\/+$/g, '');
const base = segment ? (`/${segment}` as const) : '';

export default defineConfig({
	plugins: [
		sveltekit({
			paths: { base },
			adapter: adapter({ fallback: 'index.html' })
		})
	]
});
