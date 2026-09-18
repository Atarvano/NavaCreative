import {
  hashPassword,
  randomId,
  startSession,
  endSession,
  requireSession,
} from "../lib/session.js";
import { first, run, dbOf } from "../lib/db.js";
import { ok, fail } from "../lib/respond.js";

// Auth router: Session is a random ID in an HttpOnly cookie backed by D1.
// Passwords use SHA-256 with per-admin salt via WebCrypto.

export function authRoutes(app) {
  app.post("/api/auth/login", async (c) => {
    const { username, password } = await c.req.json().catch(() => ({}));
    if (typeof username !== "string" || typeof password !== "string")
      return fail(c, "Username dan password wajib diisi.", 400);
    const admin = await first(
      dbOf(c),
      "SELECT id, password_hash, password_salt, must_change_password FROM admins WHERE username = ?",
      username,
    );
    const hash = admin
      ? await hashPassword(password, admin.password_salt)
      : await hashPassword("dummy", "dummy");
    // Constant-shape failure: wrong username and wrong password look the same.
    if (!admin || hash !== admin.password_hash)
      return fail(c, "Username atau password salah.", 401);
    await startSession(c, admin.id);
    return ok(c, {
      ok: true,
      must_change_password: admin.must_change_password === 1,
    });
  });

  app.post("/api/auth/logout", requireSession, async (c) => {
    await endSession(c);
    return ok(c, { ok: true });
  });

  app.post("/api/auth/ganti-password", requireSession, async (c) => {
    const { newPassword } = await c.req.json().catch(() => ({}));
    if (typeof newPassword !== "string" || newPassword.length < 8)
      return fail(c, "Password baru minimal 8 karakter.", 400);
    const salt = randomId().slice(0, 32);
    const hash = await hashPassword(newPassword, salt);
    await run(
      dbOf(c),
      "UPDATE admins SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?",
      hash,
      salt,
      c.get("adminId"),
    );
    return ok(c, { ok: true });
  });

  // Proof the guard is on: returns the logged-in username.
  app.get("/api/auth/me", requireSession, async (c) => {
    const row = await first(
      dbOf(c),
      "SELECT username FROM admins WHERE id = ?",
      c.get("adminId"),
    );
    return ok(c, { username: row?.username ?? null });
  });
}
