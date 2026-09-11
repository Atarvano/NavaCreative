import { requireSession } from './auth.js';

// Transaksi router (ticket #44, issue #44): walk-in CRUD + lifecycle +
// clash warning + Brief. Rows snapshot at creation (same shape as
// rab.js). Warning bentrok (Q16): same alat_id on overlapping dates across
// terjadwal/berjalan jobs (B1) → warning naming the job, save proceeds.
// No DELETE (M1). Invoice lock of rows arrives in #45.

const JENIS = ['alat', 'jasa', 'biaya'];
const STATUS = ['terjadwal', 'berjalan', 'selesai', 'batal'];
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isOptDate = (v) => v === '' || v === undefined || isDate(v);

function validBaris(b) {
  if (typeof b !== 'object' || b === null) return 'Baris harus objek.';
  if (!JENIS.includes(b.jenis)) return `jenis harus salah satu: ${JENIS.join(', ')}.`;
  if (typeof b.nama !== 'string' || !b.nama.trim()) return 'Nama baris wajib diisi.';
  if (!Number.isInteger(b.qty) || b.qty <= 0) return 'qty harus bilangan bulat > 0.';
  if (!isNonNegInt(b.harga_satuan)) return 'harga_satuan harus bilangan bulat >= 0.';
  return null;
}

async function withRows(db, t) {
  const { results } = await db
    .prepare(
      'SELECT id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan FROM transaksi_baris WHERE transaksi_id = ? ORDER BY id',
    )
    .bind(t.id)
    .all();
  return { ...t, baris: results };
}

async function cekBentrok(db, tid, alatIds, mulai, selesai) {
  if (!alatIds.length || !mulai || !selesai) return [];
  const { results } = await db
    .prepare(
      `SELECT DISTINCT t.id, t.nama_project FROM transaksi t
       JOIN transaksi_baris b ON b.transaksi_id = t.id
       WHERE b.alat_id IN (${alatIds.map(() => '?').join(',')})
       AND t.id != ? AND t.status IN ('terjadwal', 'berjalan')
       AND t.tanggal_mulai != '' AND t.tanggal_selesai != ''
       AND t.tanggal_mulai <= ? AND t.tanggal_selesai >= ?`,
    )
    .bind(...alatIds, tid ?? -1, selesai, mulai)
    .all();
  return results;
}

export function transaksiRoutes(app) {
  app.get('/api/transaksi', requireSession, async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM transaksi ORDER BY id DESC').all();
    return c.json({ transaksi: await Promise.all(results.map((t) => withRows(c.env.DB, t))) });
  });

  app.get('/api/transaksi/:id', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const t = await c.env.DB.prepare('SELECT * FROM transaksi WHERE id = ?').bind(id).first();
    if (!t) return c.json({ error: 'Transaksi tidak ditemukan.' }, 404);
    return c.json(await withRows(c.env.DB, t));
  });

  // Walk-in: no RAB (rab_id NULL, Q11). baris optional (can start empty).
  app.post('/api/transaksi', requireSession, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.nama_project !== 'string' || !body.nama_project.trim())
      return c.json({ error: 'Nama project wajib diisi.' }, 400);
    if (typeof body.nama_client !== 'string' || !body.nama_client.trim())
      return c.json({ error: 'Nama client wajib diisi.' }, 400);
    if (!isOptDate(body.tanggal_mulai) || !isOptDate(body.tanggal_selesai))
      return c.json({ error: 'tanggal harus YYYY-MM-DD.' }, 400);
    if (body.baris !== undefined && !Array.isArray(body.baris))
      return c.json({ error: 'baris harus array.' }, 400);
    for (const b of body.baris ?? []) {
      const err = validBaris(b);
      if (err) return c.json({ error: err }, 400);
    }
    const diskon = body.diskon === undefined ? 0 : body.diskon;
    if (!isNonNegInt(diskon)) return c.json({ error: 'diskon harus bilangan bulat >= 0.' }, 400);
    const r = await c.env.DB.prepare(
      'INSERT INTO transaksi (nama_project, nama_client, perusahaan_client, tanggal_mulai, tanggal_selesai, lokasi, diskon) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        body.nama_project.trim(),
        body.nama_client.trim(),
        typeof body.perusahaan_client === 'string' ? body.perusahaan_client : '',
        body.tanggal_mulai ?? '',
        body.tanggal_selesai ?? '',
        typeof body.lokasi === 'string' ? body.lokasi : '',
        diskon,
      )
      .run();
    const id = r.meta.last_row_id;
    let sum = 0;
    for (const b of body.baris ?? []) {
      await c.env.DB.prepare(
        'INSERT INTO transaksi_baris (transaksi_id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(
          id,
          typeof b.kategori === 'string' && b.kategori ? b.kategori : 'PRODUCTION',
          b.jenis,
          b.jenis === 'alat' ? (b.alat_id ?? null) : null,
          b.nama.trim(),
          b.qty,
          typeof b.satuan === 'string' ? b.satuan : '',
          b.harga_satuan,
        )
        .run();
      sum += b.qty * b.harga_satuan;
    }
    await c.env.DB.prepare('UPDATE transaksi SET total = ? WHERE id = ?').bind(sum - diskon, id).run();
    const t = await c.env.DB.prepare('SELECT * FROM transaksi WHERE id = ?').bind(id).first();
    const full = await withRows(c.env.DB, t);
    const bentrok = await cekBentrok(
      c.env.DB, id,
      full.baris.filter((b) => b.jenis === 'alat' && b.alat_id).map((b) => b.alat_id),
      t.tanggal_mulai, t.tanggal_selesai,
    );
    return c.json({ ...full, bentrok }, 201);
  });

  // Lifecycle: any -> any of STATUS. batal keeps history (no DELETE).
  // Baris editable until #45 locks them on invoice issue.
  app.patch('/api/transaksi/:id', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const cur = await c.env.DB.prepare('SELECT * FROM transaksi WHERE id = ?').bind(id).first();
    if (!cur) return c.json({ error: 'Transaksi tidak ditemukan.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    if (body.status !== undefined) {
      if (!STATUS.includes(body.status)) return c.json({ error: 'status tidak dikenal.' }, 400);
      await c.env.DB.prepare("UPDATE transaksi SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
        .bind(body.status, id)
        .run();
    }
    for (const f of ['lokasi', 'tanggal_mulai', 'tanggal_selesai']) {
      if (body[f] === undefined) continue;
      if ((f !== 'lokasi') && !isOptDate(body[f]))
        return c.json({ error: 'tanggal harus YYYY-MM-DD.' }, 400);
      await c.env.DB.prepare(`UPDATE transaksi SET ${f} = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)
        .bind(typeof body[f] === 'string' ? body[f] : '', id)
        .run();
    }
    const t = await c.env.DB.prepare('SELECT * FROM transaksi WHERE id = ?').bind(id).first();
    const full = await withRows(c.env.DB, t);
    const bentrok = body.tanggal_mulai !== undefined || body.tanggal_selesai !== undefined
      ? await cekBentrok(
        c.env.DB, id,
        full.baris.filter((b) => b.jenis === 'alat' && b.alat_id).map((b) => b.alat_id),
        t.tanggal_mulai, t.tanggal_selesai,
      )
      : [];
    return c.json({ ...full, bentrok });
  });

  // Explicit clash check (used by the UI before save when dates change).
  app.get('/api/transaksi/:id/bentrok', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const t = await c.env.DB.prepare('SELECT * FROM transaksi WHERE id = ?').bind(id).first();
    if (!t) return c.json({ error: 'Transaksi tidak ditemukan.' }, 404);
    const full = await withRows(c.env.DB, t);
    const bentrok = await cekBentrok(
      c.env.DB, id,
      full.baris.filter((b) => b.jenis === 'alat' && b.alat_id).map((b) => b.alat_id),
      t.tanggal_mulai, t.tanggal_selesai,
    );
    return c.json({ bentrok });
  });

  // Brief 1:1 per Transaksi (B2): PUT upserts, GET reads.
  app.get('/api/transaksi/:id/brief', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const t = await c.env.DB.prepare('SELECT id FROM transaksi WHERE id = ?').bind(id).first();
    if (!t) return c.json({ error: 'Transaksi tidak ditemukan.' }, 404);
    const b = await c.env.DB.prepare('SELECT * FROM brief WHERE transaksi_id = ?').bind(id).first();
    return c.json({ brief: b ?? null });
  });

  const BRIEF_FIELDS = ['objective', 'audience', 'style', 'mood', 'dos', 'donts', 'lokasi', 'talent', 'deliverables', 'deadline', 'notes'];

  app.put('/api/transaksi/:id/brief', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const t = await c.env.DB.prepare('SELECT id FROM transaksi WHERE id = ?').bind(id).first();
    if (!t) return c.json({ error: 'Transaksi tidak ditemukan.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    if (body.deadline !== undefined && body.deadline !== '' && !isDate(body.deadline))
      return c.json({ error: 'deadline harus YYYY-MM-DD.' }, 400);
    const cur = await c.env.DB.prepare('SELECT * FROM brief WHERE transaksi_id = ?').bind(id).first();
    if (cur) {
      // Column names from the fixed allowlist, same as values.
      for (const f of BRIEF_FIELDS) {
        if (body[f] === undefined) continue;
        await c.env.DB.prepare(`UPDATE brief SET ${f} = ? WHERE transaksi_id = ?`)
          .bind(typeof body[f] === 'string' ? body[f] : '', id)
          .run();
      }
    } else {
      await c.env.DB.prepare(
        'INSERT INTO brief (transaksi_id, objective, audience, style, mood, dos, donts, lokasi, talent, deliverables, deadline, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(id, ...BRIEF_FIELDS.map((f) => (typeof body[f] === 'string' ? body[f] : '')))
        .run();
    }
    const brief = await c.env.DB.prepare('SELECT * FROM brief WHERE transaksi_id = ?').bind(id).first();
    return c.json({ brief });
  });

  // No DELETE route (M1).
}
