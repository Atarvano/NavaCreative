// Local curl-equivalent checklist for ticket #45 (no wrangler account needed).
// Spins the Hono app against a tiny in-memory D1 sham (admins + sessions +
// transaksi + invoice + pembayaran + settings), then runs acceptance cases.
// Usage: node scripts/check-invoice.mjs (exit 0 = all pass).
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
const transaksi = [
  { id: 1, nama_project: 'Nikahan Soleh', nama_client: 'Soleh', status: 'terjadwal', total: 5500000, invoice_terbit: 0 },
  { id: 2, nama_project: 'Drone', nama_client: 'Suhaimi', status: 'terjadwal', total: 600000, invoice_terbit: 0 },
  { id: 3, nama_project: 'Nunggak', nama_client: 'Z', status: 'terjadwal', total: 1000000, invoice_terbit: 0 },
];
const tbaris = [
  { transaksi_id: 1, kategori: 'PRODUCTION', jenis: 'alat', nama: 'Live', qty: 1, satuan: 'Hari', harga_satuan: 5500000 },
];
const invoice = [];
const bayar = [];
const settings = [
  { key: 'bank', value: 'BCA' },
  { key: 'norek', value: '8335463109' },
  { key: 'atas_nama', value: 'Luthfi Ahmad Zaidan' },
];
let iseq = 0, bseq = 0;

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
        if (s.includes('FROM transaksi WHERE id')) return transaksi.find((t) => t.id === a[0]) ?? null;        if (s.includes('FROM invoice WHERE transaksi_id')) return invoice.find((i) => i.transaksi_id === a[0]) ?? null;
        if (s.includes('FROM invoice WHERE id')) return invoice.find((i) => i.id === a[0]) ?? null;
        throw new Error(`sham: unhandled SELECT ${s}`);
      },
      async all() {
        const [s, a] = [this._sql, this._args];
        if (s.includes('FROM invoice ORDER BY')) return { results: [...invoice].sort((x, y) => y.id - x.id) };
        if (s.includes('FROM transaksi_baris WHERE transaksi_id'))
          return { results: tbaris.filter((r) => r.transaksi_id === a[0]) };
        if (s.includes('FROM pembayaran WHERE invoice_id'))
          return { results: bayar.filter((r) => r.invoice_id === a[0]) };
        if (s.includes("FROM settings WHERE key IN")) return { results: [...settings] };
        throw new Error(`sham: unhandled ALL ${s}`);
      },
      async run() {
        const [s, a] = [this._sql, this._args];
        if (s.startsWith('INSERT INTO invoice')) {
          const row = { id: ++iseq, transaksi_id: a[0], nomor: null, tanggal_terbit: a[1], jatuh_tempo: a[2], total: a[3], bank_snapshot: a[4], status: 'unpaid' };
          invoice.push(row);
          return { meta: { last_row_id: row.id } };
        }
        if (s.startsWith('UPDATE invoice SET nomor')) {
          Object.assign(invoice.find((i) => i.id === a[1]), { nomor: a[0] });
          return {};
        }
        if (s.startsWith('UPDATE transaksi SET invoice_terbit')) {
          Object.assign(transaksi.find((t) => t.id === a[0]), { invoice_terbit: 1 });
          return {};
        }
        if (s.startsWith('INSERT INTO pembayaran')) {
          bayar.push({ id: ++bseq, invoice_id: a[0], tanggal: a[1], jumlah: a[2], metode: a[3], referensi: a[4] });
          return {};
        }
        if (s.startsWith('UPDATE invoice SET status = ?')) {
          Object.assign(invoice.find((i) => i.id === a[1]), { status: a[0] });
          return {};
        }
        if (s.includes("UPDATE invoice SET status = 'batal'")) {
          Object.assign(invoice.find((i) => i.id === a[0]), { status: 'batal' });
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

// 1. Guard: invoice routes 401 without a session.
{
  const g1 = await call('/api/invoice');
  const g2 = await call('/api/transaksi/1/invoice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  check('401 tanpa sesi', () => {
    must(g1.status === 401, `GET: ${g1.status}`);
    must(g2.status === 401, `POST: ${g2.status}`);
  });
}

// 2. Issue: rows match, nomor from id, bank snapshot, rows locked flag.
{
  const res = await call('/api/transaksi/1/invoice', json({ jatuh_tempo: '2030-08-24' }));
  const body = await res.json();
  const det = await (await call('/api/invoice/1', authed)).json();
  const bad = await call('/api/transaksi/1/invoice', json({ jatuh_tempo: 'besok' }));
  const miss = await call('/api/transaksi/99/invoice', json({ jatuh_tempo: '2030-01-01' }));
  check('terbit invoice + kunci', () => {
    must(res.status === 201, `status ${res.status}`);
    must(/^INV-20\d\d-0001$/.test(body.nomor), `nomor ${body.nomor}`);
    must(body.total === 5500000 && body.status === 'unpaid', 'total/status salah');
    must(body.bank_snapshot.includes('BCA') && body.bank_snapshot.includes('8335463109'), 'snapshot bank hilang');
    must(det.baris.length === 1 && det.transaksi.nama_project === 'Nikahan Soleh', 'baris tak narik transaksi');
    must(transaksi[0].invoice_terbit === 1, 'flag kunci tak set');
    must(bad.status === 400, `tanggal: ${bad.status}`);
    must(miss.status === 404, `unknown: ${miss.status}`);
  });
}

// 3. Second issue rejected (1 invoice max, M5).
{
  const dup = await call('/api/transaksi/1/invoice', json({ jatuh_tempo: '2030-08-24' }));
  check('invoice kedua → 409', () => must(dup.status === 409, `status ${dup.status}`));
}

// 4. Pay DP 2jt → partial; pay 3.5jt → paid, balance 0, labels DP/Pelunasan.
{
  const p1 = await call('/api/invoice/1/bayar', json({ tanggal: '2026-08-20', jumlah: 2000000, metode: 'transfer' }));
  const b1 = await p1.json();
  const p2 = await call('/api/invoice/1/bayar', json({ tanggal: '2026-08-25', jumlah: 3500000, metode: 'cash' }));
  const b2 = await p2.json();
  check('DP → partial → lunas', () => {
    must(b1.status === 'partial' && b1.dibayar === 2000000 && b1.sisa === 3500000, 'partial salah');
    must(b1.bayar[0].label === 'DP', 'label DP hilang');
    must(b2.status === 'paid' && b2.sisa === 0, 'paid salah');
    must(b2.bayar[1].label === 'Pelunasan', 'label Pelunasan hilang');
  });
}

// 5. Three-payment labels: DP / Cicilan 1 / Pelunasan.
{
  await call('/api/transaksi/2/invoice', json({ jatuh_tempo: '2030-01-10' }));
  await call('/api/invoice/2/bayar', json({ tanggal: '2026-08-01', jumlah: 200000 }));
  await call('/api/invoice/2/bayar', json({ tanggal: '2026-08-02', jumlah: 200000 }));
  const p3 = await call('/api/invoice/2/bayar', json({ tanggal: '2026-08-03', jumlah: 200000 }));
  const labels = (await p3.json()).bayar.map((b) => b.label);
  check('label 3x bayar', () => must(JSON.stringify(labels) === '["DP","Cicilan 1","Pelunasan"]', labels.join(',')));
}

// 6. Overdue derived (status only): past-due unpaid → true; paid → false.
{
  await call('/api/transaksi/3/invoice', json({ jatuh_tempo: '2020-01-01' }));
  const od = await (await call('/api/invoice/3', authed)).json();
  const paid = await (await call('/api/invoice/1', authed)).json();
  check('overdue turunan', () => {
    must(od.overdue === true && od.status === 'unpaid', 'harus overdue');
    must(paid.overdue === false, 'paid tak boleh overdue');
  });
}

// 7. Void sets batal; batal can't be paid; correction via minus row.
{
  const v = await call('/api/invoice/2/batal', { method: 'POST', ...authed });
  const vb = await v.json();
  const payBatal = await call('/api/invoice/2/bayar', json({ tanggal: '2026-08-04', jumlah: 1 }));
  const corr = await call('/api/invoice/1/bayar', json({ tanggal: '2026-08-26', jumlah: -500000, referensi: 'koreksi lebih catat' }));
  const corb = await corr.json();
  const badAmt = await call('/api/invoice/1/bayar', json({ tanggal: '2026-08-26', jumlah: 0 }));
  check('void + koreksi minus', () => {
    must(vb.status === 'batal', 'void gagal');
    must(payBatal.status === 409, `bayar batal: ${payBatal.status}`);
    must(corb.bayar.length === 3, 'koreksi harus baris baru, bukan hapus');
    must(badAmt.status === 400, `nol: ${badAmt.status}`);
  });
}

// 8. No DELETE route (M1).
{
  const del = await call('/api/invoice/1', { method: 'DELETE', ...authed });
  check('DELETE invoice → 404 (tak ada route)', () => must(del.status === 404, `status ${del.status}`));
}

// 9. Row lock: PATCH baris/diskon after issue → 409 (Q21).
{
  const r1 = await call('/api/transaksi/1', json({ diskon: 1 }, 'PATCH'));
  const r2 = await call('/api/transaksi/1', json({ baris: [] }, 'PATCH'));
  check('baris terkunci pasca-invoice → 409', () => {
    must(r1.status === 409, `diskon: ${r1.status}`);
    must(r2.status === 409, `baris: ${r2.status}`);
  });
}

process.exit(failures ? 1 : 0);
