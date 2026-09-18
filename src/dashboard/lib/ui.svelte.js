// Ember dashboard UI shell state: drawer, print modal, toast, mobile nav.
// Single rune module to avoid prop drilling. Purely UI state, not domain data.

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
