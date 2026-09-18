// Live snapshot for 401 draft rescue (Q36). Open drawers register snapshot readers on mount.
// Plain module, not a rune, since it's only read during 401 events, not for rendering.

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
