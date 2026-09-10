// Local curl-equivalent checklist for ticket #43 (no wrangler account needed).
// Spins the Hono app against a tiny in-memory D1 sham (admins + sessions +
// paket seed rows + rab/transaksi/settings), then runs the acceptance cases.
// Usage: node scripts/check-rab.mjs (exit 0 = all pass).
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

const sessions = [{ id: 'sess-1', admin_id: 1, expires_at: new Date(Date.now() + 864e5).toISOString() }];
// Paket 2 Camera rows (subset, math-faithful): total 2.380.000.
const paketRows = [
  { id: 1, paket_id: 2, kategori: 'PRODUCTION', jenis: 'alat', alat_id: null, nama: 'SONY NXR-100', qty: 1, satuan: 'Unit', harga_satuan: 350000 },
  { id: 2, paket_id: 2, kategori: 'PRODUCTION', jenis: 'jasa', alat_id: null, nama: 'OPERATOR', qty: 3, satuan: 'Orang', harga_satuan: 250000 },
  { id: 3, paket_id: 2, kategori: 'LOGISTIK', jenis: 'biaya', alat_id: null, nama: 'INTERNET', qty: 1, satuan: 'Sesi', harga_satuan: 150000 },
];
const rab = [];
const rabBaris = [];
const transaksi = [];
const transaksiBaris = [];
const settings = [
  { key: 'nama', value: 'Nava Production' },
  { key: 'hp', value: '085817999140' },
  { key: 'email', value: 'navaproduction9@gmail.com' },
  { key: 'bank', value: 'BCA' },
  { key: 'norek', value: '8335463109' },
  { key: 'atas_nama', value: 'Luthfi Ahmad Zaidan' },
];
let rseq = 0, bseq = 0, tseq = 0;

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
        if (s.includes('FROM paket WHERE id')) return a[0] === 2 ? { id: 2, nama: 'Paket 2 Camera' } : null;
        if (s.includes('FROM rab WHERE id')) return rab.find((r) => r.id === a[0]) ?? null;
        if (s.includes('FROM transaksi WHERE rab_id')) {
          const t = transaksi.find((t) => t.rab_id === a[0]);
          return t ? { id: t.id } : null;
        }
        if (s.includes('FROM transaksi WHERE id')) return transaksi.find((t) => t.id === a[0]) ?? null;
        if (s.includes('FROM settings')) return { results: [...settings] };
        throw new Error(`sham: unhandled SELECT ${s}`);
      },
      async all() {
        const [s, a] = [this._sql, this._args];
        if (s.includes('FROM settings')) return { results: [...settings] };
        if (s.includes('FROM rab ORDER BY')) return { results: [...rab].sort((x, y) => y.id - x.id) };
        if (s.includes('FROM paket_baris WHERE paket_id'))
          return { results: paketRows.filter((r) => r.paket_id === a[0]) };
        if (s.includes('FROM rab_baris WHERE rab_id') && s.includes('qty, harga_satuan'))
          return { results: rabBaris.filter((r) => r.rab_id === a[0]).map((r) => ({ qty: r.qty, harga_satuan: r.harga_satuan })) };
        if (s.includes('FROM rab_baris WHERE rab_id'))
          return { results: rabBaris.filter((r) => r.rab_id === a[0]) };
        throw new Error(`sham: unhandled ALL ${s}`);
      },
      async run() {
        const [s, a] = [this._sql, this._args];
        if (s.startsWith('INSERT INTO rab ')) {
          const row = { id: ++rseq, nomor: null, nama_project: a[0], tanggal_rab: a[1], nama_client: a[2], perusahaan_client: a[3], status: 'draft', diskon: a[4], total: 0, catatan: a[5] };
          rab.push(row);
          return { meta: { last_row_id: row.id } };
        }
        if (s.startsWith('UPDATE rab SET nomor')) {
          Object.assign(rab.find((r) => r.id === a[1]), { nomor: a[0], total: 0 });
          return {};
        }
        if (s.startsWith('INSERT INTO rab_baris')) {
          rabBaris.push({ id: ++bseq, rab_id: a[0], kategori: a[1], jenis: a[2], alat_id: a[3], nama: a[4], qty: a[5], satuan: a[6], harga_satuan: a[7] });
          return {};
        }
        if (s.includes("UPDATE rab SET status = 'approved'")) {
          Object.assign(rab.find((r) => r.id === a[0]), { status: 'approved' });
          return {};
        }
        if (s.startsWith('UPDATE rab SET status = ?')) {
          Object.assign(rab.find((r) => r.id === a[1]), { status: a[0] });
          return {};
        }
        if (s.startsWith('UPDATE rab SET total')) {
          Object.assign(rab.find((r) => r.id === a[1]), { total: a[0] });
          return {};
        }
        if (s.startsWith('UPDATE rab SET diskon')) {
          Object.assign(rab.find((r) => r.id === a[2]), { diskon: a[0], total: a[1] });
          return {};
        }
        if (s.startsWith('UPDATE rab SET catatan')) {
          Object.assign(rab.find((r) => r.id === a[1]), { catatan: a[0] });
          return {};
        }
        // Header edits: UPDATE rab SET <allowlisted-field> = ? ... (api/rab.js
        // builds the column from a fixed allowlist, same shape as the field).
        const hm = s.match(/^UPDATE rab SET (nama_project|nama_client|perusahaan_client|tanggal_rab) = \?,/);
        if (hm) {
          Object.assign(rab.find((r) => r.id === a[1]), { [hm[1]]: a[0] });
          return {};
        }
        if (s.startsWith('DELETE FROM rab_baris')) {
          for (let i = rabBaris.length - 1; i >= 0; i--) if (rabBaris[i].rab_id === a[0]) rabBaris.splice(i, 1);
          return {};
        }
        if (s.startsWith('INSERT INTO transaksi ')) {
          const row = { id: ++tseq, rab_id: a[0], nama_project: a[1], nama_client: a[2], perusahaan_client: a[3], status: 'terjadwal', diskon: a[4], total: a[5] };
          transaksi.push(row);
          return { meta: { last_row_id: row.id } };
        }
        if (s.startsWith('INSERT INTO transaksi_baris')) {
          transaksiBaris.push({ transaksi_id: a[0], kategori: a[1], jenis: a[2], alat_id: a[3], nama: a[4], qty: a[5], satuan: a[6], harga_satuan: a[7] });
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

// 1. Guard: rab routes 401 without a session.
{
  const g1 = await call('/api/rab');
  const g2 = await call('/api/rab', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  check('401 tanpa sesi', () => {
    must(g1.status === 401, `GET: ${g1.status}`);
    must(g2.status === 401, `POST: ${g2.status}`);
  });
}

// 2. ke-rab prefills Paket 2 rows.
{
  const res = await call('/api/paket/2/ke-rab', authed);
  const body = await res.json();
  const miss = await call('/api/paket/99/ke-rab', authed);
  check('ke-rab prefill paket 2', () => {
    must(res.status === 200, `status ${res.status}`);
    must(body.baris.length === 3, `baris ${body.baris.length}`);
    must(body.baris.reduce((t, b) => t + b.qty * b.harga_satuan, 0) === 1250000, 'math prefill salah');
    must(miss.status === 404, `unknown: ${miss.status}`);
  });
}

// 3. Create RAB: total = rows − discount, nomor from id, flat (no margin).
{
  const res = await call('/api/rab', json({
    nama_project: 'Nikahan Soleh', tanggal_rab: '2026-08-02', nama_client: 'Soleh Permana',
    diskon: 50000, catatan: 'Include file edit',
    baris: [
      { kategori: 'PRODUCTION', jenis: 'alat', nama: 'Live Streaming 2 camera', qty: 1, satuan: 'Hari', harga_satuan: 3200000 },
      { kategori: 'LOGISTIK', jenis: 'biaya', nama: 'Transportasi', qty: 1, satuan: 'Hari', harga_satuan: 100000 },
    ],
  }));
  const body = await res.json();
  check('buat RAB: total flat + nomor', () => {
    must(res.status === 201, `status ${res.status}`);
    must(body.total === 3250000, `total ${body.total}`);
    must(body.nomor === 'RAB-2026-0001', `nomor ${body.nomor}`);
    must(body.status === 'draft', 'harus draft');
    must(!('margin' in body) && !('ppn' in body), 'margin/ppn bocor');
  });
}

// 4. Validation: missing project/client, bad date, bad row, bad discount.
{
  const e1 = await call('/api/rab', json({ nama_client: 'X', tanggal_rab: '2026-08-02' }));
  const e2 = await call('/api/rab', json({ nama_project: 'P', nama_client: 'X', tanggal_rab: '02-08-2026' }));
  const e3 = await call('/api/rab', json({ nama_project: 'P', nama_client: 'X', tanggal_rab: '2026-08-02', baris: [{ jenis: 'sewa', nama: 'X', qty: 1, harga_satuan: 1 }] }));
  check('validasi buat RAB → 400', () => {
    must(e1.status === 400, `project: ${e1.status}`);
    must(e2.status === 400, `tanggal: ${e2.status}`);
    must(e3.status === 400, `baris: ${e3.status}`);
  });
}

// 5. Status flow: draft → sent → back to draft; direct approved via PATCH rejected.
{
  const s1 = await call('/api/rab/1', json({ status: 'sent' }, 'PATCH'));
  const back = await call('/api/rab/1', json({ status: 'draft' }, 'PATCH'));
  const hack = await call('/api/rab/1', json({ status: 'approved' }, 'PATCH'));
  check('status flow + kunci approved', () => {
    must(s1.status === 200, `sent: ${s1.status}`);
    must(back.status === 200, `draft: ${back.status}`);
    must(hack.status === 400, `direct approved: ${hack.status}`);
  });
}

// 6. Approve: creates Transaksi snapshot, locks RAB, idempotent repeat.
{
  await call('/api/rab/1', json({ status: 'sent' }, 'PATCH'));
  const res = await call('/api/rab/1/setujui', { method: 'POST', ...authed });
  const body = await res.json();
  const again = await call('/api/rab/1/setujui', { method: 'POST', ...authed });
  const againBody = await again.json();
  const locked = await call('/api/rab/1', json({ catatan: 'ubah' }, 'PATCH'));
  check('setujui 1 klik + idempoten + kunci', () => {
    must(res.status === 201, `status ${res.status}`);
    must(body.transaksi.nama_project === 'Nikahan Soleh' && body.transaksi.rab_id === 1, 'snapshot salah');
    must(body.transaksi.total === 3250000, `total transaksi ${body.transaksi.total}`);
    must(transaksiBaris.filter((b) => b.transaksi_id === body.transaksi_id).length === 2, 'baris tak tersalin');
    must(again.status === 200 && againBody.transaksi_id === body.transaksi_id, 'repeat harus idempoten');
    must(locked.status === 409, `edit approved: ${locked.status}`);
  });
}

// 7. Rejected RAB cannot convert; unknown RAB 404.
{
  await call('/api/rab', json({ nama_project: 'Ditolak', nama_client: 'X', tanggal_rab: '2026-08-03' }));
  await call('/api/rab/2', json({ status: 'rejected' }, 'PATCH'));
  const no = await call('/api/rab/2/setujui', { method: 'POST', ...authed });
  const miss = await call('/api/rab/99/setujui', { method: 'POST', ...authed });
  check('rejected tak bisa convert + 404', () => {
    must(no.status === 409, `rejected: ${no.status}`);
    must(miss.status === 404, `unknown: ${miss.status}`);
  });
}

// 8. Rapid double-POST numbering unique (B6: id-derived, never last+1).
{
  const a = await call('/api/rab', json({ nama_project: 'A', nama_client: 'X', tanggal_rab: '2026-08-04' }));
  const b = await call('/api/rab', json({ nama_project: 'B', nama_client: 'X', tanggal_rab: '2026-08-04' }));
  const na = (await a.json()).nomor, nb = (await b.json()).nomor;
  check('nomor unik double-POST', () => must(na !== nb && na === 'RAB-2026-0003' && nb === 'RAB-2026-0004', `${na} vs ${nb}`));
}

// 9. No DELETE route (M1).
{
  const del = await call('/api/rab/1', { method: 'DELETE', ...authed });
  check('DELETE RAB → 404 (tak ada route)', () => must(del.status === 404, `status ${del.status}`));
}

// 10. Settings read (identity auto-fill source, Q23) + guard.
{
  const res = await call('/api/settings', authed);
  const body = await res.json();
  const anon = await call('/api/settings');
  check('settings + guard', () => {
    must(res.status === 200, `status ${res.status}`);
    must(body.settings?.nama && body.settings?.bank, 'identitas/bank hilang');
    must(anon.status === 401, `anon: ${anon.status}`);
  });
}

// 11. Header edits allowed while draft; locked once approved.
{
  const h = await call('/api/rab/2', json({ nama_project: 'Ditolak (revisi)' }, 'PATCH'));
  const hb = await h.json();
  const bad = await call('/api/rab/2', json({ tanggal_rab: 'salah' }, 'PATCH'));
  check('edit header draft', () => {
    must(h.status === 200 && hb.nama_project === 'Ditolak (revisi)', 'header tak berubah');
    must(bad.status === 400, `tanggal salah: ${bad.status}`);
  });
}

process.exit(failures ? 1 : 0);
