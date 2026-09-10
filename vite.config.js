import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const rootDir = import.meta.dirname;

// Plain Svelte + Vite multi-page app (ADR-0006): one entry per page, static
// dist/ output, host anywhere. No SvelteKit, no SSR, no router.
export default defineConfig({
  // Relative asset URLs so dist/ loads from any static host or subpath.
  base: './',
  plugins: [tailwindcss(), svelte()],
  build: {
    rollupOptions: {
      input: {
        // Ticket 01: index only. Ticket 05: the five Service pages.
        main: resolve(rootDir, 'index.html'),
        'photo-video': resolve(rootDir, 'photo-video.html'),
        'photo-product': resolve(rootDir, 'photo-product.html'),
        'graphic-design': resolve(rootDir, 'graphic-design.html'),
        'social-media': resolve(rootDir, 'social-media.html'),
        'live-streaming': resolve(rootDir, 'live-streaming.html'),
        // Rental dashboard (ticket #40): login page entry.
        login: resolve(rootDir, 'login.html'),
      },
    },
  },
});
