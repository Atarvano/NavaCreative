import { requireSession } from "../lib/session.js";
import { all, run, dbOf } from "../lib/db.js";
import { ok, fail } from "../lib/respond.js";

// Settings router: identity + single bank account text (Q23, M6). Logo is a
// static file (B5). GET feeds document print views (#43+); PUT feeds the
// Settings page (#46). Keys allowlisted — no arbitrary key writes.
const SETTING_KEYS = ["nama", "hp", "email", "bank", "norek", "atas_nama"];

export function settingsRoutes(app) {
  app.get("/api/settings", requireSession, async (c) => {
    const { results } = await all(dbOf(c), "SELECT key, value FROM settings");
    return ok(c, {
      settings: Object.fromEntries(results.map((r) => [r.key, r.value])),
    });
  });

  app.put("/api/settings", requireSession, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    for (const k of SETTING_KEYS) {
      if (body[k] === undefined) continue;
      if (typeof body[k] !== "string") return fail(c, `${k} harus teks.`, 400);
      await run(
        dbOf(c),
        "UPDATE settings SET value = ? WHERE key = ?",
        body[k],
        k,
      );
    }
    const { results } = await all(dbOf(c), "SELECT key, value FROM settings");
    return ok(c, {
      settings: Object.fromEntries(results.map((r) => [r.key, r.value])),
    });
  });
}
