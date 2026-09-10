import { requireSession } from './auth.js';

// Alat router (ticket #41): Alat CRUD + servis records + derived Modal /
// pendapatan / balik-modal. No DELETE anywhere: Alat is archived via
// is_active (B4). Modal is derived (G2), never a column. Revenue counts
// only transaksi_baris rows with jenis='alat' (Q13) — transaksi tables land
// in issue #44, so until then pendapatan is 0 for every Alat.

const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function withModal(db, alat) {
  const servis = await db
    .prepare('SELECT COALESCE(SUM(biaya), 0) AS s FROM alat_servis WHERE alat_id = ?')
    .bind(alat.id)
    .first();
  let pendapatan = 0;
  try {
    const row = await db
      .prepare(
        "SELECT COALESCE(SUM(qty * harga_satuan), 0) AS p FROM transaksi_baris WHERE alat_id = ? AND jenis = 'alat'",
      )
      .bind(alat.id)
      .first();
    pendapatan = row.p;
  } catch {
    // transaksi_baris doesn't exist yet (lands in #44) — revenue stays 0.
  }
  const modal = alat.harga_beli + servis.s;
  return { ...alat, modal, pendapatan, balik_modal: pendapatan >= modal };
}

export function alatRoutes(app) {
  app.get('/api/alat', requireSession, async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT id, nama, harga_beli, tarif_event, is_active, created_at FROM alat ORDER BY id',
    ).all();
    return c.json({ alat: await Promise.all(results.map((a) => withModal(c.env.DB, a))) });
  });

  app.post('/api/alat', requireSession, async (c) => {
    const { nama, harga_beli, tarif_event } = await c.req.json().catch(() => ({}));
    if (typeof nama !== 'string' || !nama.trim())
      return c.json({ error: 'Nama alat wajib diisi.' }, 400);
    if (!isNonNegInt(harga_beli) || !isNonNegInt(tarif_event))
      return c.json({ error: 'harga_beli dan tarif_event harus bilangan bulat >= 0.' }, 400);
    const r = await c.env.DB.prepare(
      'INSERT INTO alat (nama, harga_beli, tarif_event) VALUES (?, ?, ?)',
    )
      .bind(nama.trim(), harga_beli, tarif_event)
      .run();
    const alat = await c.env.DB.prepare('SELECT * FROM alat WHERE id = ?')
      .bind(r.meta.last_row_id)
      .first();
    return c.json(await withModal(c.env.DB, alat), 201);
  });

  app.patch('/api/alat/:id', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const cur = await c.env.DB.prepare('SELECT * FROM alat WHERE id = ?').bind(id).first();
    if (!cur) return c.json({ error: 'Alat tidak ditemukan.' }, 404);
    const nama = body.nama === undefined ? cur.nama : String(body.nama).trim();
    const harga_beli = body.harga_beli === undefined ? cur.harga_beli : body.harga_beli;
    const tarif_event = body.tarif_event === undefined ? cur.tarif_event : body.tarif_event;
    let active = cur.is_active;
    if (body.is_active !== undefined) active = body.is_active ? 1 : 0;
    const next = { nama, harga_beli, tarif_event, is_active: active };
    if (!next.nama) return c.json({ error: 'Nama alat wajib diisi.' }, 400);
    if (!isNonNegInt(next.harga_beli) || !isNonNegInt(next.tarif_event))
      return c.json({ error: 'harga_beli dan tarif_event harus bilangan bulat >= 0.' }, 400);
    await c.env.DB.prepare(
      'UPDATE alat SET nama = ?, harga_beli = ?, tarif_event = ?, is_active = ? WHERE id = ?',
    )
      .bind(next.nama, next.harga_beli, next.tarif_event, next.is_active, id)
      .run();
    const alat = await c.env.DB.prepare('SELECT * FROM alat WHERE id = ?').bind(id).first();
    return c.json(await withModal(c.env.DB, alat));
  });

  // No DELETE route by design (B4): archive via PATCH is_active=0.

  app.get('/api/alat/:id/servis', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const alat = await c.env.DB.prepare('SELECT id FROM alat WHERE id = ?').bind(id).first();
    if (!alat) return c.json({ error: 'Alat tidak ditemukan.' }, 404);
    const { results } = await c.env.DB.prepare(
      'SELECT id, alat_id, tanggal, keterangan, biaya FROM alat_servis WHERE alat_id = ? ORDER BY tanggal, id',
    )
      .bind(id)
      .all();
    return c.json({ servis: results });
  });

  app.post('/api/alat/:id/servis', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const alat = await c.env.DB.prepare('SELECT id FROM alat WHERE id = ?').bind(id).first();
    if (!alat) return c.json({ error: 'Alat tidak ditemukan.' }, 404);
    const { tanggal, keterangan, biaya } = await c.req.json().catch(() => ({}));
    if (!isDate(tanggal)) return c.json({ error: 'tanggal harus YYYY-MM-DD.' }, 400);
    if (!isNonNegInt(biaya)) return c.json({ error: 'biaya harus bilangan bulat >= 0.' }, 400);
    const r = await c.env.DB.prepare(
      'INSERT INTO alat_servis (alat_id, tanggal, keterangan, biaya) VALUES (?, ?, ?, ?)',
    )
      .bind(id, tanggal, typeof keterangan === 'string' ? keterangan : '', biaya)
      .run();
    const row = await c.env.DB.prepare('SELECT * FROM alat_servis WHERE id = ?')
      .bind(r.meta.last_row_id)
      .first();
    return c.json(row, 201);
  });
}
