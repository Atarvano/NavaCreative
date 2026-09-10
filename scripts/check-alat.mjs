// Local curl-equivalent checklist for ticket #41 (no wrangler account needed).
// Spins the Hono app against a tiny in-memory D1 sham (admins + sessions +
// alat + alat_servis; transaksi_baris absent until #44 → revenue stays 0),
// then runs the acceptance cases. Usage: node scripts/check-alat.mjs.
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

// --- D1 sham: auth tables + alat tables; transaksi_baris SHAM-throws so the
// API's try/catch keeps revenue at 0, exactly like real D1 pre-#44. ---
const admins = [{ id: 1, username: 'admin', password_hash: 'h', password_salt: 's', must_change_password: 0 }];
const sessions = [{ id: 'sess-1', admin_id: 1, expires_at: new Date(Date.now() + 864e5).toISOString() }];
const alat = [];
const servis = [];
let seq = 0;
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
        if (s.includes('FROM sessions JOIN admins'))
          return sessions.filter((x) => x.id === a[0]).map((x) => ({ ...x, username: 'admin' }))[0] ?? null;
        if (s.includes('FROM admins WHERE id')) return admins.find((r) => r.id === a[0]) ?? null;
        if (s.includes('FROM alat WHERE id = ?')) return alat.find((r) => r.id === a[0]) ?? null;
        if (s.includes('SELECT id FROM alat WHERE id'))
          return alat.some((r) => r.id === a[0]) ? { id: a[0] } : null;
        if (s.includes('SUM(biaya)')) return { s: servis.filter((x) => x.alat_id === a[0]).reduce((t, x) => t + x.biaya, 0) };
        if (s.includes('FROM transaksi_baris')) throw new Error('no such table: transaksi_baris');
        if (s.includes('FROM alat_servis WHERE id'))
          return servis.find((r) => r.id === a[0]) ?? null;
        throw new Error(`sham: unhandled SELECT ${s}`);
      },
      async all() {
        const [s, a] = [this._sql, this._args];
        if (s.includes('FROM alat ORDER BY')) return { results: [...alat].sort((x, y) => x.id - y.id) };
        if (s.includes('FROM alat_servis WHERE alat_id'))
          return { results: servis.filter((x) => x.alat_id === a[0]).sort((x, y) => x.id - y.id) };
        throw new Error(`sham: unhandled ALL ${s}`);
      },
      async run() {
        const [s, a] = [this._sql, this._args];
        // NOTE: 'INSERT INTO alat_servis' must be checked before 'INSERT INTO
        // alat ' — the former starts with the latter's prefix ('alat_servis'
        // begins with 'alat').
        if (s.startsWith('INSERT INTO alat_servis')) {
          const row = { id: ++seq + 1000, alat_id: a[0], tanggal: a[1], keterangan: a[2], biaya: a[3] };
          servis.push(row);
          return { meta: { last_row_id: row.id } };
        }
        if (s.startsWith('INSERT INTO alat ')) {
          const row = { id: ++seq, nama: a[0], harga_beli: a[1], tarif_event: a[2], is_active: 1, created_at: 'now' };
          alat.push(row);
          return { meta: { last_row_id: row.id } };
        }
        if (s.startsWith('UPDATE alat SET')) {
          Object.assign(alat.find((r) => r.id === a[4]), { nama: a[0], harga_beli: a[1], tarif_event: a[2], is_active: a[3] });
          return {};
        }
        throw new Error(`sham: unhandled RUN ${s}`);
      },
    };
  },
};

const authed = { headers: { cookie: 'nava_session=sess-1' } };
const json = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...authed.headers }, body: JSON.stringify(body) });
const call = (path, opts = {}) =>
  app.request(path, { ...opts, headers: { ...(opts.headers ?? {}), host: 'localhost' } }, { DB });

// 1. Guard: all alat routes 401 without a session.
{
  const paths = ['/api/alat', '/api/alat/1/servis'];
  for (const p of paths) {
    const res = await call(p);
    check(`401 tanpa sesi: GET ${p}`, () => must(res.status === 401, `status ${res.status}`));
  }
  const post = await call('/api/alat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nama: 'X', harga_beli: 1, tarif_event: 1 }) });
  check('401 tanpa sesi: POST /api/alat', () => must(post.status === 401, `status ${post.status}`));
}

// 2. Add Alat → modal equals harga_beli, no modal column accepted.
{
  const res = await call('/api/alat', json({ nama: 'Sony NXR-100', harga_beli: 10_000_000, tarif_event: 350_000, modal: 1 }));
  const body = await res.json();
  check('tambah alat → modal = harga_beli', () => {
    must(res.status === 201, `status ${res.status}`);
    must(body.modal === 10_000_000, `modal ${body.modal}`);
    must(body.pendapatan === 0, `pendapatan ${body.pendapatan}`);
    must(body.balik_modal === false, 'badge harus false');
    must(!('modal_input' in body) && body.modal !== 1, 'modal manual bocor');
  });
}

// 3. Validation: nama kosong, angka negatif → 400.
{
  const e1 = await call('/api/alat', json({ nama: '  ', harga_beli: 1, tarif_event: 1 }));
  const e2 = await call('/api/alat', json({ nama: 'X', harga_beli: -1, tarif_event: 1 }));
  check('validasi tambah alat → 400', () => {
    must(e1.status === 400, `nama kosong: ${e1.status}`);
    must(e2.status === 400, `negatif: ${e2.status}`);
  });
}

// 4. Servis → modal grows; badge still false; history listed.
{
  const s = await call('/api/alat/1/servis', json({ tanggal: '2026-09-01', keterangan: 'Ganti kabel', biaya: 2_000_000 }));
  const list = await call('/api/alat', authed);
  const alat1 = (await list.json()).alat.find((a) => a.id === 1);
  const hist = await (await call('/api/alat/1/servis', authed)).json();
  check('servis 2jt → modal 12jt', () => {
    must(s.status === 201, `servis: ${s.status}`);
    must(alat1.modal === 12_000_000, `modal ${alat1.modal}`);
    must(alat1.balik_modal === false, 'badge harus masih false');
    must(hist.servis.length === 1 && hist.servis[0].biaya === 2_000_000, 'riwayat servis hilang');
  });
}

// 5. Servis validation: bad date, negative cost, unknown alat → 400/404.
{
  const d = await call('/api/alat/1/servis', json({ tanggal: '01-09-2026', biaya: 1 }));
  const n = await call('/api/alat/1/servis', json({ tanggal: '2026-09-01', biaya: -5 }));
  const u = await call('/api/alat/99/servis', json({ tanggal: '2026-09-01', biaya: 1 }));
  check('validasi servis → 400/404', () => {
    must(d.status === 400, `tanggal: ${d.status}`);
    must(n.status === 400, `biaya: ${n.status}`);
    must(u.status === 404, `unknown: ${u.status}`);
  });
}

// 6. Archive (PATCH is_active=0) keeps the row; no DELETE route exists.
{
  const p = await call('/api/alat/1', { method: 'PATCH', headers: { 'content-type': 'application/json', ...authed.headers }, body: JSON.stringify({ is_active: false }) });
  const body = await p.json();
  const del = await call('/api/alat/1', { method: 'DELETE', ...authed });
  check('arsip tanpa hapus', () => {
    must(p.status === 200 && body.is_active === 0, `arsip: ${p.status}`);
    must(del.status === 404, `DELETE harus 404 (tak ada route): ${del.status}`);
  });
}

// 7. List carries modal/pendapatan/balik_modal per alat.
{
  await call('/api/alat', json({ nama: 'Tripod B-18', harga_beli: 500_000, tarif_event: 50_000 }));
  const res = await call('/api/alat', authed);
  const { alat: rows } = await res.json();
  check('list bawa turunan per alat', () => {
    must(res.status === 200, `status ${res.status}`);
    must(rows.length === 2, `count ${rows.length}`);
    must(rows.every((a) => 'modal' in a && 'pendapatan' in a && 'balik_modal' in a), 'turunan hilang');
  });
}

process.exit(failures ? 1 : 0);
