import { requireSession } from './auth.js';

// RAB router (ticket #43, issue #43): RAB CRUD + status flow + one-click
// approve into a Transaksi. Rows snapshot name/rate at creation (Q21 chain:
// paket → RAB → transaksi all carry their own copies). Nomor RAB-YYYY-NNNN
// derived from the AUTOINCREMENT id (B6): insert → format → update, so rapid
// double-POST can never collide. No DELETE (M1): rejected RABs stay as
// history. Transaksi rows land here so approve works end to end; walk-in
// creation + lifecycle + Brief arrive in #44.

const JENIS = ['alat', 'jasa', 'biaya'];
const STATUS = ['draft', 'sent', 'approved', 'rejected'];
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function validBaris(b) {
  if (typeof b !== 'object' || b === null) return 'Baris harus objek.';
  if (!JENIS.includes(b.jenis)) return `jenis harus salah satu: ${JENIS.join(', ')}.`;
  if (typeof b.nama !== 'string' || !b.nama.trim()) return 'Nama baris wajib diisi.';
  if (!Number.isInteger(b.qty) || b.qty <= 0) return 'qty harus bilangan bulat > 0.';
  if (!isNonNegInt(b.harga_satuan)) return 'harga_satuan harus bilangan bulat >= 0.';
  if (b.jenis === 'alat' && b.alat_id !== undefined && b.alat_id !== null && !Number.isInteger(b.alat_id))
    return 'alat_id harus id alat atau null.';
  return null;
}

async function withRows(db, rab) {
  const { results } = await db
    .prepare(
      'SELECT id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan FROM rab_baris WHERE rab_id = ? ORDER BY id',
    )
    .bind(rab.id)
    .all();
  const subtotal = {};
  let sum = 0;
  for (const r of results) {
    const s = r.qty * r.harga_satuan;
    sum += s;
    subtotal[r.kategori] = (subtotal[r.kategori] ?? 0) + s;
  }
  return { ...rab, baris: results, subtotal, total: sum - (rab.diskon ?? 0) };
}

async function insertBaris(db, table, parentId, b) {
  await db
    .prepare(
      `INSERT INTO ${table} (${table === 'rab_baris' ? 'rab_id' : 'transaksi_id'}, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      parentId,
      typeof b.kategori === 'string' && b.kategori ? b.kategori : 'PRODUCTION',
      b.jenis,
      b.jenis === 'alat' ? (b.alat_id ?? null) : null,
      b.nama.trim(),
      b.qty,
      typeof b.satuan === 'string' ? b.satuan : '',
      b.harga_satuan,
    )
    .run();
}

export function rabRoutes(app) {
  app.get('/api/rab', requireSession, async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM rab ORDER BY id DESC',
    ).all();
    return c.json({ rab: await Promise.all(results.map((r) => withRows(c.env.DB, r))) });
  });

  app.get('/api/rab/:id', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const rab = await c.env.DB.prepare('SELECT * FROM rab WHERE id = ?').bind(id).first();
    if (!rab) return c.json({ error: 'RAB tidak ditemukan.' }, 404);
    return c.json(await withRows(c.env.DB, rab));
  });

  // Copy a Paket template's rows into a new RAB body (client fills header).
  app.get('/api/paket/:id/ke-rab', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const paket = await c.env.DB.prepare('SELECT * FROM paket WHERE id = ?').bind(id).first();
    if (!paket) return c.json({ error: 'Paket tidak ditemukan.' }, 404);
    const { results } = await c.env.DB.prepare(
      'SELECT kategori, jenis, alat_id, nama, qty, satuan, harga_satuan FROM paket_baris WHERE paket_id = ? ORDER BY id',
    )
      .bind(id)
      .all();
    return c.json({ nama_project: paket.nama, baris: results });
  });

  app.post('/api/rab', requireSession, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.nama_project !== 'string' || !body.nama_project.trim())
      return c.json({ error: 'Nama project wajib diisi.' }, 400);
    if (typeof body.nama_client !== 'string' || !body.nama_client.trim())
      return c.json({ error: 'Nama client wajib diisi.' }, 400);
    if (!isDate(body.tanggal_rab)) return c.json({ error: 'tanggal_rab harus YYYY-MM-DD.' }, 400);
    if (body.baris !== undefined && !Array.isArray(body.baris))
      return c.json({ error: 'baris harus array.' }, 400);
    for (const b of body.baris ?? []) {
      const err = validBaris(b);
      if (err) return c.json({ error: err }, 400);
    }
    const diskon = body.diskon === undefined ? 0 : body.diskon;
    if (!isNonNegInt(diskon)) return c.json({ error: 'diskon harus bilangan bulat >= 0.' }, 400);
    const r = await c.env.DB.prepare(
      'INSERT INTO rab (nama_project, tanggal_rab, nama_client, perusahaan_client, diskon, catatan) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(
        body.nama_project.trim(),
        body.tanggal_rab,
        body.nama_client.trim(),
        typeof body.perusahaan_client === 'string' ? body.perusahaan_client : '',
        diskon,
        typeof body.catatan === 'string' ? body.catatan : '',
      )
      .run();
    const id = r.meta.last_row_id;
    const nomor = `RAB-${body.tanggal_rab.slice(0, 4)}-${String(id).padStart(4, '0')}`;
    await c.env.DB.prepare('UPDATE rab SET nomor = ?, total = 0 WHERE id = ?').bind(nomor, id).run();
    let sum = 0;
    for (const b of body.baris ?? []) {
      await insertBaris(c.env.DB, 'rab_baris', id, b);
      sum += b.qty * b.harga_satuan;
    }
    await c.env.DB.prepare('UPDATE rab SET total = ? WHERE id = ?').bind(sum - diskon, id).run();
    const rab = await c.env.DB.prepare('SELECT * FROM rab WHERE id = ?').bind(id).first();
    return c.json(await withRows(c.env.DB, rab), 201);
  });

  // Status flow: draft <-> sent -> approved/rejected. Approved locks the
  // RAB for editing (it now has a Transaksi child); back-to-draft reopens.
  app.patch('/api/rab/:id', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const cur = await c.env.DB.prepare('SELECT * FROM rab WHERE id = ?').bind(id).first();
    if (!cur) return c.json({ error: 'RAB tidak ditemukan.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    if (cur.status === 'approved')
      return c.json({ error: 'RAB yang disetujui terkunci. Batalkan Transaksinya dulu.' }, 409);
    if (body.status !== undefined) {
      if (!STATUS.includes(body.status)) return c.json({ error: 'status tidak dikenal.' }, 400);
      if (body.status === 'approved')
        return c.json({ error: 'Gunakan /setujui untuk menyetujui RAB.' }, 400);
      await c.env.DB.prepare("UPDATE rab SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
        .bind(body.status, id)
        .run();
    }
    if (body.baris !== undefined) {
      if (!Array.isArray(body.baris)) return c.json({ error: 'baris harus array.' }, 400);
      for (const b of body.baris) {
        const err = validBaris(b);
        if (err) return c.json({ error: err }, 400);
      }
      await c.env.DB.prepare('DELETE FROM rab_baris WHERE rab_id = ?').bind(id).run();
      let sum = 0;
      for (const b of body.baris) {
        await insertBaris(c.env.DB, 'rab_baris', id, b);
        sum += b.qty * b.harga_satuan;
      }
      const diskon = body.diskon === undefined ? cur.diskon : body.diskon;
      if (!isNonNegInt(diskon)) return c.json({ error: 'diskon harus bilangan bulat >= 0.' }, 400);
      await c.env.DB.prepare("UPDATE rab SET diskon = ?, total = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
        .bind(diskon, sum - diskon, id)
        .run();
    } else if (body.diskon !== undefined) {
      if (!isNonNegInt(body.diskon)) return c.json({ error: 'diskon harus bilangan bulat >= 0.' }, 400);
      const { results } = await c.env.DB.prepare('SELECT qty, harga_satuan FROM rab_baris WHERE rab_id = ?').bind(id).all();
      const sum = results.reduce((t, r) => t + r.qty * r.harga_satuan, 0);
      await c.env.DB.prepare("UPDATE rab SET diskon = ?, total = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
        .bind(body.diskon, sum - body.diskon, id)
        .run();
    }
    if (body.catatan !== undefined) {
      await c.env.DB.prepare("UPDATE rab SET catatan = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
        .bind(String(body.catatan), id)
        .run();
    }
    // Header edits (project/client/date/company) — allowed while not approved.
    const headerFields = ['nama_project', 'nama_client', 'perusahaan_client', 'tanggal_rab'];
    for (const f of headerFields) {
      if (body[f] === undefined) continue;
      if (f === 'tanggal_rab' && !isDate(body[f]))
        return c.json({ error: 'tanggal_rab harus YYYY-MM-DD.' }, 400);
      if (f !== 'tanggal_rab' && (typeof body[f] !== 'string' || !body[f].trim()))
        return c.json({ error: `${f} wajib diisi.` }, 400);
      const val = f === 'tanggal_rab' ? body[f] : body[f].trim();
      await c.env.DB.prepare(`UPDATE rab SET ${f} = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)
        .bind(val, id)
        .run();
    }
    const rab = await c.env.DB.prepare('SELECT * FROM rab WHERE id = ?').bind(id).first();
    return c.json(await withRows(c.env.DB, rab));
  });

  // One-click approve: sent (or draft) -> approved + Transaksi snapshot.
  // Idempotent: a second call returns the existing Transaksi.
  app.post('/api/rab/:id/setujui', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const rab = await c.env.DB.prepare('SELECT * FROM rab WHERE id = ?').bind(id).first();
    if (!rab) return c.json({ error: 'RAB tidak ditemukan.' }, 404);
    if (rab.status === 'rejected') return c.json({ error: 'RAB yang ditolak tidak bisa disetujui.' }, 409);
    const existing = await c.env.DB.prepare('SELECT id FROM transaksi WHERE rab_id = ?').bind(id).first();
    if (existing) {
      const t = await c.env.DB.prepare('SELECT * FROM transaksi WHERE id = ?').bind(existing.id).first();
      return c.json({ transaksi_id: t.id, transaksi: t });
    }
    const full = await withRows(c.env.DB, rab);
    const t = await c.env.DB.prepare(
      'INSERT INTO transaksi (rab_id, nama_project, nama_client, perusahaan_client, diskon, total) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(id, rab.nama_project, rab.nama_client, rab.perusahaan_client, rab.diskon, rab.total)
      .run();
    const tid = t.meta.last_row_id;
    for (const b of full.baris) {
      await insertBaris(c.env.DB, 'transaksi_baris', tid, b);
    }
    await c.env.DB.prepare("UPDATE rab SET status = 'approved', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(id).run();
    const transaksi = await c.env.DB.prepare('SELECT * FROM transaksi WHERE id = ?').bind(tid).first();
    return c.json({ transaksi_id: tid, transaksi }, 201);
  });

  // No DELETE route (M1).
}
