import { requireSession } from "../lib/session.js";
import { first, all, run, dbOf } from "../lib/db.js";
import { ok, fail } from "../lib/respond.js";
import { isDate } from "../validate.js";

// Invoice router: one invoice per Transaksi, payments, and void.
// Labels like DP, Installment, and Settlement are derived.

const today = () => new Date().toISOString().slice(0, 10);

async function withBayar(db, inv) {
  const { results } = await all(
    db,
    "SELECT id, tanggal, jumlah, metode, referensi FROM pembayaran WHERE invoice_id = ? ORDER BY id",
    inv.id,
  );
  const dibayar = results.reduce((t, p) => t + p.jumlah, 0);
  const sisa = inv.total - dibayar;
  // Labels (B3): first = DP, settling = Pelunasan, middle = Cicilan N.
  let lunas = 0;
  const bayar = results.map((p, i) => {
    lunas += p.jumlah;
    let label = `Cicilan ${i}`;
    if (i === 0) label = "DP";
    else if (lunas >= inv.total) label = "Pelunasan";
    return { ...p, label };
  });
  const overdue =
    inv.status !== "paid" &&
    inv.status !== "batal" &&
    inv.jatuh_tempo < today();
  return { ...inv, bayar, dibayar, sisa, overdue };
}

export function invoiceRoutes(app) {
  app.get("/api/invoice", requireSession, async (c) => {
    const { results } = await all(
      dbOf(c),
      "SELECT * FROM invoice ORDER BY id DESC",
    );
    return ok(c, {
      invoice: await Promise.all(results.map((i) => withBayar(dbOf(c), i))),
    });
  });

  app.get("/api/invoice/:id", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const inv = await first(dbOf(c), "SELECT * FROM invoice WHERE id = ?", id);
    if (!inv) return fail(c, "Invoice tidak ditemukan.", 404);
    const t = await first(
      dbOf(c),
      "SELECT * FROM transaksi WHERE id = ?",
      inv.transaksi_id,
    );
    const { results } = await all(
      dbOf(c),
      "SELECT kategori, jenis, alat_id, nama, qty, satuan, harga_satuan FROM transaksi_baris WHERE transaksi_id = ? ORDER BY id",
      inv.transaksi_id,
    );
    return ok(c, {
      ...(await withBayar(dbOf(c), inv)),
      transaksi: t,
      baris: results,
    });
  });

  // Issue: one per Transaksi (UNIQUE guard + friendly 409). Locks rows.
  app.post("/api/transaksi/:id/invoice", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const t = await first(dbOf(c), "SELECT * FROM transaksi WHERE id = ?", id);
    if (!t) return fail(c, "Transaksi tidak ditemukan.", 404);
    const body = await c.req.json().catch(() => ({}));
    const jatuh = typeof body.jatuh_tempo === "string" ? body.jatuh_tempo : "";
    if (!isDate(jatuh)) return fail(c, "jatuh_tempo harus YYYY-MM-DD.", 400);
    const dup = await first(
      dbOf(c),
      "SELECT id FROM invoice WHERE transaksi_id = ?",
      id,
    );
    if (dup) return fail(c, "Transaksi ini sudah punya invoice.", 409);
    const terbit = today();
    const bank = await all(
      dbOf(c),
      "SELECT key, value FROM settings WHERE key IN ('bank', 'norek', 'atas_nama')",
    )
      .then((r) => Object.fromEntries(r.results.map((x) => [x.key, x.value])))
      .catch(() => ({}));
    const snap = [bank.bank, bank.norek, bank.atas_nama]
      .filter(Boolean)
      .join(" ");
    const r = await run(
      dbOf(c),
      "INSERT INTO invoice (transaksi_id, tanggal_terbit, jatuh_tempo, total, bank_snapshot) VALUES (?, ?, ?, ?, ?)",
      id,
      terbit,
      jatuh,
      t.total,
      snap,
    );
    const iid = r.meta.last_row_id;
    const nomor = `INV-${terbit.slice(0, 4)}-${String(iid).padStart(4, "0")}`;
    await run(dbOf(c), "UPDATE invoice SET nomor = ? WHERE id = ?", nomor, iid);
    await run(
      dbOf(c),
      "UPDATE transaksi SET invoice_terbit = 1 WHERE id = ?",
      id,
    );
    const inv = await first(dbOf(c), "SELECT * FROM invoice WHERE id = ?", iid);
    return ok(c, await withBayar(dbOf(c), inv), 201);
  });

  // Pay: jumlah nonzero integer (minus = correction, M1). Status follows.
  app.post("/api/invoice/:id/bayar", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const inv = await first(dbOf(c), "SELECT * FROM invoice WHERE id = ?", id);
    if (!inv) return fail(c, "Invoice tidak ditemukan.", 404);
    if (inv.status === "batal")
      return fail(c, "Invoice batal tidak bisa dibayar.", 409);
    const body = await c.req.json().catch(() => ({}));
    if (!Number.isInteger(body.jumlah) || body.jumlah === 0)
      return fail(
        c,
        "jumlah harus bilangan bulat bukan nol (minus = koreksi).",
        400,
      );
    if (!isDate(body.tanggal)) return fail(c, "tanggal harus YYYY-MM-DD.", 400);
    if (
      body.metode !== undefined &&
      !["transfer", "cash"].includes(body.metode)
    )
      return fail(c, "metode harus transfer atau cash.", 400);
    await run(
      dbOf(c),
      "INSERT INTO pembayaran (invoice_id, tanggal, jumlah, metode, referensi) VALUES (?, ?, ?, ?, ?)",
      id,
      body.tanggal,
      body.jumlah,
      body.metode ?? "transfer",
      typeof body.referensi === "string" ? body.referensi : "",
    );
    const full = await withBayar(dbOf(c), inv);
    const status = full.sisa <= 0 ? "paid" : "partial";
    await run(
      dbOf(c),
      "UPDATE invoice SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
      status,
      id,
    );
    const upd = await first(dbOf(c), "SELECT * FROM invoice WHERE id = ?", id);
    return ok(c, await withBayar(dbOf(c), upd), 201);
  });

  // Change due date: full invoice out, sibling-style validation.
  // Returns 404 if not found, 400 for bad format, 401 caught by guard.
  app.patch("/api/invoice/:id", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const inv = await first(dbOf(c), "SELECT * FROM invoice WHERE id = ?", id);
    if (!inv) return fail(c, "Invoice tidak ditemukan.", 404);
    const body = await c.req.json().catch(() => ({}));
    if (!isDate(body.jatuh_tempo))
      return fail(c, "jatuh_tempo harus YYYY-MM-DD.", 400);
    await run(
      dbOf(c),
      "UPDATE invoice SET jatuh_tempo = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
      body.jatuh_tempo,
      id,
    );
    const upd = await first(dbOf(c), "SELECT * FROM invoice WHERE id = ?", id);
    return ok(c, await withBayar(dbOf(c), upd));
  });

  // Void: status batal, history preserved (M1).
  app.post("/api/invoice/:id/batal", requireSession, async (c) => {
    const id = Number(c.req.param("id"));
    const inv = await first(dbOf(c), "SELECT * FROM invoice WHERE id = ?", id);
    if (!inv) return fail(c, "Invoice tidak ditemukan.", 404);
    await run(
      dbOf(c),
      "UPDATE invoice SET status = 'batal', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
      id,
    );
    const upd = await first(dbOf(c), "SELECT * FROM invoice WHERE id = ?", id);
    return ok(c, await withBayar(dbOf(c), upd));
  });

  // No DELETE route (M1).
}
