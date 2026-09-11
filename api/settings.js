import { requireSession } from './auth.js';

// Settings router: identity + single bank account text (Q23, M6). Logo is a
// static file (B5). GET feeds document print views (#43+); PUT feeds the
// Settings page (#46). Keys allowlisted — no arbitrary key writes.
const SETTING_KEYS = ['nama', 'hp', 'email', 'bank', 'norek', 'atas_nama'];

export function settingsRoutes(app) {
  app.get('/api/settings', requireSession, async (c) => {
    const { results } = await c.env.DB.prepare('SELECT key, value FROM settings').all();
    return c.json({ settings: Object.fromEntries(results.map((r) => [r.key, r.value])) });
  });

  app.put('/api/settings', requireSession, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    for (const k of SETTING_KEYS) {
      if (body[k] === undefined) continue;
      if (typeof body[k] !== 'string')
        return c.json({ error: `${k} harus teks.` }, 400);
      await c.env.DB.prepare('UPDATE settings SET value = ? WHERE key = ?')
        .bind(body[k], k)
        .run();
    }
    const { results } = await c.env.DB.prepare('SELECT key, value FROM settings').all();
    return c.json({ settings: Object.fromEntries(results.map((r) => [r.key, r.value])) });
  });
}
