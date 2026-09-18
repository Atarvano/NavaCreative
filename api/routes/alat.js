import { requireSession } from "../lib/session.js";
import { first, all, run, dbOf } from "../lib/db.js";
import { ok, fail } from "../lib/respond.js";
import { isNonNegInt, isDate } from "../validate.js";

// Alat router (ticket #41): Alat CRUD + servis records + derived Modal /
// pendapatan / balik-modal. No DELETE anywhere: Alat is archived via
// is_active (B4). Modal is derived (G2), never a column. Revenue counts
// only transaksi_baris rows with jenis='alat' (Q13) — transaksi tables land
// in issue #44, so until then pendapatan is 0 for every Alat.

async function withModal(db, alat) {
  const servis = await first(
    db,
    "SELECT COALESCE(SUM(biaya), 0) AS s FROM alat_servis WHERE alat_id = ?",
    alat.id,
  );
  // ponytail: transaksi_baris exists since migration 0004 — no try/catch.
  const row = await first(
    db,
    "SELECT COALESCE(SUM(qty * harga_satuan), 0) AS p FROM transaksi_baris WHERE alat_id = ? AND jenis = 'alat'",
    alat.id,
  );
  const pendapatan = row.p;
  const modal = alat.harga_beli + servis.s;
  return { ...alat, modal, pendapatan, balik_modal: pendapatan >= modal };
}

export function alatRoutes(app) {
  app.get("/api/alat", requireSession, async (c) => {
    const { results } = await all(
      dbOf(c),
      "SELECT id, nama, harga_beli, tarif_event, is_active, created_at FROM alat ORDER BY id",
    );
    return ok(c, {
      alat: await Promise.all(results.map((a) => withModal(dbOf(c), a))),
    });
  });

  app.post("/api/alat", requireSession, async (c) => {
    const { nama, harga_beli, tarif_event } = await c.req
      .json()
      .catch(() => ({}));
    if (typeof nama !== "string" || !nama.trim())
      return fail(c, "Nama alat wajib diisi.", 400);
    if (!isNonNegInt(harga_beli) || !isNonNegInt(tarif_event))
      return fail(
        c,
        "harga_beli dan tarif_event harus bilangan bulat >= 0.",
        400,
      );
    const r = await run(
      dbOf(c),
      "INSERT INTO alat (nama, harga_beli, tarif_event) VALUES (?, ?, ?)",
      nama.trim(),
      harga_beli,
      tarif_event,
    );
    const alat = await first(
      dbOf(c),
      "SELECT * FROM alat WHERE id = ?",
      r.meta.last_row_id,
    );
    return ok(c, await withModal(dbOf(c), alat), 201);
  });

  app.patch("/api/alat/:id", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json().catch(() => ({}));
    const cur = await first(dbOf(c), "SELECT * FROM alat WHERE id = ?", id);
    if (!cur) return fail(c, "Alat tidak ditemukan.", 404);
    const nama = body.nama === undefined ? cur.nama : String(body.nama).trim();
    const harga_beli =
      body.harga_beli === undefined ? cur.harga_beli : body.harga_beli;
    const tarif_event =
      body.tarif_event === undefined ? cur.tarif_event : body.tarif_event;
    let active = cur.is_active;
    if (body.is_active !== undefined) active = body.is_active ? 1 : 0;
    const next = { nama, harga_beli, tarif_event, is_active: active };
    if (!next.nama) return fail(c, "Nama alat wajib diisi.", 400);
    if (!isNonNegInt(next.harga_beli) || !isNonNegInt(next.tarif_event))
      return fail(
        c,
        "harga_beli dan tarif_event harus bilangan bulat >= 0.",
        400,
      );
    await run(
      dbOf(c),
      "UPDATE alat SET nama = ?, harga_beli = ?, tarif_event = ?, is_active = ? WHERE id = ?",
      next.nama,
      next.harga_beli,
      next.tarif_event,
      next.is_active,
      id,
    );
    const alat = await first(dbOf(c), "SELECT * FROM alat WHERE id = ?", id);
    return ok(c, await withModal(dbOf(c), alat));
  });

  // No DELETE route by design (B4): archive via PATCH is_active=0.

  app.get("/api/alat/:id/servis", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const alat = await first(dbOf(c), "SELECT id FROM alat WHERE id = ?", id);
    if (!alat) return fail(c, "Alat tidak ditemukan.", 404);
    const { results } = await all(
      dbOf(c),
      "SELECT id, alat_id, tanggal, keterangan, biaya FROM alat_servis WHERE alat_id = ? ORDER BY tanggal, id",
      id,
    );
    return ok(c, { servis: results });
  });

  app.post("/api/alat/:id/servis", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const alat = await first(dbOf(c), "SELECT id FROM alat WHERE id = ?", id);
    if (!alat) return fail(c, "Alat tidak ditemukan.", 404);
    const { tanggal, keterangan, biaya } = await c.req.json().catch(() => ({}));
    if (!isDate(tanggal)) return fail(c, "tanggal harus YYYY-MM-DD.", 400);
    if (!isNonNegInt(biaya))
      return fail(c, "biaya harus bilangan bulat >= 0.", 400);
    const r = await run(
      dbOf(c),
      "INSERT INTO alat_servis (alat_id, tanggal, keterangan, biaya) VALUES (?, ?, ?, ?)",
      id,
      tanggal,
      typeof keterangan === "string" ? keterangan : "",
      biaya,
    );
    const row = await first(
      dbOf(c),
      "SELECT * FROM alat_servis WHERE id = ?",
      r.meta.last_row_id,
    );
    return ok(c, row, 201);
  });
}
