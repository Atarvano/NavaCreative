import { Hono } from 'hono';
import { authRoutes, guardApi } from './auth.js';
import { alatRoutes } from './alat.js';
import { paketRoutes } from './paket.js';
import { rabRoutes } from './rab.js';
import { settingsRoutes } from './settings.js';

// Single Worker (ADR-0011): the Hono app owns /api/* only. Static files
// (dist/ via the wrangler `assets` directory) are served by Cloudflare
// before this worker runs, on the same domain — so the session cookie stays
// first-party with no CORS.
const app = new Hono();

authRoutes(app);
alatRoutes(app);
paketRoutes(app);
rabRoutes(app);
settingsRoutes(app);
guardApi(app);

app.notFound((c) => c.json({ error: 'Tidak ditemukan.' }, 404));

export default app;
export { app };
