// Snapshot hidup untuk penyelamatan draft 401 (Q36).
// Drawer yang sedang terbuka mendaftarkan pembaca snapshot-nya saat mount
// dan melepasnya saat destroy. api.js memanggil lewat setDraftReaders yang
// didaftarkan shell sekali di onMount. Bukan rune: modul polos cukup karena
// hanya dibaca saat event 401, bukan untuk render.

const readers = { tx: () => ({}), rab: () => ({}), brief: () => null };

export function setLiveReader(key, fn) {
  readers[key] = fn;
}

export function clearLiveReader(key) {
  readers[key] = key === "brief" ? () => null : () => ({});
}

export function readLive() {
  return readers;
}
