import { requireSession } from "../lib/session.js";
import { first, all, run, dbOf } from "../lib/db.js";
import { ok, fail } from "../lib/respond.js";
import { isNonNegInt, isDate, validBaris } from "../validate.js";

// RAB router: CRUD, status flow, and one-click approve into a Transaksi.
// Rows snapshot at creation. Rejected RABs stay as history. No DELETE.

const STATUS = ["draft", "sent", "approved", "rejected"];

async function withRows(db, rab) {
  const { results } = await all(
    db,
    "SELECT id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan FROM rab_baris WHERE rab_id = ? ORDER BY id",
    rab.id,
  );
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
  await run(
    db,
    `INSERT INTO ${table} (${table === "rab_baris" ? "rab_id" : "transaksi_id"}, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    parentId,
    typeof b.kategori === "string" && b.kategori ? b.kategori : "PRODUCTION",
    b.jenis,
    b.jenis === "alat" ? (b.alat_id ?? null) : null,
    b.nama.trim(),
    b.qty,
    typeof b.satuan === "string" ? b.satuan : "",
    b.harga_satuan,
  );
}

export function rabRoutes(app) {
  app.get("/api/rab", requireSession, async (c) => {
    const { results } = await all(
      dbOf(c),
      "SELECT * FROM rab ORDER BY id DESC",
    );
    return ok(c, {
      rab: await Promise.all(results.map((r) => withRows(dbOf(c), r))),
    });
  });

  app.get("/api/rab/:id", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const rab = await first(dbOf(c), "SELECT * FROM rab WHERE id = ?", id);
    if (!rab) return fail(c, "RAB tidak ditemukan.", 404);
    return ok(c, await withRows(dbOf(c), rab));
  });

  // Copy a Paket template's rows into a new RAB body (client fills header).
  app.get("/api/paket/:id/ke-rab", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const paket = await first(dbOf(c), "SELECT * FROM paket WHERE id = ?", id);
    if (!paket) return fail(c, "Paket tidak ditemukan.", 404);
    const { results } = await all(
      dbOf(c),
      "SELECT kategori, jenis, alat_id, nama, qty, satuan, harga_satuan FROM paket_baris WHERE paket_id = ? ORDER BY id",
      id,
    );
    return ok(c, { nama_project: paket.nama, baris: results });
  });

  app.post("/api/rab", requireSession, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.nama_project !== "string" || !body.nama_project.trim())
      return fail(c, "Nama project wajib diisi.", 400);
    if (typeof body.nama_client !== "string" || !body.nama_client.trim())
      return fail(c, "Nama client wajib diisi.", 400);
    if (!isDate(body.tanggal_rab))
      return fail(c, "tanggal_rab harus YYYY-MM-DD.", 400);
    if (body.baris !== undefined && !Array.isArray(body.baris))
      return fail(c, "baris harus array.", 400);
    for (const b of body.baris ?? []) {
      const err = validBaris(b);
      if (err) return fail(c, err, 400);
    }
    const diskon = body.diskon === undefined ? 0 : body.diskon;
    if (!isNonNegInt(diskon))
      return fail(c, "diskon harus bilangan bulat >= 0.", 400);
    const r = await run(
      dbOf(c),
      "INSERT INTO rab (nama_project, tanggal_rab, nama_client, perusahaan_client, diskon, catatan) VALUES (?, ?, ?, ?, ?, ?)",
      body.nama_project.trim(),
      body.tanggal_rab,
      body.nama_client.trim(),
      typeof body.perusahaan_client === "string" ? body.perusahaan_client : "",
      diskon,
      typeof body.catatan === "string" ? body.catatan : "",
    );
    const id = r.meta.last_row_id;
    const nomor = `RAB-${body.tanggal_rab.slice(0, 4)}-${String(id).padStart(4, "0")}`;
    await run(
      dbOf(c),
      "UPDATE rab SET nomor = ?, total = 0 WHERE id = ?",
      nomor,
      id,
    );
    let sum = 0;
    for (const b of body.baris ?? []) {
      await insertBaris(dbOf(c), "rab_baris", id, b);
      sum += b.qty * b.harga_satuan;
    }
    await run(
      dbOf(c),
      "UPDATE rab SET total = ? WHERE id = ?",
      sum - diskon,
      id,
    );
    const rab = await first(dbOf(c), "SELECT * FROM rab WHERE id = ?", id);
    return ok(c, await withRows(dbOf(c), rab), 201);
  });

  // Status flow: draft <-> sent -> approved/rejected. Approved locks the
  // RAB for editing (it now has a Transaksi child); back-to-draft reopens.
  app.patch("/api/rab/:id", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const cur = await first(dbOf(c), "SELECT * FROM rab WHERE id = ?", id);
    if (!cur) return fail(c, "RAB tidak ditemukan.", 404);
    const body = await c.req.json().catch(() => ({}));
    if (cur.status === "approved")
      return fail(
        c,
        "RAB yang disetujui terkunci. Batalkan Transaksinya dulu.",
        409,
      );
    if (body.status !== undefined) {
      if (!STATUS.includes(body.status))
        return fail(c, "status tidak dikenal.", 400);
      if (body.status === "approved")
        return fail(c, "Gunakan /setujui untuk menyetujui RAB.", 400);
      await run(
        dbOf(c),
        "UPDATE rab SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
        body.status,
        id,
      );
    }
    if (body.baris !== undefined) {
      if (!Array.isArray(body.baris)) return fail(c, "baris harus array.", 400);
      for (const b of body.baris) {
        const err = validBaris(b);
        if (err) return fail(c, err, 400);
      }
      await run(dbOf(c), "DELETE FROM rab_baris WHERE rab_id = ?", id);
      let sum = 0;
      for (const b of body.baris) {
        await insertBaris(dbOf(c), "rab_baris", id, b);
        sum += b.qty * b.harga_satuan;
      }
      const diskon = body.diskon === undefined ? cur.diskon : body.diskon;
      if (!isNonNegInt(diskon))
        return fail(c, "diskon harus bilangan bulat >= 0.", 400);
      await run(
        dbOf(c),
        "UPDATE rab SET diskon = ?, total = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
        diskon,
        sum - diskon,
        id,
      );
    } else if (body.diskon !== undefined) {
      if (!isNonNegInt(body.diskon))
        return fail(c, "diskon harus bilangan bulat >= 0.", 400);
      const { results } = await all(
        dbOf(c),
        "SELECT qty, harga_satuan FROM rab_baris WHERE rab_id = ?",
        id,
      );
      const sum = results.reduce((t, r) => t + r.qty * r.harga_satuan, 0);
      await run(
        dbOf(c),
        "UPDATE rab SET diskon = ?, total = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
        body.diskon,
        sum - body.diskon,
        id,
      );
    }
    if (body.catatan !== undefined) {
      await run(
        dbOf(c),
        "UPDATE rab SET catatan = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
        String(body.catatan),
        id,
      );
    }
    // Header edits (project/client/date/company) — allowed while not approved.
    const headerFields = [
      "nama_project",
      "nama_client",
      "perusahaan_client",
      "tanggal_rab",
    ];
    for (const f of headerFields) {
      if (body[f] === undefined) continue;
      if (f === "tanggal_rab" && !isDate(body[f]))
        return fail(c, "tanggal_rab harus YYYY-MM-DD.", 400);
      if (
        f !== "tanggal_rab" &&
        (typeof body[f] !== "string" || !body[f].trim())
      )
        return fail(c, `${f} wajib diisi.`, 400);
      const val = f === "tanggal_rab" ? body[f] : body[f].trim();
      await run(
        dbOf(c),
        `UPDATE rab SET ${f} = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
        val,
        id,
      );
    }
    const rab = await first(dbOf(c), "SELECT * FROM rab WHERE id = ?", id);
    return ok(c, await withRows(dbOf(c), rab));
  });

  // One-click approve: sent (or draft) -> approved + Transaksi snapshot.
  // Idempotent: a second call returns the existing Transaksi.
  app.post("/api/rab/:id/setujui", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const rab = await first(dbOf(c), "SELECT * FROM rab WHERE id = ?", id);
    if (!rab) return fail(c, "RAB tidak ditemukan.", 404);
    if (rab.status === "rejected")
      return fail(c, "RAB yang ditolak tidak bisa disetujui.", 409);
    const existing = await first(
      dbOf(c),
      "SELECT id FROM transaksi WHERE rab_id = ?",
      id,
    );
    if (existing) {
      const t = await first(
        dbOf(c),
        "SELECT * FROM transaksi WHERE id = ?",
        existing.id,
      );
      return ok(c, { transaksi_id: t.id, transaksi: t });
    }
    const full = await withRows(dbOf(c), rab);
    const t = await run(
      dbOf(c),
      "INSERT INTO transaksi (rab_id, nama_project, nama_client, perusahaan_client, diskon, total) VALUES (?, ?, ?, ?, ?, ?)",
      id,
      rab.nama_project,
      rab.nama_client,
      rab.perusahaan_client,
      rab.diskon,
      rab.total,
    );
    const tid = t.meta.last_row_id;
    for (const b of full.baris) {
      await insertBaris(dbOf(c), "transaksi_baris", tid, b);
    }
    await run(
      dbOf(c),
      "UPDATE rab SET status = 'approved', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
      id,
    );
    const transaksi = await first(
      dbOf(c),
      "SELECT * FROM transaksi WHERE id = ?",
      tid,
    );
    return ok(c, { transaksi_id: tid, transaksi }, 201);
  });

  // No DELETE route (M1).
}
