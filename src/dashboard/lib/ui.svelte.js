// UI shell state untuk dashboard Ember: drawer, print modal, toast, nav mobile.
// Satu modul rune agar semua view/drawer baca langsung tanpa prop drilling.
// Bukan domain data (itu di store.svelte.js): ini murni UI state.

export const ui = $state({
  mobileNav: false,
  drawer: { open: false, type: null, data: null, prefill: null },
  print: { open: false, title: "", html: "" },
  toast: { msg: "", type: "success", visible: false },
});

let toastTimer = null;

export function openDrawer(type, data = null, prefill = null) {
  ui.drawer = { open: true, type, data, prefill };
}

export function closeDrawer() {
  ui.drawer = { open: false, type: null, data: null, prefill: null };
}

export function showPrint(title, html) {
  ui.print = { open: true, title, html };
}

export function closePrint() {
  ui.print = { open: false, title: "", html: "" };
}

export function showToast(msg, type = "success") {
  ui.toast = { msg, type, visible: true };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast.visible = false;
  }, 3500);
}
