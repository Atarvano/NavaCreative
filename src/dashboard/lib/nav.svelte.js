// Minimal hash navigation: view keys, one-off filters, and hash sync.
// Shell closes drawers on view change, views self-reset on unmount. Not a router (ADR-0006).

// Sidebar nav labels strictly match prototype copy instead of condensed glossary terms.
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

// Pending filter for view jumps (e.g. Summary to Invoice). Target view reads then clears it.
export const pendingFilter = $state({ invoice: null, transaksi: null });

// Pending expand (e.g. Attention items opening their rows).
export const pendingExpand = $state({ transaksi: null, invoice: null });

export function go(v) {
  location.hash = "#/" + v;
}

export const viewDariHash = () =>
  (location.hash.match(/^#\/([\w-]+)/) ?? [])[1];
