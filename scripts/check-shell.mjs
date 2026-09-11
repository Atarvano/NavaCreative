// Local curl-equivalent checklist for ticket #46 (no wrangler account needed).
// Spins the Hono app against a tiny in-memory D1 sham (admins + sessions +
// alat + servis + transaksi + invoice + pembayaran + settings), then runs
// the acceptance cases. Usage: node scripts/check-shell.mjs (exit 0 = pass).
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
const alat = [{ id: 1, nama: 'NXR', harga_beli: 10000000 }];
const servis = [{ alat_id: 1, biaya: 2000000 }];
const tbaris = [{ transaksi_id: 1, alat_id: 1, jenis: 'alat', qty: 40, harga_satuan: 350000 }];
const transaksi = [
  { id: 1, nama_project: 'Nikahan', nama_client: 'S', total: 5500000, status: 'selesai' },
  { id: 2, nama_project: 'Drone', nama_client: 'S', total: 600000, status: 'terjadwal' },
];
const invoice = [
  { id: 1, nomor: 'INV-2026-0001', total: 5500000, status: 'partial', jatuh_tempo: '2020-01-01' },
  { id: 2, nomor: 'INV-2026-0002', total: 600000, status: 'paid', jatuh_tempo: '2030-01-01' },
];
const bayar = [{ invoice_id: 1, jumlah: 2000000 }];
const settings = [
  { key: 'nama', value: 'Nava Production' },
  { key: 'hp', value: '085817999140' },
  { key: 'email', value: 'navaproduction9@gmail.com' },
  { key: 'bank', value: 'BCA' },
  { key: 'norek', value: '8335463109' },
  { key: 'atas_nama', value: 'Luthfi Ahmad Zaidan' },
];

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
        if (s.includes('SUM(biaya)')) return { s: servis.filter((x) => x.alat_id === a[0]).reduce((t, x) => t + x.biaya, 0) };
        if (s.includes('FROM transaksi_baris')) return { p: tbaris.filter((r) => r.alat_id === a[0] && r.jenis === 'alat').reduce((t, r) => t + r.qty * r.harga_satuan, 0) };
        if (s.includes('SUM(jumlah)')) return { d: bayar.filter((r) => r.invoice_id === a[0]).reduce((t, r) => t + r.jumlah, 0) };
        throw new Error(`sham: unhandled SELECT ${s}`);
      },
      async all() {
        const [s] = [this._sql];
        if (s.includes('FROM alat WHERE is_active')) return { results: [...alat] };
        if (s.includes('FROM invoice ORDER BY')) return { results: [...invoice].sort((x, y) => y.id - x.id) };
        if (s.includes('FROM transaksi ORDER BY')) return { results: [...transaksi].sort((x, y) => y.id - x.id) };
        if (s.includes('FROM settings')) return { results: [...settings] };
        throw new Error(`sham: unhandled ALL ${s}`);
      },
      async run() {
        const [s, a] = [this._sql, this._args];
        if (s.startsWith('UPDATE settings SET')) {
          Object.assign(settings.find((x) => x.key === a[1]), { value: a[0] });
          return {};
        }
        throw new Error(`sham: unhandled RUN ${s}`);
      },
    };
  },
};

const authed = { headers: { cookie: 'nava_session=sess-1' } };
const call = (path, opts = {}) =>
  app.request(path, { ...opts, headers: { ...(opts.headers ?? {}), host: 'localhost' } }, { DB });

// 1. Guard: ringkasan + settings PUT 401 without a session.
{
  const g1 = await call('/api/ringkasan');
  const g2 = await call('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' });
  check('401 tanpa sesi', () => {
    must(g1.status === 401, `GET: ${g1.status}`);
    must(g2.status === 401, `PUT: ${g2.status}`);
  });
}

// 2. Ringkasan math: modal 12jt, pendapatan 14jt, piutang 3.5jt, overdue 1.
{
  const res = await call('/api/ringkasan', authed);
  const b = await res.json();
  check('agregat ringkasan', () => {
    must(res.status === 200, `status ${res.status}`);
    must(b.total_modal === 12000000, `modal ${b.total_modal}`);
    must(b.total_pendapatan === 14000000, `pendapatan ${b.total_pendapatan}`);
    must(b.piutang === 3500000, `piutang ${b.piutang}`);
    must(b.per_alat.length === 1 && b.per_alat[0].balik_modal === true, 'badge salah');
    must(b.belum_lunas.length === 1 && b.belum_lunas[0].sisa === 3500000, 'belum-lunas salah');
    must(b.overdue.length === 1 && b.overdue[0].nomor === 'INV-2026-0001', 'overdue salah');
    must(b.recent.length === 2 && b.recent[0].id === 2, 'recent salah');
  });
}

// 3. PUT settings: updates propagate; non-string rejected; unknown keys ignored.
{
  const put = await call('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json', ...authed.headers }, body: JSON.stringify({ nama: 'Nava Baru', evil: 'x' }) });
  const body = await put.json();
  const bad = await call('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json', ...authed.headers }, body: JSON.stringify({ nama: 5 }) });
  check('PUT settings allowlist', () => {
    must(put.status === 200 && body.settings.nama === 'Nava Baru', 'update gagal');
    must(!('evil' in body.settings), 'key liar bocor');
    must(bad.status === 400, `non-string: ${bad.status}`);
  });
}

process.exit(failures ? 1 : 0);
