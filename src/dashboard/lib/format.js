// Pure formatters for currency, dates, line math, and badges.
// Lines always use backend shape: { jenis: 'alat'|'jasa'|'biaya', nama, qty, satuan, harga_satuan }.

export const rupiah = (n) => "Rp " + Number(n ?? 0).toLocaleString("id-ID");

// Single source of truth for line summation across all tables and drawers.
export const subtotal = (baris) =>
  (baris ?? []).reduce(
    (t, b) => t + (Number(b.qty) || 0) * (Number(b.harga_satuan) || 0),
    0,
  );

// Subtotals per type for cards and details (Ember-style labels: Alat/Jasa/Biaya).
const JENIS_LABEL = { alat: "Alat", jasa: "Jasa", biaya: "Biaya" };
export const subJenis = (baris) => {
  const s = { Alat: 0, Jasa: 0, Biaya: 0 };
  for (const b of baris ?? []) {
    const k = JENIS_LABEL[b.jenis] ?? "Alat";
    s[k] += (Number(b.qty) || 0) * (Number(b.harga_satuan) || 0);
  }
  return s;
};

// Short Indonesian date display (e.g., 2 Agu 2026). Inputs remain type=date.
export const tgl = (iso) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

// Local today YYYY-MM-DD without timezone shift.
// Note: en-CA gives local format without manual padStart.
export const hariIni = () => new Date().toLocaleDateString("en-CA");

// Cash card label from API month (e.g., "2026-09" -> "September 2026").
export const bulanLabel = (ym) =>
  ym
    ? new Date(ym + "-02T00:00:00").toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      })
    : "";

export const isOverdue = (jatuhTempo, sisa) =>
  Number(sisa) > 0 && !!jatuhTempo && hariIni() > jatuhTempo;

// 3-tier break-even badge from backend figures (capital + revenue).
export const breakEven = (modal, pendapatan) => {
  const m = Number(modal) || 0;
  const p = Number(pendapatan) || 0;
  const pct = m <= 0 ? 100 : Math.round((p / m) * 100);
  if (pct >= 100)
    return {
      label: `Balik Modal (${pct}%)`,
      cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
    };
  if (pct >= 50)
    return {
      label: `Hampir Balik (${pct}%)`,
      cls: "bg-amber-100 text-amber-800 border-amber-200",
    };
  return {
    label: `Belum Balik (${pct}%)`,
    cls: "bg-red-100 text-red-800 border-red-200",
  };
};

// Unified status badge map for Transactions, RAB, and Invoices.
const BADGE = {
  terjadwal: ["Terjadwal", "bg-amber-100 text-amber-900 border-amber-200"],
  berjalan: ["Berjalan", "bg-orange-100 text-[#C2410C] border-orange-200"],
  selesai: ["Selesai", "bg-emerald-100 text-emerald-800 border-emerald-200"],
  approved: ["Disetujui", "bg-emerald-100 text-emerald-800 border-emerald-200"],
  paid: ["Lunas", "bg-emerald-100 text-emerald-800 border-emerald-200"],
  draft: ["Draft", "bg-stone-100 text-stone-800 border-stone-200"],
  sent: ["Terkirim", "bg-blue-100 text-blue-800 border-blue-200"],
  rejected: ["Ditolak", "bg-red-100 text-red-800 border-red-200"],
  batal: ["Batal", "bg-stone-200 text-stone-700 border-stone-300"],
  unpaid: ["Belum Lunas", "bg-red-100 text-red-800 border-red-200"],
  partial: ["Sebagian (DP)", "bg-amber-100 text-amber-800 border-amber-200"],
};

export const statusBadge = (status) => {
  const [text, cls] = BADGE[status] ?? [
    status,
    "bg-stone-100 text-stone-700 border-stone-200",
  ];
  return { text, cls };
};
