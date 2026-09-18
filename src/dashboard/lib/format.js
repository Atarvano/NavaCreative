// Shared presentation/formatting helpers for the dashboard (spec: ticket 06).
// Pure functions only — no store import, no DOM. Extracted verbatim from
// DashboardApp.svelte so "how do we format a rupiah amount" has one answer.

export const rupiah = (n) => "Rp " + Number(n).toLocaleString("id-ID");

// ponytail: one subtotal / one grouper / one sorter for all tables.
export const subtotal = (baris) =>
  baris.reduce((t, b) => t + b.qty * b.harga_satuan, 0);

export const grupBaris = (baris) => {
  const by = new Map();
  for (const b of baris ?? []) {
    const g = b.kategori || "PRODUCTION";
    if (!by.has(g)) by.set(g, []);
    by.get(g).push(b);
  }
  return [...by.entries()].map(([kategori, rows]) => ({
    kategori,
    baris: rows,
    subtotal: subtotal(rows),
  }));
};

// Siklus sort satu kolom: desc → asc → terbaru (null). get/set agar
// tx/rab/inv bisa berbagi badan yang sama.
export function urutkan(get, set, key) {
  const [k, desc] = get();
  if (k === key) set(desc ? k : null, desc ? false : true);
  else set(key, true);
}

// Sisa event menuju balik modal pada tarif sekarang — teks badge + tier.
export const eventKurang = (a) =>
  a.tarif_event > 0
    ? Math.max(0, Math.ceil((a.modal - a.pendapatan) / a.tarif_event))
    : null;

// Badge Balik modal 3-warna (Q11/Q16, ticket 08): hijau balik modal; kuning
// tinggal ≤3 event; merah selebihnya. Uses the ADR-0013 tint tokens (the same
// ok/warn/danger family the spec names) so the trio clears ≥7:1 on the tint
// over the charcoal card; text always accompanies colour.
export const balikModalBadge = (a) => {
  if (a.balik_modal)
    return { cls: "bg-rw-ok/15 text-rw-ok-text", text: "Balik modal" };
  const kurang = eventKurang(a);
  if (kurang !== null && kurang <= 3)
    return {
      cls: "bg-rw-warn/15 text-rw-warn-text",
      text: `Kurang ${kurang} event`,
    };
  return {
    cls: "bg-rw-danger/15 text-rw-danger-text",
    text:
      kurang === null
        ? "Belum balik modal"
        : `Belum balik modal · kurang ${kurang} event`,
  };
};

// Chip status 3 warna + teks (Q11): hijau selesai/kuning berjalan/merah bahaya.
// Satu klasifikasi lifecycle dipakai bersama; `rwChip` memetakan kind ke palet
// Railway dark (ADR-0013 Q19). Nilai status dari data tetap apa adanya.
export const statusKind = (status, overdue = false) => {
  if (overdue || status === "batal" || status === "rejected") return "danger";
  if (status === "paid" || status === "approved" || status === "selesai")
    return "ok";
  return "neutral";
};

// Chip status versi Railway: teks terang di atas tint 15%, kontras >=7:1 pada
// permukaan charcoal #33323E tempat badge ini dirender.
export const rwChip = (status, overdue = false) => {
  const kind = statusKind(status, overdue);
  if (kind === "danger") return "bg-rw-danger/15 text-rw-danger-text";
  if (kind === "ok") return "bg-rw-ok/15 text-rw-ok-text";
  return "bg-rw-off-white/10 text-rw-off-white";
};

// Tanggal tampil Indonesia pendek (Q30): 2 Agu 2026. Input tetap date.
export const tgl = (iso) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

// H+7 dihitung tanggal LOKAL, bukan UTC (toISOString bisa geser sehari kalau
// diterbitkan pagi buta WIB).
// ponytail: en-CA memberi YYYY-MM-DD lokal tanpa padStart manual.
export const hariIniPlus = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
};

// Tanggal cetak Indonesia pendek (Q33): "17 Agu 2026". iso = 'YYYY-MM-DD'.
export const tglCetak = (iso) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
