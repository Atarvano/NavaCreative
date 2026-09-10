import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';

// Auth router: Sesi = random session id in an HttpOnly cookie, backed by a
// D1 row. Logout deletes the row. Passwords are SHA-256(salt + password)
// via WebCrypto (Workers has no Node bcrypt); the salt lives per admin row.
// ponytail: SHA-256 fast hash, upgrade to scrypt/Argon2 via a WASM build or
// turnstile rate-limiting if brute-force becomes a real threat.

const SESSION_COOKIE = 'nava_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const te = new TextEncoder();
const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hashPassword(password, salt) {
  const digest = await crypto.subtle.digest('sha-256', te.encode(salt + ':' + password));
  return toHex(digest);
}

const randomId = () =>
  [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const cookieOpts = (c) => ({
  path: '/',
  httpOnly: true,
  maxAge: SESSION_TTL_SECONDS,
  sameSite: 'Lax',
  // Local dev serves http; production is always https.
  secure: new URL(c.req.url).protocol === 'https:',
});

// Guard for every /api/* route except /api/auth/login.
export const requireSession = createMiddleware(async (c, next) => {
  const sid = getCookie(c, SESSION_COOKIE);
  if (!sid) return c.json({ error: 'Sesi tidak valid. Silakan login.' }, 401);
  const row = await c.env.DB.prepare(
    'SELECT sessions.admin_id, sessions.expires_at, admins.username FROM sessions JOIN admins ON admins.id = sessions.admin_id WHERE sessions.id = ?',
  )
    .bind(sid)
    .first();
  if (!row || Date.parse(row.expires_at) < Date.now()) {
    if (row) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
    return c.json({ error: 'Sesi tidak valid. Silakan login.' }, 401);
  }
  c.set('adminId', row.admin_id);
  await next();
});

export function authRoutes(app) {
  app.post('/api/auth/login', async (c) => {
    const { username, password } = await c.req.json().catch(() => ({}));
    if (typeof username !== 'string' || typeof password !== 'string')
      return c.json({ error: 'Username dan password wajib diisi.' }, 400);
    const admin = await c.env.DB.prepare(
      'SELECT id, password_hash, password_salt, must_change_password FROM admins WHERE username = ?',
    )
      .bind(username)
      .first();
    const hash = admin
      ? await hashPassword(password, admin.password_salt)
      : await hashPassword('dummy', 'dummy');
    // Constant-shape failure: wrong username and wrong password look the same.
    if (!admin || hash !== admin.password_hash)
      return c.json({ error: 'Username atau password salah.' }, 401);
    const sid = randomId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    await c.env.DB.prepare(
      'INSERT INTO sessions (id, admin_id, expires_at) VALUES (?, ?, ?)',
    )
      .bind(sid, admin.id, expiresAt)
      .run();
    setCookie(c, SESSION_COOKIE, sid, cookieOpts(c));
    return c.json({ ok: true, must_change_password: admin.must_change_password === 1 });
  });

  app.post('/api/auth/logout', requireSession, async (c) => {
    const sid = getCookie(c, SESSION_COOKIE);
    if (sid) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
    // Must mirror the flags the cookie was set with, or the browser keeps it.
    const { httpOnly, sameSite, secure } = cookieOpts(c);
    deleteCookie(c, SESSION_COOKIE, { path: '/', httpOnly, sameSite, secure });
    return c.json({ ok: true });
  });

  app.post('/api/auth/ganti-password', requireSession, async (c) => {
    const { newPassword } = await c.req.json().catch(() => ({}));
    if (typeof newPassword !== 'string' || newPassword.length < 8)
      return c.json({ error: 'Password baru minimal 8 karakter.' }, 400);
    const salt = randomId().slice(0, 32);
    const hash = await hashPassword(newPassword, salt);
    await c.env.DB.prepare(
      'UPDATE admins SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?',
    )
      .bind(hash, salt, c.get('adminId'))
      .run();
    return c.json({ ok: true });
  });

  // Proof the guard is on: returns the logged-in username.
  app.get('/api/auth/me', requireSession, async (c) => {
    const row = await c.env.DB.prepare('SELECT username FROM admins WHERE id = ?')
      .bind(c.get('adminId'))
      .first();
    return c.json({ username: row?.username ?? null });
  });
}

export function guardApi(app) {
  // Everything under /api/* except login requires a session.
  app.use('/api/*', async (c, next) => {
    if (c.req.path === '/api/auth/login') return next();
    return requireSession(c, next);
  });
}
