import { requireSession } from './auth.js';

// Invoice router (ticket #45, issue #45): issue one Invoice per Transaksi +
// payments + void. Rows live on the Transaksi (Q21): issue snapshots the
// total + sets transaksi.invoice_terbit, which locks the rows. Nomor
// INV-YYYY-NNNN from the id (B6). Labels DP/Cicilan/Pelunasan derived (B3).
// Overdue derived (Q17, status only). Corrections via minus rows (M1).

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const today = () => new Date().toISOString().slice(0, 10);

async function withBayar(db, inv) {
  const { results } = await db
    .prepare('SELECT id, tanggal, jumlah, metode, referensi FROM pembayaran WHERE invoice_id = ? ORDER BY id')
    .bind(inv.id)
    .all();
  const dibayar = results.reduce((t, p) => t + p.jumlah, 0);
  const sisa = inv.total - dibayar;
  // Labels (B3): first = DP, settling = Pelunasan, middle = Cicilan N.
  let lunas = 0;
  const bayar = results.map((p, i) => {
    lunas += p.jumlah;
    let label = `Cicilan ${i}`;
    if (i === 0) label = 'DP';
    else if (lunas >= inv.total) label = 'Pelunasan';
    return { ...p, label };
  });
  const overdue = inv.status !== 'paid' && inv.status !== 'batal' && inv.jatuh_tempo < today();
  return { ...inv, bayar, dibayar, sisa, overdue };
}

export function invoiceRoutes(app) {
  app.get('/api/invoice', requireSession, async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM invoice ORDER BY id DESC').all();
    return c.json({ invoice: await Promise.all(results.map((i) => withBayar(c.env.DB, i))) });
  });

  app.get('/api/invoice/:id', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const inv = await c.env.DB.prepare('SELECT * FROM invoice WHERE id = ?').bind(id).first();
    if (!inv) return c.json({ error: 'Invoice tidak ditemukan.' }, 404);
    const t = await c.env.DB.prepare('SELECT * FROM transaksi WHERE id = ?').bind(inv.transaksi_id).first();
    const { results } = await c.env.DB.prepare(
      'SELECT kategori, jenis, alat_id, nama, qty, satuan, harga_satuan FROM transaksi_baris WHERE transaksi_id = ? ORDER BY id',
    )
      .bind(inv.transaksi_id)
      .all();
    return c.json({ ...(await withBayar(c.env.DB, inv)), transaksi: t, baris: results });
  });

  // Issue: one per Transaksi (UNIQUE guard + friendly 409). Locks rows.
  app.post('/api/transaksi/:id/invoice', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const t = await c.env.DB.prepare('SELECT * FROM transaksi WHERE id = ?').bind(id).first();
    if (!t) return c.json({ error: 'Transaksi tidak ditemukan.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const jatuh = typeof body.jatuh_tempo === 'string' ? body.jatuh_tempo : '';
    if (!isDate(jatuh)) return c.json({ error: 'jatuh_tempo harus YYYY-MM-DD.' }, 400);
    const dup = await c.env.DB.prepare('SELECT id FROM invoice WHERE transaksi_id = ?').bind(id).first();
    if (dup) return c.json({ error: 'Transaksi ini sudah punya invoice.' }, 409);
    const terbit = today();
    const bank = await c.env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('bank', 'norek', 'atas_nama')").all()
      .then((r) => Object.fromEntries(r.results.map((x) => [x.key, x.value])))
      .catch(() => ({}));
    const snap = [bank.bank, bank.norek, bank.atas_nama].filter(Boolean).join(' ');
    const r = await c.env.DB.prepare(
      'INSERT INTO invoice (transaksi_id, tanggal_terbit, jatuh_tempo, total, bank_snapshot) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(id, terbit, jatuh, t.total, snap)
      .run();
    const iid = r.meta.last_row_id;
    const nomor = `INV-${terbit.slice(0, 4)}-${String(iid).padStart(4, '0')}`;
    await c.env.DB.prepare('UPDATE invoice SET nomor = ? WHERE id = ?').bind(nomor, iid).run();
    await c.env.DB.prepare('UPDATE transaksi SET invoice_terbit = 1 WHERE id = ?').bind(id).run();
    const inv = await c.env.DB.prepare('SELECT * FROM invoice WHERE id = ?').bind(iid).first();
    return c.json(await withBayar(c.env.DB, inv), 201);
  });

  // Pay: jumlah nonzero integer (minus = correction, M1). Status follows.
  app.post('/api/invoice/:id/bayar', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const inv = await c.env.DB.prepare('SELECT * FROM invoice WHERE id = ?').bind(id).first();
    if (!inv) return c.json({ error: 'Invoice tidak ditemukan.' }, 404);
    if (inv.status === 'batal') return c.json({ error: 'Invoice batal tidak bisa dibayar.' }, 409);
    const body = await c.req.json().catch(() => ({}));
    if (!Number.isInteger(body.jumlah) || body.jumlah === 0)
      return c.json({ error: 'jumlah harus bilangan bulat bukan nol (minus = koreksi).' }, 400);
    if (!isDate(body.tanggal)) return c.json({ error: 'tanggal harus YYYY-MM-DD.' }, 400);
    if (body.metode !== undefined && !['transfer', 'cash'].includes(body.metode))
      return c.json({ error: 'metode harus transfer atau cash.' }, 400);
    await c.env.DB.prepare(
      'INSERT INTO pembayaran (invoice_id, tanggal, jumlah, metode, referensi) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(id, body.tanggal, body.jumlah, body.metode ?? 'transfer', typeof body.referensi === 'string' ? body.referensi : '')
      .run();
    const full = await withBayar(c.env.DB, inv);
    const status = full.sisa <= 0 ? 'paid' : 'partial';
    await c.env.DB.prepare("UPDATE invoice SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
      .bind(status, id)
      .run();
    const upd = await c.env.DB.prepare('SELECT * FROM invoice WHERE id = ?').bind(id).first();
    return c.json(await withBayar(c.env.DB, upd), 201);
  });

  // Void: status batal, history preserved (M1).
  app.post('/api/invoice/:id/batal', requireSession, async (c) => {
    const id = Number(c.req.param('id'));
    const inv = await c.env.DB.prepare('SELECT * FROM invoice WHERE id = ?').bind(id).first();
    if (!inv) return c.json({ error: 'Invoice tidak ditemukan.' }, 404);
    await c.env.DB.prepare("UPDATE invoice SET status = 'batal', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(id).run();
    const upd = await c.env.DB.prepare('SELECT * FROM invoice WHERE id = ?').bind(id).first();
    return c.json(await withBayar(c.env.DB, upd));
  });

  // No DELETE route (M1).
}
