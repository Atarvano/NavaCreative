// Navigasi hash minimal untuk dashboard Ember: kunci view, filter sekali
// pakai (lompatan kartu Ringkasan), expand sekali pakai, dan sinkron hash.
// Tanpa hook registry: drawer ditutup langsung oleh shell saat view berganti,
// tiap view me-reset UI-nya sendiri saat unmount. Bukan router (ADR-0006).

// Label nav ditempel plek dari index.html prototipe ("RAB (Estimasi)",
// "Paket Template"): yang tampil di sidebar adalah copy prototipe,
// bukan istilah glossary yang dipadatkan.
export const NAV = [
  [
    "Operasional",
    [
      ["ringkasan", "Ringkasan"],
      ["transaksi", "Transaksi"],
      ["rab", "RAB (Estimasi)"],
      ["invoice", "Invoice"],
      ["paket", "Paket Template"],
    ],
  ],
  ["Master Data", [["alat", "Alat & Servis"]]],
];

export const VIEW_KEYS = [
  ...NAV.flatMap(([, g]) => g.map(([k]) => k)),
  "settings",
];

export const view = $state({ current: "ringkasan" });

// Filter titipan untuk lompatan antar view (kartu Ringkasan ke
// Invoice/Transaksi terfilter). View tujuan membaca lalu mengosongkannya.
export const pendingFilter = $state({ invoice: null, transaksi: null });

// Expand titipan (item Perhatian/Transaksi terbaru membuka barisnya).
export const pendingExpand = $state({ transaksi: null, invoice: null });

export function go(v) {
  location.hash = "#/" + v;
}

export const viewDariHash = () =>
  (location.hash.match(/^#\/([\w-]+)/) ?? [])[1];
