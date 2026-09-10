import { requireSession } from './auth.js';

// Settings router: identity + single bank account text (Q23, M6). Logo is a
// static file (B5). Read is needed by document print views (#43+); writes
// land with the Settings page (#46).
export function settingsRoutes(app) {
  app.get('/api/settings', requireSession, async (c) => {
    const { results } = await c.env.DB.prepare('SELECT key, value FROM settings').all();
    return c.json({ settings: Object.fromEntries(results.map((r) => [r.key, r.value])) });
  });
}
