import { requireSession } from "../lib/session.js";
import { first, all, run, dbOf } from "../lib/db.js";
import { ok, fail } from "../lib/respond.js";
import { isNonNegInt, isDate, validBaris } from "../validate.js";

// Transaksi router (ticket #44, issue #44): walk-in CRUD + lifecycle +
// clash warning + Brief. Rows snapshot at creation (same shape as
// rab.js). Warning bentrok (Q16): same alat_id on overlapping dates across
// terjadwal/berjalan jobs (B1) → warning naming the job, save proceeds.
// No DELETE (M1). Invoice lock of rows arrives in #45.

const STATUS = ["terjadwal", "berjalan", "selesai", "batal"];
const isOptDate = (v) => v === "" || v === undefined || isDate(v);

async function withRows(db, t) {
  const { results } = await all(
    db,
    "SELECT id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan FROM transaksi_baris WHERE transaksi_id = ? ORDER BY id",
    t.id,
  );
  return { ...t, baris: results };
}

async function cekBentrok(db, tid, alatIds, mulai, selesai) {
  if (!alatIds.length || !mulai || !selesai) return [];
  const { results } = await all(
    db,
    `SELECT DISTINCT t.id, t.nama_project FROM transaksi t
       JOIN transaksi_baris b ON b.transaksi_id = t.id
       WHERE b.alat_id IN (${alatIds.map(() => "?").join(",")})
       AND t.id != ? AND t.status IN ('terjadwal', 'berjalan')
       AND t.tanggal_mulai != '' AND t.tanggal_selesai != ''
       AND t.tanggal_mulai <= ? AND t.tanggal_selesai >= ?`,
    ...alatIds,
    tid ?? -1,
    selesai,
    mulai,
  );
  return results;
}

export function transaksiRoutes(app) {
  app.get("/api/transaksi", requireSession, async (c) => {
    const { results } = await all(
      dbOf(c),
      "SELECT * FROM transaksi ORDER BY id DESC",
    );
    return ok(c, {
      transaksi: await Promise.all(results.map((t) => withRows(dbOf(c), t))),
    });
  });

  app.get("/api/transaksi/:id", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const t = await first(dbOf(c), "SELECT * FROM transaksi WHERE id = ?", id);
    if (!t) return fail(c, "Transaksi tidak ditemukan.", 404);
    return ok(c, await withRows(dbOf(c), t));
  });

  // Walk-in: no RAB (rab_id NULL, Q11). baris optional (can start empty).
  app.post("/api/transaksi", requireSession, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.nama_project !== "string" || !body.nama_project.trim())
      return fail(c, "Nama project wajib diisi.", 400);
    if (typeof body.nama_client !== "string" || !body.nama_client.trim())
      return fail(c, "Nama client wajib diisi.", 400);
    if (!isOptDate(body.tanggal_mulai) || !isOptDate(body.tanggal_selesai))
      return fail(c, "tanggal harus YYYY-MM-DD.", 400);
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
      "INSERT INTO transaksi (nama_project, nama_client, perusahaan_client, tanggal_mulai, tanggal_selesai, lokasi, diskon) VALUES (?, ?, ?, ?, ?, ?, ?)",
      body.nama_project.trim(),
      body.nama_client.trim(),
      typeof body.perusahaan_client === "string" ? body.perusahaan_client : "",
      body.tanggal_mulai ?? "",
      body.tanggal_selesai ?? "",
      typeof body.lokasi === "string" ? body.lokasi : "",
      diskon,
    );
    const id = r.meta.last_row_id;
    let sum = 0;
    for (const b of body.baris ?? []) {
      await run(
        dbOf(c),
        "INSERT INTO transaksi_baris (transaksi_id, kategori, jenis, alat_id, nama, qty, satuan, harga_satuan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
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
      sum += b.qty * b.harga_satuan;
    }
    await run(
      dbOf(c),
      "UPDATE transaksi SET total = ? WHERE id = ?",
      sum - diskon,
      id,
    );
    const t = await first(dbOf(c), "SELECT * FROM transaksi WHERE id = ?", id);
    const full = await withRows(dbOf(c), t);
    const bentrok = await cekBentrok(
      dbOf(c),
      id,
      full.baris
        .filter((b) => b.jenis === "alat" && b.alat_id)
        .map((b) => b.alat_id),
      t.tanggal_mulai,
      t.tanggal_selesai,
    );
    return ok(c, { ...full, bentrok }, 201);
  });

  // Lifecycle: any -> any of STATUS. batal keeps history (no DELETE).
  // Money fields (baris/diskon) lock once the invoice issues (Q21):
  // rejected loudly so no edit is silently dropped.
  app.patch("/api/transaksi/:id", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const cur = await first(
      dbOf(c),
      "SELECT * FROM transaksi WHERE id = ?",
      id,
    );
    if (!cur) return fail(c, "Transaksi tidak ditemukan.", 404);
    const body = await c.req.json().catch(() => ({}));
    if (
      cur.invoice_terbit &&
      (body.baris !== undefined || body.diskon !== undefined)
    )
      return fail(c, "Baris terkunci: invoice sudah terbit.", 409);
    if (body.status !== undefined) {
      if (!STATUS.includes(body.status))
        return fail(c, "status tidak dikenal.", 400);
      await run(
        dbOf(c),
        "UPDATE transaksi SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
        body.status,
        id,
      );
    }
    for (const f of ["lokasi", "tanggal_mulai", "tanggal_selesai"]) {
      if (body[f] === undefined) continue;
      if (f !== "lokasi" && !isOptDate(body[f]))
        return fail(c, "tanggal harus YYYY-MM-DD.", 400);
      await run(
        dbOf(c),
        `UPDATE transaksi SET ${f} = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
        typeof body[f] === "string" ? body[f] : "",
        id,
      );
    }
    const t = await first(dbOf(c), "SELECT * FROM transaksi WHERE id = ?", id);
    const full = await withRows(dbOf(c), t);
    const bentrok =
      body.tanggal_mulai !== undefined || body.tanggal_selesai !== undefined
        ? await cekBentrok(
            dbOf(c),
            id,
            full.baris
              .filter((b) => b.jenis === "alat" && b.alat_id)
              .map((b) => b.alat_id),
            t.tanggal_mulai,
            t.tanggal_selesai,
          )
        : [];
    return ok(c, { ...full, bentrok });
  });

  // Explicit clash check (used by the UI before save when dates change).
  app.get("/api/transaksi/:id/bentrok", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const t = await first(dbOf(c), "SELECT * FROM transaksi WHERE id = ?", id);
    if (!t) return fail(c, "Transaksi tidak ditemukan.", 404);
    const full = await withRows(dbOf(c), t);
    const bentrok = await cekBentrok(
      dbOf(c),
      id,
      full.baris
        .filter((b) => b.jenis === "alat" && b.alat_id)
        .map((b) => b.alat_id),
      t.tanggal_mulai,
      t.tanggal_selesai,
    );
    return ok(c, { bentrok });
  });

  // Brief 1:1 per Transaksi (B2): PUT upserts, GET reads.
  app.get("/api/transaksi/:id/brief", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const t = await first(dbOf(c), "SELECT id FROM transaksi WHERE id = ?", id);
    if (!t) return fail(c, "Transaksi tidak ditemukan.", 404);
    const b = await first(
      dbOf(c),
      "SELECT * FROM brief WHERE transaksi_id = ?",
      id,
    );
    return ok(c, { brief: b ?? null });
  });

  const BRIEF_FIELDS = [
    "objective",
    "audience",
    "style",
    "mood",
    "dos",
    "donts",
    "lokasi",
    "talent",
    "deliverables",
    "deadline",
    "notes",
  ];

  app.put("/api/transaksi/:id/brief", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const t = await first(dbOf(c), "SELECT id FROM transaksi WHERE id = ?", id);
    if (!t) return fail(c, "Transaksi tidak ditemukan.", 404);
    const body = await c.req.json().catch(() => ({}));
    if (
      body.deadline !== undefined &&
      body.deadline !== "" &&
      !isDate(body.deadline)
    )
      return fail(c, "deadline harus YYYY-MM-DD.", 400);
    const cur = await first(
      dbOf(c),
      "SELECT * FROM brief WHERE transaksi_id = ?",
      id,
    );
    if (cur) {
      // Column names from the fixed allowlist, same as values.
      for (const f of BRIEF_FIELDS) {
        if (body[f] === undefined) continue;
        await run(
          dbOf(c),
          `UPDATE brief SET ${f} = ? WHERE transaksi_id = ?`,
          typeof body[f] === "string" ? body[f] : "",
          id,
        );
      }
    } else {
      await run(
        dbOf(c),
        "INSERT INTO brief (transaksi_id, objective, audience, style, mood, dos, donts, lokasi, talent, deliverables, deadline, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        ...BRIEF_FIELDS.map((f) =>
          typeof body[f] === "string" ? body[f] : "",
        ),
      );
    }
    const brief = await first(
      dbOf(c),
      "SELECT * FROM brief WHERE transaksi_id = ?",
      id,
    );
    return ok(c, { brief });
  });

  // No DELETE route (M1).
}
