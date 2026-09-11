import { requireSession } from './auth.js';

// Paket router (ticket #42, issue #42): Paket template CRUD + rows.
// Paket = template rincian (Q12): rows grouped by kategori (Q23), each row a
// jenis alat|jasa|biaya (Q13) with qty units (G1) + free-text satuan.
// alat_id set only where jenis=alat; jasa/biaya rows are free-text names.
// Editing a Paket never rewrites past documents: RAB/Transaksi snapshot
// rows at creation (#43+), so no cascade here. No DELETE (same rule as B4).

const JENIS = ['alat', 'jasa', 'biaya'];
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;

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

async function withRows(db, paket) {
  const { results } = await db
    .prepare(
      'SELECT id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan FROM paket_baris WHERE paket_id = ? ORDER BY id',
    )
    .bind(paket.id)
    .all();
  const subtotal = {};
  let total = 0;
  for (const r of results) {
    const s = r.qty * r.harga_satuan;
    total += s;
    subtotal[r.kategori] = (subtotal[r.kategori] ?? 0) + s;
  }
  return { ...paket, baris: results, subtotal, total };
}

export function paketRoutes(app) {
  app.get('/api/paket', requireSession, async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT id, nama, deskripsi, created_at FROM paket ORDER BY id',
    ).all();
    return c.json({ paket: await Promise.all(results.map((p) => withRows(c.env.DB, p))) });
  });

  app.get('/api/paket/:id', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const paket = await c.env.DB.prepare('SELECT * FROM paket WHERE id = ?').bind(id).first();
    if (!paket) return c.json({ error: 'Paket tidak ditemukan.' }, 404);
    return c.json(await withRows(c.env.DB, paket));
  });

  app.post('/api/paket', requireSession, async (c) => {
    const { nama, deskripsi, baris } = await c.req.json().catch(() => ({}));
    if (typeof nama !== 'string' || !nama.trim())
      return c.json({ error: 'Nama paket wajib diisi.' }, 400);
    if (baris !== undefined && !Array.isArray(baris))
      return c.json({ error: 'baris harus array.' }, 400);
    for (const b of baris ?? []) {
      const err = validBaris(b);
      if (err) return c.json({ error: err }, 400);
    }
    const r = await c.env.DB.prepare('INSERT INTO paket (nama, deskripsi) VALUES (?, ?)')
      .bind(nama.trim(), typeof deskripsi === 'string' ? deskripsi : '')
      .run();
    const id = r.meta.last_row_id;
    for (const b of baris ?? []) {
      await c.env.DB.prepare(
        'INSERT INTO paket_baris (paket_id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
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
    }
    const paket = await c.env.DB.prepare('SELECT * FROM paket WHERE id = ?').bind(id).first();
    return c.json(await withRows(c.env.DB, paket), 201);
  });

  app.patch('/api/paket/:id', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const cur = await c.env.DB.prepare('SELECT * FROM paket WHERE id = ?').bind(id).first();
    if (!cur) return c.json({ error: 'Paket tidak ditemukan.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const nama = body.nama === undefined ? cur.nama : String(body.nama).trim();
    if (!nama) return c.json({ error: 'Nama paket wajib diisi.' }, 400);
    await c.env.DB.prepare('UPDATE paket SET nama = ?, deskripsi = ? WHERE id = ?')
      .bind(nama, body.deskripsi === undefined ? cur.deskripsi : String(body.deskripsi), id)
      .run();
    if (body.baris !== undefined) {
      if (!Array.isArray(body.baris)) return c.json({ error: 'baris harus array.' }, 400);
      for (const b of body.baris) {
        const err = validBaris(b);
        if (err) return c.json({ error: err }, 400);
      }
      // Rows are replaced wholesale: past documents hold their own
      // snapshots, so nothing else reads these rows.
      await c.env.DB.prepare('DELETE FROM paket_baris WHERE paket_id = ?').bind(id).run();
      for (const b of body.baris) {
        await c.env.DB.prepare(
          'INSERT INTO paket_baris (paket_id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
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
      }
    }
    const paket = await c.env.DB.prepare('SELECT * FROM paket WHERE id = ?').bind(id).first();
    return c.json(await withRows(c.env.DB, paket));
  });

  // No DELETE route: past RABs reference the template by name in UI; drop
  // via archive convention later if needed (same spirit as B4).
}
