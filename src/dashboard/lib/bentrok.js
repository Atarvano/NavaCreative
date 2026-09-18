// Detect equipment schedule conflicts (overlapping dates for one equipment in active jobs).
// Pure, no store. Gives warnings BEFORE save (walk-in form) and badges in tables/cards.

const AKTIF = ["terjadwal", "berjalan"];

const overlap = (a1, a2, b1, b2) =>
  a1 && a2 && b1 && b2 && a1 <= b2 && a2 >= b1;

// All jobs competing for one equipment in a date range. Used by walk-in form (realtime warning) before POST.
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

// Sweep active job pairs competing for equipment. Used by Summary cards and Transaction badges.
// Equipment names come from equipment list, falling back to line name if archived.
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
