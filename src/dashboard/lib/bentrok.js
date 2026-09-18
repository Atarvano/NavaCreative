// Deteksi bentrok jadwal alat: satu alat_id di dua job terjadwal/berjalan
// yang tanggalnya tumpang tindih. Pure, tanpa store: pemanggil menyetor
// daftar transaksi + daftar alat untuk nama. Backend juga mengembalikan
// `bentrok` saat simpan (Q16); helper ini untuk peringatan SEBELUM simpan
// (form walk-in) dan lencana di tabel + kartu Perhatian.

const AKTIF = ["terjadwal", "berjalan"];

const overlap = (a1, a2, b1, b2) =>
  a1 && a2 && b1 && b2 && a1 <= b2 && a2 >= b1;

// Semua job yang berebut satu alat pada rentang tanggal. Dipakai form
// walk-in (peringatan realtime) sebelum POST.
export function cariBentrok(transaksi, excludeId, alatId, mulai, selesai) {
  if (!alatId || !mulai || !selesai) return [];
  return (transaksi ?? []).filter(
    (t) =>
      t.id !== excludeId &&
      AKTIF.includes(t.status) &&
      overlap(mulai, selesai, t.tanggal_mulai, t.tanggal_selesai) &&
      (t.baris ?? []).some((b) => b.jenis === "alat" && b.alat_id === alatId),
  );
}

// Sapuan pasangan job aktif yang berebut alat. Dipakai Ringkasan
// (kartu Perhatian) dan lencana tabel Transaksi. Nama alat dari daftar alat,
// fallback ke nama baris bila alat sudah diarsip.
export function semuaBentrok(transaksi, alat = []) {
  const aktif = (transaksi ?? []).filter(
    (t) => AKTIF.includes(t.status) && t.tanggal_mulai && t.tanggal_selesai,
  );
  const namaAlat = (id, fallback) =>
    alat.find((a) => a.id === id)?.nama ?? fallback ?? "Alat";
  const lihat = new Set();
  const hasil = [];
  for (const t of aktif) {
    for (const b of t.baris ?? []) {
      if (b.jenis !== "alat" || !b.alat_id) continue;
      for (const l of cariBentrok(
        aktif,
        t.id,
        b.alat_id,
        t.tanggal_mulai,
        t.tanggal_selesai,
      )) {
        const kunci = [t.id, l.id, b.alat_id].sort().join("-");
        if (lihat.has(kunci)) continue;
        lihat.add(kunci);
        hasil.push({
          alat_id: b.alat_id,
          alatNama: namaAlat(b.alat_id, b.nama),
          a: t,
          b: l,
        });
      }
    }
  }
  return hasil;
}
