// Dashboard navigation (spec: ticket 08, ADR-0014).
//
// Hash-based view navigation, exactly as before the extraction: `#/rab`,
// `#/invoice`, ... ADR-0006 rules out a real router (a router would change URLs
// and back-button behaviour — a feature change, not a restructure).
//
// WHY A HOOK REGISTRY: `tampilkan()` must close the Panel, reset per-view UI
// state, and open a row on a cross-view jump. Those are the shell's and the
// views' concerns, not nav's — so nav calls registered hooks instead of
// importing them. Same pattern as the store's `setDraftReaders`; ADR-0014
// records the coupling.
//
// ORDERING CONTRACT (do not "simplify"):
//  - A cross-view jump calls `tampilkan()`, which CLOSES the Panel. The wanted
//    Panel content rides in `pendingPanel` and is consumed by `tampilkan()`
//    AFTER the reset, once the target view is active. Opening the Panel at the
//    jump site would be closed again immediately.
//  - `lompatExpand` is the one deliberate exception to expand-reset (Q25): it is
//    re-applied right after the reset. Both are imperative one-shots, never
//    reactive state.

import { state } from "./store.svelte.js";

// --- View keys ----------------------------------------------------------
// The icon component per view lives in the shell (it imports the glyphs), so
// nav carries only the keys/labels and the shell maps keys to icons.
export const NAV = [
  [
    "OPERASIONAL",
    [
      ["ringkasan", "Ringkasan"],
      ["transaksi", "Transaksi"],
      ["rab", "RAB"],
      ["invoice", "Invoice"],
      ["paket", "Paket"],
    ],
  ],
  ["MASTER", [["alat", "Alat"]]],
];

export const VIEW_KEYS = [
  ...NAV.flatMap(([, g]) => g.map(([k]) => k)),
  "settings",
];

export const view = $state({ current: "ringkasan" });

// --- Hooks (registered by the shell / views) ----------------------------
let hooks = {
  tutupPanel: () => {},
  bukaPanel: () => {},
  bukaInvoice: () => {},
  bukaTransaksi: () => {},
  resetViewUi: () => {},
  onSettingsEnter: () => {},
};

export function setNavHooks(next) {
  hooks = { ...hooks, ...next };
}

// One-shot carries (imperative, never reactive — see the ordering contract).
let lompatExpand = null;
let pendingPanel = null;

// A cross-view jump may pre-filter the destination view (Ringkasan's cards →
// filtered Invoice/Transaksi). Since ticket 09 each view owns its own filter
// state, the filter cannot be assigned imperatively on state that is about to
// be re-created or that lives in another component. It travels as a one-shot:
//  - cross-view: the destination view reads it when it mounts;
//  - same-view: the mounted view reacts to this rune.
export const pendingFilter = $state({ invoice: null, transaksi: null });

export function setPendingPanel(panel) {
  pendingPanel = panel;
}

// --- Navigation ---------------------------------------------------------
export async function tampilkan(v) {
  if (!VIEW_KEYS.includes(v)) v = "ringkasan";
  view.current = v;
  // Panel is bound to a form opened from one view; leaving that view closes it
  // so a stale Panel never floats over an unrelated view (ticket 02).
  hooks.tutupPanel();
  // Q25: expand reset saat pindah view (lompat Ringkasan #58 = pengecualian:
  // lompatExpand dipasang ulang tepat sesudah reset di bawah).
  hooks.resetViewUi(v);
  if (lompatExpand) {
    const { target, id } = lompatExpand;
    lompatExpand = null;
    if (target === "invoice" && v === "invoice") {
      const inv = state.invoices.find((x) => x.id === id);
      if (inv) hooks.bukaInvoice(inv);
    } else if (target === "transaksi" && v === "transaksi") {
      const t = state.transaksi.find((x) => x.id === id);
      if (t) hooks.bukaTransaksi(t);
    }
  }
  if (v === "ringkasan") {
    const { res, data } = await fetch("/api/ringkasan").then(async (r) => ({
      res: r,
      data: await r.json().catch(() => ({})),
    }));
    if (res.ok) state.ringkasan = data;
  }
  // Cross-view Panel open (ticket 05): consumed after the reset above so the
  // Panel is not closed again by this same tampilkan() call. Clear it whichever
  // view lands, so a redirected/missed switch can never leave a stale one-shot
  // that pops the Panel on a later unrelated #/rab visit.
  if (pendingPanel) {
    const { view: wantView, judul, isi } = pendingPanel;
    pendingPanel = null;
    if (wantView === v) hooks.bukaPanel(judul, isi);
  }
  if (v === "settings") hooks.onSettingsEnter();
}

export function lompatInvoice(filter = "semua", expandId = null, deps) {
  if (view.current === "invoice") {
    // Sudah di view target: tak ada hashchange → pasang filter + expand langsung.
    pendingFilter.invoice = filter;
    const inv = expandId ? state.invoices.find((x) => x.id === expandId) : null;
    if (inv) hooks.bukaInvoice(inv);
    else deps.clearInvoiceOpen();
    return;
  }
  pendingFilter.invoice = filter;
  lompatExpand = expandId ? { target: "invoice", id: expandId } : null;
  go("invoice");
}

export function lompatTransaksi(filter = "semua", expandId = null, deps) {
  if (view.current === "transaksi") {
    pendingFilter.transaksi = filter;
    const t = expandId ? state.transaksi.find((x) => x.id === expandId) : null;
    if (t) hooks.bukaTransaksi(t);
    else deps.clearTransaksiOpen();
    return;
  }
  pendingFilter.transaksi = filter;
  lompatExpand = expandId ? { target: "transaksi", id: expandId } : null;
  go("transaksi");
}

export function go(v) {
  location.hash = "#/" + v;
}

export const viewDariHash = () =>
  (location.hash.match(/^#\/([\w-]+)/) ?? [])[1];
