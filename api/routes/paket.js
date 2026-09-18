import { requireSession } from "../lib/session.js";
import { first, all, run, dbOf } from "../lib/db.js";
import { ok, fail } from "../lib/respond.js";
import { validBaris } from "../validate.js";

// Paket router (ticket #42, issue #42): Paket template CRUD + rows.
// Paket = template rincian (Q12): rows grouped by kategori (Q23), each row a
// jenis alat|jasa|biaya (Q13) with qty units (G1) + free-text satuan.
// alat_id set only where jenis=alat; jasa/biaya rows are free-text names.
// Editing a Paket never rewrites past documents: RAB/Transaksi snapshot
// rows at creation (#43+), so no cascade here. No DELETE (same rule as B4).

async function withRows(db, paket) {
  const { results } = await all(
    db,
    "SELECT id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan FROM paket_baris WHERE paket_id = ? ORDER BY id",
    paket.id,
  );
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
  app.get("/api/paket", requireSession, async (c) => {
    const { results } = await all(
      dbOf(c),
      "SELECT id, nama, deskripsi, created_at FROM paket ORDER BY id",
    );
    return ok(c, {
      paket: await Promise.all(results.map((p) => withRows(dbOf(c), p))),
    });
  });

  app.get("/api/paket/:id", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const paket = await first(dbOf(c), "SELECT * FROM paket WHERE id = ?", id);
    if (!paket) return fail(c, "Paket tidak ditemukan.", 404);
    return ok(c, await withRows(dbOf(c), paket));
  });

  app.post("/api/paket", requireSession, async (c) => {
    const { nama, deskripsi, baris } = await c.req.json().catch(() => ({}));
    if (typeof nama !== "string" || !nama.trim())
      return fail(c, "Nama paket wajib diisi.", 400);
    if (baris !== undefined && !Array.isArray(baris))
      return fail(c, "baris harus array.", 400);
    for (const b of baris ?? []) {
      const err = validBaris(b);
      if (err) return fail(c, err, 400);
    }
    const r = await run(
      dbOf(c),
      "INSERT INTO paket (nama, deskripsi) VALUES (?, ?)",
      nama.trim(),
      typeof deskripsi === "string" ? deskripsi : "",
    );
    const id = r.meta.last_row_id;
    for (const b of baris ?? []) {
      await run(
        dbOf(c),
        "INSERT INTO paket_baris (paket_id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        typeof b.kategori === "string" && b.kategori
          ? b.kategori
          : "PRODUCTION",
        b.jenis,
        b.jenis === "alat" ? (b.alat_id ?? null) : null,
        b.nama.trim(),
        b.qty,
        typeof b.satuan === "string" ? b.satuan : "",
        b.harga_satuan,
      );
    }
    const paket = await first(dbOf(c), "SELECT * FROM paket WHERE id = ?", id);
    return ok(c, await withRows(dbOf(c), paket), 201);
  });

  app.patch("/api/paket/:id", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const cur = await first(dbOf(c), "SELECT * FROM paket WHERE id = ?", id);
    if (!cur) return fail(c, "Paket tidak ditemukan.", 404);
    const body = await c.req.json().catch(() => ({}));
    const nama = body.nama === undefined ? cur.nama : String(body.nama).trim();
    if (!nama) return fail(c, "Nama paket wajib diisi.", 400);
    await run(
      dbOf(c),
      "UPDATE paket SET nama = ?, deskripsi = ? WHERE id = ?",
      nama,
      body.deskripsi === undefined ? cur.deskripsi : String(body.deskripsi),
      id,
    );
    if (body.baris !== undefined) {
      if (!Array.isArray(body.baris)) return fail(c, "baris harus array.", 400);
      for (const b of body.baris) {
        const err = validBaris(b);
        if (err) return fail(c, err, 400);
      }
      // Rows are replaced wholesale: past documents hold their own
      // snapshots, so nothing else reads these rows.
      await run(dbOf(c), "DELETE FROM paket_baris WHERE paket_id = ?", id);
      for (const b of body.baris) {
        await run(
          dbOf(c),
          "INSERT INTO paket_baris (paket_id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          id,
          typeof b.kategori === "string" && b.kategori
            ? b.kategori
            : "PRODUCTION",
          b.jenis,
          b.jenis === "alat" ? (b.alat_id ?? null) : null,
          b.nama.trim(),
          b.qty,
          typeof b.satuan === "string" ? b.satuan : "",
          b.harga_satuan,
        );
      }
    }
    const paket = await first(dbOf(c), "SELECT * FROM paket WHERE id = ?", id);
    return ok(c, await withRows(dbOf(c), paket));
  });

  // No DELETE route: past RABs reference the template by name in UI; drop
  // via archive convention later if needed (same spirit as B4).
}
