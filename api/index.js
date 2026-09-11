import { Hono } from 'hono';
import { authRoutes, guardApi } from './auth.js';

// Single Worker (ADR-0011): the Hono app owns /api/* only. Static files
// (dist/ via the wrangler `assets` directory) are served by Cloudflare
// before this worker runs, on the same domain — so the session cookie stays
// first-party with no CORS.
const app = new Hono();

authRoutes(app);
guardApi(app);

app.notFound((c) => c.json({ error: 'Tidak ditemukan.' }, 404));

export default app;
export { app };
