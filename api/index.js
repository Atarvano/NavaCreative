import { Hono } from 'hono';
import { authRoutes } from './routes/auth.js';
import { alatRoutes } from './routes/alat.js';
import { paketRoutes } from './routes/paket.js';
import { rabRoutes } from './routes/rab.js';
import { transaksiRoutes } from './routes/transaksi.js';
import { invoiceRoutes } from './routes/invoice.js';
import { ringkasanRoutes } from './routes/ringkasan.js';
import { settingsRoutes } from './routes/settings.js';
import { notFound } from './lib/respond.js';

// Single Worker (ADR-0011): the Hono app owns /api/* only. Static files
// (dist/ via the wrangler `assets` directory) are served by Cloudflare
// before this worker runs, on the same domain — so the session cookie stays
// first-party with no CORS.
const app = new Hono();

authRoutes(app);
alatRoutes(app);
paketRoutes(app);
rabRoutes(app);
transaksiRoutes(app);
invoiceRoutes(app);
ringkasanRoutes(app);
settingsRoutes(app);
// ponytail: no global guardApi — every route carries requireSession
// itself, so the guard can't be silently shadowed by route order.

app.notFound(notFound);

export default app;
export { app };
