// Local curl-equivalent checklist for ticket #40 (no wrangler account needed).
// Spins the Hono app against a tiny in-memory D1 sham implementing the
// prepare().bind().first()/run() surface api/auth.js uses, then runs the
// acceptance cases. Usage: node scripts/check-auth.mjs (exit 0 = all pass).
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;

const { app } = await import('../api/index.js');

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name}: ${e.message}`);
  }
};
const must = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// --- Minimal D1 sham: admins + sessions only (ticket #40 scope) ---
const admins = [];
const sessions = [];
const DB = {
  prepare(sql) {
    return {
      _sql: sql,
      _args: [],
      bind(...args) {
        this._args = args;
        return this;
      },
      async first() {
        const [s, a] = [this._sql, this._args];
        if (s.includes('FROM admins WHERE username'))
          return admins.find((r) => r.username === a[0]) ?? null;
        if (s.includes('FROM sessions JOIN admins'))
          return sessions
            .filter((x) => x.id === a[0])
            .map((x) => ({ ...x, username: admins.find((r) => r.id === x.admin_id)?.username }))[0] ?? null;
        if (s.includes('FROM admins WHERE id'))
          return admins.find((r) => r.id === a[0]) ?? null;
        throw new Error(`sham: unhandled SELECT ${s}`);
      },
      async run() {
        const [s, a] = [this._sql, this._args];
        if (s.startsWith('INSERT INTO sessions')) sessions.push({ id: a[0], admin_id: a[1], expires_at: a[2] });
        else if (s.startsWith('DELETE FROM sessions')) {
          const i = sessions.findIndex((x) => x.id === a[0]);
          if (i >= 0) sessions.splice(i, 1);
        } else if (s.startsWith('UPDATE admins'))
          Object.assign(admins.find((r) => r.id === a[2]), { password_hash: a[0], password_salt: a[1], must_change_password: 0 });
        else throw new Error(`sham: unhandled RUN ${s}`);
        return {};
      },
    };
  },
};

// Seed admin/admin123 (must_change_password=1), same shape as seed-admin.mjs.
const salt = 'testsalt';
const hash = [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:admin123`)))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');
admins.push({ id: 1, username: 'admin', password_hash: hash, password_salt: salt, must_change_password: 1 });

const call = (path, opts = {}) =>
  app.request(path, { ...opts, headers: { ...(opts.headers ?? {}), host: 'localhost' } }, { DB });

const cookieOf = (res) => (res.headers.get('set-cookie') ?? '').split(';')[0];

// 1. Wrong password → 401, no cookie.
{
  const res = await call('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'salah' }) });
  const body = await res.json();
  check('wrong password → 401, no cookie', () => {
    must(res.status === 401, `status ${res.status}`);
    must(body.error, 'missing error message');
    must(!res.headers.get('set-cookie'), 'cookie must not be set');
  });
}

// 2. Unknown username looks identical to wrong password.
{
  const res = await call('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'siapa', password: 'x' }) });
  check('unknown username → same 401 shape', () => must(res.status === 401, `status ${res.status}`));
}

// 3. Correct one-time password → cookie + must_change_password.
let cookie = '';
{
  const res = await call('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
  const body = await res.json();
  check('one-time login → cookie + must_change flag', () => {
    must(res.status === 200, `status ${res.status}`);
    must(body.must_change_password === true, 'flag missing');
    cookie = cookieOf(res);
    must(cookie.startsWith('nava_session='), `bad cookie ${cookie}`);
    must(res.headers.get('set-cookie').includes('HttpOnly'), 'missing HttpOnly');
  });
}

// 4. Guard works: /api/auth/me with cookie → 200; without → 401.
{
  const okRes = await call('/api/auth/me', { headers: { cookie } });
  const badRes = await call('/api/auth/me');
  check('guard: cookie → 200, none → 401', () => {
    must(okRes.status === 200, `with cookie: ${okRes.status}`);
    must(badRes.status === 401, `without: ${badRes.status}`);
  });
}

// 5. Forced password change → old stops, new works.
{
  const ch = await call('/api/auth/ganti-password', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ newPassword: 'barukuuu' }) });
  const oldLogin = await call('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
  const newLogin = await call('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'barukuuu' }) });
  const newBody = await newLogin.json();
  check('password change rotates credential', () => {
    must(ch.status === 200, `change: ${ch.status}`);
    must(oldLogin.status === 401, `old password still works: ${oldLogin.status}`);
    must(newLogin.status === 200 && newBody.must_change_password === false, 'new login bad');
  });
  cookie = cookieOf(newLogin);
}

// 6. Short new password rejected.
{
  const res = await call('/api/auth/ganti-password', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ newPassword: 'pendek' }) });
  check('short password → 400', () => must(res.status === 400, `status ${res.status}`));
}

// 7. Logout deletes the session; reused cookie → 401.
{
  const out = await call('/api/auth/logout', { method: 'POST', headers: { cookie } });
  const reuse = await call('/api/auth/me', { headers: { cookie } });
  check('logout kills session', () => {
    must(out.status === 200, `logout: ${out.status}`);
    must(reuse.status === 401, `reused cookie: ${reuse.status}`);
  });
}

process.exit(failures ? 1 : 0);
