import { requireSession } from "../lib/session.js";
import { first, all, dbOf } from "../lib/db.js";
import { ok } from "../lib/respond.js";

// Summary router: read-only aggregates. All numbers derived from existing tables.
// Additive fields for metric cards use local date for current month cash.

const today = () => new Date().toISOString().slice(0, 10);

export function ringkasanRoutes(app) {
  app.get("/api/ringkasan", requireSession, async (c) => {
    const db = dbOf(c);
    const alat = (
      await all(
        db,
        "SELECT id, nama, harga_beli FROM alat WHERE is_active = 1 ORDER BY id",
      )
    ).results;
    let totalModal = 0;
    let totalPendapatan = 0;
    const perAlat = [];
    for (const a of alat) {
      const s = await first(
        db,
        "SELECT COALESCE(SUM(biaya), 0) AS s FROM alat_servis WHERE alat_id = ?",
        a.id,
      );
      // ponytail: transaksi_baris exists since migration 0004 — no try/catch.
      const p = (
        await first(
          db,
          "SELECT COALESCE(SUM(qty * harga_satuan), 0) AS p FROM transaksi_baris WHERE alat_id = ? AND jenis = 'alat'",
          a.id,
        )
      ).p;
      const modal = a.harga_beli + s.s;
      totalModal += modal;
      totalPendapatan += p;
      perAlat.push({
        id: a.id,
        nama: a.nama,
        modal,
        pendapatan: p,
        balik_modal: p >= modal,
      });
    }
    const inv = (
      await all(
        db,
        "SELECT id, nomor, total, status, jatuh_tempo FROM invoice ORDER BY id DESC",
      )
    ).results;
    let piutang = 0;
    const belumLunas = [];
    const overdue = [];
    for (const i of inv) {
      const d = await first(
        db,
        "SELECT COALESCE(SUM(jumlah), 0) AS d FROM pembayaran WHERE invoice_id = ?",
        i.id,
      );
      const sisa = i.total - d.d;
      if (i.status === "unpaid" || i.status === "partial") {
        piutang += sisa;
        belumLunas.push({
          id: i.id,
          nomor: i.nomor,
          sisa,
          jatuh_tempo: i.jatuh_tempo,
          status: i.status,
        });
        if (i.jatuh_tempo < today())
          overdue.push({
            id: i.id,
            nomor: i.nomor,
            sisa,
            jatuh_tempo: i.jatuh_tempo,
          });
      }
    }
    const recent = (
      await all(
        db,
        "SELECT id, nama_project, nama_client, total, status FROM transaksi ORDER BY id DESC LIMIT 5",
      )
    ).results;
    // Current month cash uses worker's local date to match FE card labels.
    const kasRow = await first(
      db,
      "SELECT COALESCE(SUM(jumlah), 0) AS k, strftime('%Y-%m', 'now', 'localtime') AS b FROM pembayaran WHERE strftime('%Y-%m', tanggal) = strftime('%Y-%m', 'now', 'localtime')",
    );
    // Active jobs equal scheduled plus running transactions.
    const jobAktif = (
      await first(
        db,
        "SELECT COUNT(*) AS n FROM transaksi WHERE status IN ('terjadwal', 'berjalan')",
      )
    ).n;
    return ok(c, {
      total_modal: totalModal,
      total_pendapatan: totalPendapatan,
      piutang,
      per_alat: perAlat,
      belum_lunas: belumLunas,
      overdue,
      recent,
      kas_bulan_ini: kasRow.k,
      kas_bulan: kasRow.b,
      job_aktif: jobAktif,
    });
  });
}
