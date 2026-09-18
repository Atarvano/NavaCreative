// Draft stash for dashboard builders (spec: ticket 06). Key format is `nava-draft-<key>`.
// localStorage-only; load-bearing for 401 rescue and onMount restore.

export function stashDraft(key, value) {
  try {
    localStorage.setItem("nava-draft-" + key, JSON.stringify(value));
  } catch {}
}

export function ambilDraft(key) {
  try {
    const raw = localStorage.getItem("nava-draft-" + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hapusDraft(key) {
  try {
    localStorage.removeItem("nava-draft-" + key);
  } catch {}
}

// "Is there anything worth saving?" — shared by the walk-in, RAB and Brief
// stash paths. Note it keys off nama_project / nama_client / baris, which the
// Brief snapshot does NOT carry (a Brief draft is gated on `briefOpenId`
// instead), so callers must not use this for Brief.
export const draftAda = (d) =>
  !!(d && (d.nama_project || d.nama_client || d.baris?.length));
