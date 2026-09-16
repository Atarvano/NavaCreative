import { requireSession } from './auth.js';

// Ringkasan router (ticket #46, issue #46): read-only aggregates for the
// Ringkasan view. No new tables — every number derives from existing ones:
// Modal ALAT (harga_beli + servis), pendapatan (jenis=alat rows), invoice
// (total/dibayar/sisa/overdue), recent transactions. Unpaid/overdue is a
// status list only (Q17, no reminder block).
// Redesign 05 (#58): additive fields for the 4 metric cards — kas_bulan_ini
// (sum Pembayaran in the running calendar month, local date) + job_aktif
// (Transaksi terjadwal + berjalan). Existing totals unchanged.

const today = () => new Date().toISOString().slice(0, 10);

export function ringkasanRoutes(app) {
  app.get('/api/ringkasan', requireSession, async (c) => {
    const db = c.env.DB;
    const alat = (await db.prepare('SELECT id, nama, harga_beli FROM alat WHERE is_active = 1 ORDER BY id').all()).results;
    let totalModal = 0;
    let totalPendapatan = 0;
    const perAlat = [];
    for (const a of alat) {
      const s = await db.prepare('SELECT COALESCE(SUM(biaya), 0) AS s FROM alat_servis WHERE alat_id = ?').bind(a.id).first();
      let p = 0;
      try {
        const row = await db
          .prepare("SELECT COALESCE(SUM(qty * harga_satuan), 0) AS p FROM transaksi_baris WHERE alat_id = ? AND jenis = 'alat'")
          .bind(a.id)
          .first();
        p = row.p;
      } catch {
        // Pre-#44 shape: no transaksi_baris table yet.
      }
      const modal = a.harga_beli + s.s;
      totalModal += modal;
      totalPendapatan += p;
      perAlat.push({ id: a.id, nama: a.nama, modal, pendapatan: p, balik_modal: p >= modal });
    }
    const inv = (await db.prepare('SELECT id, nomor, total, status, jatuh_tempo FROM invoice ORDER BY id DESC').all()).results;
    let piutang = 0;
    const belumLunas = [];
    const overdue = [];
    for (const i of inv) {
      const d = await db.prepare('SELECT COALESCE(SUM(jumlah), 0) AS d FROM pembayaran WHERE invoice_id = ?').bind(i.id).first();
      const sisa = i.total - d.d;
      if (i.status === 'unpaid' || i.status === 'partial') {
        piutang += sisa;
        belumLunas.push({ id: i.id, nomor: i.nomor, sisa, jatuh_tempo: i.jatuh_tempo, status: i.status });
        if (i.jatuh_tempo < today()) overdue.push({ id: i.id, nomor: i.nomor, sisa, jatuh_tempo: i.jatuh_tempo });
      }
    }
    const recent = (await db.prepare('SELECT id, nama_project, nama_client, total, status FROM transaksi ORDER BY id DESC LIMIT 5').all()).results;
    // #58: kas bulan ini = SUM Pembayaran bulan kalender berjalan. Batas
    // bulan pakai tanggal LOKAL worker (strftime %Y-%m), bukan UTC ISO.
    // Bulan yang dijumlah ikut dikembalikan (kas_bulan 'YYYY-MM') supaya
    // label kartu FE dirender dari bulan yang SAMA dengan angkanya — tak
    // bisa geser saat tengah malam beda zona worker vs browser.
    const kasRow = await db
      .prepare("SELECT COALESCE(SUM(jumlah), 0) AS k, strftime('%Y-%m', 'now', 'localtime') AS b FROM pembayaran WHERE strftime('%Y-%m', tanggal) = strftime('%Y-%m', 'now', 'localtime')")
      .first();
    // #58: job aktif = transaksi terjadwal + berjalan (angka sama dgn badge).
    const jobAktif = (
      await db.prepare("SELECT COUNT(*) AS n FROM transaksi WHERE status IN ('terjadwal', 'berjalan')").first()
    ).n;
    return c.json({
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
