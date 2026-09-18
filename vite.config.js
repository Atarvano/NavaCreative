import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const rootDir = import.meta.dirname;

// Plain Svelte + Vite multi-page app (ADR-0006): one entry per page, static
// dist/ output, host anywhere. No SvelteKit, no SSR, no router.
export default defineConfig({
  // HTML entries live in pages/; make it the Vite root so each entry emits at
  // the dist/ root (index.html, dashboard.html, ...) exactly as before.
  root: resolve(rootDir, "pages"),
  publicDir: resolve(rootDir, "public"),
  // Relative asset URLs so dist/ loads from any static host or subpath.
  base: "./",
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: [
      // Entry HTML uses root-absolute /src/*.js; map it back to the repo src/.
      { find: /^\/src\//, replacement: `${resolve(rootDir, "src")}/` },
    ],
  },
  build: {
    outDir: resolve(rootDir, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Ticket 01: index only. Ticket 05: the five Service pages.
        main: resolve(rootDir, "pages/index.html"),
        "photo-video": resolve(rootDir, "pages/photo-video.html"),
        "photo-product": resolve(rootDir, "pages/photo-product.html"),
        "graphic-design": resolve(rootDir, "pages/graphic-design.html"),
        "social-media": resolve(rootDir, "pages/social-media.html"),
        "live-streaming": resolve(rootDir, "pages/live-streaming.html"),
        // Rental dashboard: login page + dashboard entries.
        login: resolve(rootDir, "pages/login.html"),
        dashboard: resolve(rootDir, "pages/dashboard.html"),
      },
    },
  },
});
