// Local curl-equivalent checklist for ticket #42 (no wrangler account needed).
// Spins the Hono app against a tiny in-memory D1 sham (admins + sessions +
// paket + paket_baris seeded with the 4 Excel packages as-is, Y2 anomalies
// included), then runs the acceptance cases.
// Usage: node scripts/check-paket.mjs (exit 0 = all pass).
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

// --- D1 sham: auth + paket tables. Seed mirrors 0003_paket.sql totals; row
// detail only needs to be math-faithful, not a full 37-row copy. ---
const sessions = [{ id: 'sess-1', admin_id: 1, expires_at: new Date(Date.now() + 864e5).toISOString() }];
const paket = [
  { id: 1, nama: 'Paket 1 Camera', deskripsi: 'Live streaming 1 kamera', created_at: 'now' },
  { id: 2, nama: 'Paket 2 Camera', deskripsi: 'Live streaming 2 kamera', created_at: 'now' },
  { id: 3, nama: 'Paket 3 Camera', deskripsi: 'Live streaming 3 kamera', created_at: 'now' },
  { id: 4, nama: 'Paket 4 Camera', deskripsi: 'Live streaming 4 kamera', created_at: 'now' },
];
// [paket_id, kategori, jenis, nama, qty, satuan, harga_satuan] — sums must
// equal the Excel totals (verified against 0003 via node:sqlite).
const seedRows = [
  [1, 'PRODUCTION', 'alat', 'SONY FDR AX-40', 1, 'Unit', 100000],
  [1, 'PRODUCTION', 'alat', 'TRIPOD B-18', 1, 'Unit', 50000],
  [1, 'PRODUCTION', 'alat', 'WIRLES VIDEO', 1, 'Unit', 250000],
  [1, 'PRODUCTION', 'alat', 'STOP KONTAK', 1, 'Unit', 15000],
  [1, 'PRODUCTION', 'alat', 'INTERCOM SOLID SE 5S GLOBAL', 1, 'Unit', 200000],
  [1, 'PRODUCTION', 'jasa', 'OPERATOR', 2, 'Orang', 250000],
  [1, 'LOGISTIK', 'biaya', 'INTERNET', 1, 'Sesi', 150000],
  [1, 'MISC', 'biaya', 'OPERASIONAL LAIN', 1, 'Sesi', 150000],
  [2, 'PRODUCTION', 'alat', 'SONY FDR AX-40', 1, 'Unit', 150000],
  [2, 'PRODUCTION', 'alat', 'SONY NXR-100', 1, 'Unit', 350000],
  [2, 'PRODUCTION', 'alat', 'TRIPOD B-18', 1, 'Unit', 50000],
  [2, 'PRODUCTION', 'alat', 'WIRLES VIDEO', 2, 'Unit', 250000],
  [2, 'PRODUCTION', 'alat', 'STOP KONTAK', 2, 'Unit', 15000],
  [2, 'PRODUCTION', 'alat', 'INTERCOM SOLID SE 5S GLOBAL', 1, 'Unit', 250000],
  [2, 'PRODUCTION', 'jasa', 'OPERATOR', 3, 'Orang', 250000],
  [2, 'LOGISTIK', 'biaya', 'INTERNET', 1, 'Sesi', 150000],
  [2, 'MISC', 'biaya', 'OPERASIONAL LAIN', 1, 'Sesi', 150000],
  [3, 'PRODUCTION', 'alat', 'SONY FDR AX-40', 1, 'Unit', 100000],
  [3, 'PRODUCTION', 'alat', 'SONY NXR-100', 2, 'Unit', 350000],
  [3, 'PRODUCTION', 'alat', 'TRIPOD B-18', 1, 'Unit', 50000],
  [3, 'PRODUCTION', 'alat', 'WIRLES VIDEO', 3, 'Unit', 250000],
  [3, 'PRODUCTION', 'alat', 'STOP KONTAK', 3, 'Unit', 15000],
  [3, 'PRODUCTION', 'alat', 'SWITCHER', 1, 'Unit', 300000],
  [3, 'PRODUCTION', 'alat', 'INTERCOM SOLID SE 5S GLOBAL', 1, 'Unit', 250000],
  [3, 'PRODUCTION', 'jasa', 'OPERATOR', 4, 'Orang', 250000],
  [3, 'LOGISTIK', 'biaya', 'INTERNET', 1, 'Sesi', 150000],
  [3, 'MISC', 'biaya', 'OPERASIONAL LAIN', 1, 'Sesi', 150000],
  [4, 'PRODUCTION', 'alat', 'SONY FDR AX-40', 1, 'Unit', 100000],
  [4, 'PRODUCTION', 'alat', 'SONY NXR-100', 3, 'Unit', 350000],
  [4, 'PRODUCTION', 'alat', 'TRIPOD B-18', 1, 'Unit', 50000],
  [4, 'PRODUCTION', 'alat', 'WIRLES VIDEO', 3, 'Unit', 250000],
  [4, 'PRODUCTION', 'alat', 'STOP KONTAK', 4, 'Unit', 15000],
  [4, 'PRODUCTION', 'alat', 'SWITCHER', 1, 'Unit', 300000],
  [4, 'PRODUCTION', 'alat', 'INTERCOM SOLID SE 5S GLOBAL', 1, 'Unit', 250000],
  [4, 'PRODUCTION', 'jasa', 'OPERATOR', 5, 'Orang', 250000],
  [4, 'LOGISTIK', 'biaya', 'INTERNET', 1, 'Sesi', 150000],
  [4, 'MISC', 'biaya', 'OPERASIONAL LAIN', 1, 'Sesi', 150000],
];
let seq = 100;
const baris = seedRows.map((r) => ({ id: ++seq, paket_id: r[0], kategori: r[1], jenis: r[2], alat_id: null, nama: r[3], qty: r[4], satuan: r[5], harga_satuan: r[6] }));
let pseq = 4;

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
        if (s.includes('FROM admins WHERE id')) return { id: 1, username: 'admin' };
        if (s.includes('FROM paket WHERE id')) return paket.find((r) => r.id === a[0]) ?? null;
        throw new Error(`sham: unhandled SELECT ${s}`);
      },
      async all() {
        const [s, a] = [this._sql, this._args];
        if (s.includes('FROM paket ORDER BY')) return { results: [...paket] };
        if (s.includes('FROM paket_baris WHERE paket_id'))
          return { results: baris.filter((r) => r.paket_id === a[0]) };
        throw new Error(`sham: unhandled ALL ${s}`);
      },
      async run() {
        const [s, a] = [this._sql, this._args];
        if (s.startsWith('INSERT INTO paket ')) {
          const row = { id: ++pseq, nama: a[0], deskripsi: a[1], created_at: 'now' };
          paket.push(row);
          return { meta: { last_row_id: row.id } };
        }
        if (s.startsWith('INSERT INTO paket_baris')) {
          baris.push({ id: ++seq, paket_id: a[0], kategori: a[1], jenis: a[2], alat_id: a[3], nama: a[4], qty: a[5], satuan: a[6], harga_satuan: a[7] });
          return {};
        }
        if (s.startsWith('UPDATE paket SET')) {
          Object.assign(paket.find((r) => r.id === a[2]), { nama: a[0], deskripsi: a[1] });
          return {};
        }
        if (s.startsWith('DELETE FROM paket_baris')) {
          for (let i = baris.length - 1; i >= 0; i--) if (baris[i].paket_id === a[0]) baris.splice(i, 1);
          return {};
        }
        throw new Error(`sham: unhandled RUN ${s}`);
      },
    };
  },
};

const authed = { headers: { cookie: 'nava_session=sess-1' } };
const json = (body, method = 'POST') => ({ method, headers: { 'content-type': 'application/json', ...authed.headers }, body: JSON.stringify(body) });
const call = (path, opts = {}) =>
  app.request(path, { ...opts, headers: { ...(opts.headers ?? {}), host: 'localhost' } }, { DB });

// 1. Guard: paket routes 401 without a session.
{
  const g1 = await call('/api/paket');
  const g2 = await call('/api/paket', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  check('401 tanpa sesi', () => {
    must(g1.status === 401, `GET: ${g1.status}`);
    must(g2.status === 401, `POST: ${g2.status}`);
  });
}

// 2. Seed totals match the Excel (Y2 as-is, anomalies included).
{
  const res = await call('/api/paket', authed);
  const { paket: rows } = await res.json();
  const want = { 1: 1415000, 2: 2380000, 3: 3495000, 4: 4110000 };
  check('seed 4 paket = total Excel', () => {
    must(rows.length === 4, `count ${rows.length}`);
    for (const p of rows) must(p.total === want[p.id], `paket ${p.id}: ${p.total} != ${want[p.id]}`);
  });
  const p1 = rows.find((p) => p.id === 1);
  check('subtotal kategori paket 1', () => {
    must(p1.subtotal.PRODUCTION === 1115000, `PROD ${p1.subtotal.PRODUCTION}`);
    must(p1.subtotal.LOGISTIK === 150000 && p1.subtotal.MISC === 150000, 'LOG/MISC salah');
    must(p1.baris.length === 8, `baris ${p1.baris.length}`);
  });
}

// 3. GET one paket + 404 unknown.
{
  const res = await call('/api/paket/2', authed);
  const body = await res.json();
  const miss = await call('/api/paket/99', authed);
  check('GET satu paket + 404', () => {
    must(res.status === 200 && body.total === 2380000, `total ${body.total}`);
    must(miss.status === 404, `unknown: ${miss.status}`);
  });
}

// 4. Create paket with rows → total derived; unknown jenis → 400.
{
  const res = await call('/api/paket', json({ nama: 'Paket Custom', baris: [
    { kategori: 'PRODUCTION', jenis: 'jasa', nama: 'Shoot', qty: 2, satuan: 'Hari', harga_satuan: 500000 },
    { kategori: 'MISC', jenis: 'biaya', nama: 'Bensin', qty: 1, satuan: 'Trip', harga_satuan: 100000 },
  ] }));
  const body = await res.json();
  const bad = await call('/api/paket', json({ nama: 'X', baris: [{ jenis: 'sewa', nama: 'X', qty: 1, harga_satuan: 1 }] }));
  const empty = await call('/api/paket', json({ nama: '  ' }));
  check('buat paket + validasi jenis', () => {
    must(res.status === 201, `status ${res.status}`);
    must(body.total === 1100000, `total ${body.total}`);
    must(bad.status === 400, `jenis: ${bad.status}`);
    must(empty.status === 400, `nama: ${empty.status}`);
  });
}

// 5. PATCH rows wholesale (replace) + nama-only patch keeps rows.
{
  const rep = await call('/api/paket/5', json({ nama: 'Paket Custom v2', baris: [
    { kategori: 'PRODUCTION', jenis: 'alat', alat_id: 3, nama: 'NXR', qty: 1, satuan: 'Unit', harga_satuan: 350000 },
  ] }, 'PATCH'));
  const repBody = await rep.json();
  const keep = await call('/api/paket/5', json({ nama: 'Paket Custom v3' }, 'PATCH'));
  const keepBody = await keep.json();
  const miss = await call('/api/paket/99', json({ nama: 'X' }, 'PATCH'));
  check('PATCH ganti baris + nama saja', () => {
    must(repBody.total === 350000 && repBody.baris.length === 1 && repBody.baris[0].alat_id === 3, 'replace gagal');
    must(keepBody.total === 350000 && keepBody.baris.length === 1, 'nama-only harus pertahankan baris');
    must(miss.status === 404, `unknown: ${miss.status}`);
  });
}

// 6. No DELETE route by design (same spirit as B4).
{
  const del = await call('/api/paket/1', { method: 'DELETE', ...authed });
  check('DELETE paket → 404 (tak ada route)', () => must(del.status === 404, `status ${del.status}`));
}

process.exit(failures ? 1 : 0);
