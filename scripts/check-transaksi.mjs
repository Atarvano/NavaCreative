// Local curl-equivalent checklist for ticket #44 (no wrangler account needed).
// Spins the Hono app against a tiny in-memory D1 sham (admins + sessions +
// transaksi + transaksi_baris + brief), then runs the acceptance cases.
// Usage: node scripts/check-transaksi.mjs (exit 0 = all pass).
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
const transaksi = [];
const tbaris = [];
const brief = [];
let tseq = 0, bseq = 0;

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
        if (s.includes('FROM transaksi WHERE id') && !s.includes('SELECT id FROM'))
          return transaksi.find((t) => t.id === a[0]) ?? null;
        if (s.includes('SELECT id FROM transaksi WHERE id'))
          return transaksi.some((t) => t.id === a[0]) ? { id: a[0] } : null;
        if (s.includes('FROM brief WHERE transaksi_id'))
          return brief.find((b) => b.transaksi_id === a[0]) ?? null;
        throw new Error(`sham: unhandled SELECT ${s}`);
      },
      async all() {
        const [s, a] = [this._sql, this._args];
        if (s.includes('FROM transaksi ORDER BY')) return { results: [...transaksi].sort((x, y) => y.id - x.id) };
        if (s.includes('FROM transaksi_baris WHERE transaksi_id'))
          return { results: tbaris.filter((r) => r.transaksi_id === a[0]) };
        // Clash check: evaluate overlap in JS (sham can't run the JOIN).
        if (s.includes('JOIN transaksi_baris b ON')) {
          const [alatIds, tid, selesai, mulai] = [a.slice(0, -3), a[a.length - 3], a[a.length - 2], a[a.length - 1]];
          const out = [];
          for (const t of transaksi) {
            if (t.id === tid || !['terjadwal', 'berjalan'].includes(t.status)) continue;
            if (!t.tanggal_mulai || !t.tanggal_selesai) continue;
            if (!(t.tanggal_mulai <= selesai && t.tanggal_selesai >= mulai)) continue;
            if (tbaris.some((b) => b.transaksi_id === t.id && b.jenis === 'alat' && alatIds.includes(b.alat_id)))
              out.push({ id: t.id, nama_project: t.nama_project });
          }
          return { results: out };
        }
        throw new Error(`sham: unhandled ALL ${s}`);
      },
      async run() {
        const [s, a] = [this._sql, this._args];
        if (s.startsWith('INSERT INTO transaksi ')) {
          const row = { id: ++tseq, rab_id: null, nama_project: a[0], nama_client: a[1], perusahaan_client: a[2], tanggal_mulai: a[3], tanggal_selesai: a[4], lokasi: a[5], status: 'terjadwal', diskon: a[6], total: 0 };
          transaksi.push(row);
          return { meta: { last_row_id: row.id } };
        }
        if (s.startsWith('INSERT INTO transaksi_baris')) {
          tbaris.push({ id: ++bseq, transaksi_id: a[0], kategori: a[1], jenis: a[2], alat_id: a[3], nama: a[4], qty: a[5], satuan: a[6], harga_satuan: a[7] });
          return {};
        }
        if (s.startsWith('UPDATE transaksi SET total')) {
          Object.assign(transaksi.find((t) => t.id === a[1]), { total: a[0] });
          return {};
        }
        if (s.startsWith('UPDATE transaksi SET status')) {
          Object.assign(transaksi.find((t) => t.id === a[1]), { status: a[0] });
          return {};
        }
        const fm = s.match(/^UPDATE transaksi SET (lokasi|tanggal_mulai|tanggal_selesai) = \?,/);
        if (fm) {
          Object.assign(transaksi.find((t) => t.id === a[1]), { [fm[1]]: a[0] });
          return {};
        }
        if (s.startsWith('INSERT INTO brief')) {
          const fields = ['objective', 'audience', 'style', 'mood', 'dos', 'donts', 'lokasi', 'talent', 'deliverables', 'deadline', 'notes'];
          const row = { id: brief.length + 1, transaksi_id: a[0] };
          fields.forEach((f, i) => (row[f] = a[i + 1]));
          brief.push(row);
          return {};
        }
        const bm = s.match(/^UPDATE brief SET (\w+) = \? WHERE/);
        if (bm) {
          Object.assign(brief.find((b) => b.transaksi_id === a[1]), { [bm[1]]: a[0] });
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

// 1. Guard: transaksi + brief routes 401 without a session.
{
  const g1 = await call('/api/transaksi');
  const g2 = await call('/api/transaksi', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const g3 = await call('/api/transaksi/1/brief');
  check('401 tanpa sesi', () => {
    must(g1.status === 401, `GET: ${g1.status}`);
    must(g2.status === 401, `POST: ${g2.status}`);
    must(g3.status === 401, `brief: ${g3.status}`);
  });
}

// 2. Walk-in (Drone-style jasa rows) saves as terjadwal, rab_id NULL.
{
  const res = await call('/api/transaksi', json({
    nama_project: 'Drone Bandar Baru', nama_client: 'Pak Suhaimi',
    tanggal_mulai: '2026-08-17', tanggal_selesai: '2026-08-17', lokasi: 'Bandar Baru',
    baris: [
      { kategori: 'PRODUCTION', jenis: 'jasa', nama: 'Jasa Drone', qty: 1, satuan: 'Sesi', harga_satuan: 350000 },
      { kategori: 'PRODUCTION', jenis: 'jasa', nama: 'Jasa Edit', qty: 1, satuan: 'Sesi', harga_satuan: 250000 },
    ],
  }));
  const body = await res.json();
  check('walk-in tanpa RAB', () => {
    must(res.status === 201, `status ${res.status}`);
    must(body.status === 'terjadwal' && body.rab_id === null, 'harus terjadwal tanpa rab');
    must(body.total === 600000, `total ${body.total}`);
    must(Array.isArray(body.bentrok) && body.bentrok.length === 0, 'tak boleh bentrok');
  });
}

// 3. Validation: missing project/client, bad date, bad discount.
{
  const e1 = await call('/api/transaksi', json({ nama_client: 'X' }));
  const e2 = await call('/api/transaksi', json({ nama_project: 'P', nama_client: 'X', tanggal_mulai: 'kemarin' }));
  check('validasi walk-in → 400', () => {
    must(e1.status === 400, `project: ${e1.status}`);
    must(e2.status === 400, `tanggal: ${e2.status}`);
  });
}

// 4. Lifecycle: terjadwal → berjalan → selesai; batal keeps history.
{
  const b1 = await call('/api/transaksi/1', json({ status: 'berjalan' }, 'PATCH'));
  const b2 = await call('/api/transaksi/1', json({ status: 'selesai' }, 'PATCH'));
  const bad = await call('/api/transaksi/1', json({ status: 'hilang' }, 'PATCH'));
  await call('/api/transaksi', json({ nama_project: 'Batal Job', nama_client: 'X' }));
  const bt = await call('/api/transaksi/2', json({ status: 'batal' }, 'PATCH'));
  const del = await call('/api/transaksi/1', { method: 'DELETE', ...authed });
  check('lifecycle + tanpa DELETE', () => {
    must(b1.status === 200 && b2.status === 200, 'transisi gagal');
    must(bad.status === 400, `unknown: ${bad.status}`);
    must(bt.status === 200, `batal: ${bt.status}`);
    must(del.status === 404, `DELETE: ${del.status}`);
  });
}

// 5. Clash: same alat overlapping → warning names job; save proceeds.
//    Non-overlap + batal jobs → no warning.
{
  await call('/api/transaksi', json({
    nama_project: 'Nikahan A', nama_client: 'A',
    tanggal_mulai: '2026-09-20', tanggal_selesai: '2026-09-21',
    baris: [{ kategori: 'PRODUCTION', jenis: 'alat', alat_id: 7, nama: 'NXR-100', qty: 1, satuan: 'Unit', harga_satuan: 350000 }],
  }));
  const clash = await call('/api/transaksi', json({
    nama_project: 'Nikahan B', nama_client: 'B',
    tanggal_mulai: '2026-09-21', tanggal_selesai: '2026-09-22',
    baris: [{ kategori: 'PRODUCTION', jenis: 'alat', alat_id: 7, nama: 'NXR-100', qty: 1, satuan: 'Unit', harga_satuan: 350000 }],
  }));
  const clashBody = await clash.json();
  const free = await call('/api/transaksi', json({
    nama_project: 'Nikahan C', nama_client: 'C',
    tanggal_mulai: '2026-09-25', tanggal_selesai: '2026-09-26',
    baris: [{ kategori: 'PRODUCTION', jenis: 'alat', alat_id: 7, nama: 'NXR-100', qty: 1, satuan: 'Unit', harga_satuan: 350000 }],
  }));
  const freeBody = await free.json();
  await call('/api/transaksi/3', json({ status: 'batal' }, 'PATCH'));
  const afterBatal = await call('/api/transaksi/5/bentrok', authed);
  const afterBody = await afterBatal.json();
  check('bentrok: warning + tetap simpan', () => {
    must(clash.status === 201, `clash save: ${clash.status}`);
    must(clashBody.bentrok.length === 1 && clashBody.bentrok[0].nama_project === 'Nikahan A', 'warning harus sebut Nikahan A');
    must(freeBody.bentrok.length === 0, 'beda tanggal tak boleh warning');
    must(afterBody.bentrok.length === 0, 'job batal tak boleh warning');
  });
}

// 6. Brief: null before, PUT upsert, GET reads, walk-in can hold one.
{
  const before = await (await call('/api/transaksi/1/brief', authed)).json();
  const put = await call('/api/transaksi/1/brief', json({ objective: 'Dokumentasi', lokasi: 'Bandar Baru', deadline: '2026-08-20', deliverables: 'Video 3 menit' }, 'PUT'));
  const putBody = await put.json();
  const upd = await call('/api/transaksi/1/brief', json({ mood: 'Cinematic' }, 'PUT'));
  const updBody = await upd.json();
  const bad = await call('/api/transaksi/1/brief', json({ deadline: 'besok' }, 'PUT'));
  const miss = await call('/api/transaksi/99/brief', authed);
  check('brief upsert per transaksi', () => {
    must(before.brief === null, 'awal harus null');
    must(put.status === 200 && putBody.brief.objective === 'Dokumentasi', 'PUT gagal');
    must(updBody.brief.mood === 'Cinematic' && updBody.brief.objective === 'Dokumentasi', 'update parsial rusak');
    must(bad.status === 400, `deadline: ${bad.status}`);
    must(miss.status === 404, `unknown: ${miss.status}`);
  });
}

process.exit(failures ? 1 : 0);
