import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

const rootDir = import.meta.dirname;

// Plain Svelte + Vite multi-page app (ADR-0006): one entry per page, static
// dist/ output, host anywhere. No SvelteKit, no SSR, no router.
export default defineConfig({
  // Relative asset URLs so dist/ loads from any static host or subpath.
  base: './',
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        // Ticket 01: index only. Service-page entries land in ticket 05.
        main: resolve(rootDir, 'index.html'),
      },
    },
  },
});
