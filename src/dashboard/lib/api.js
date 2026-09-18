// HTTP client dashboard: fetch wrapper + 401 draft-rescue branch (Q36).
// Snapshot is read from liveDraft (open drawers register readers on mount).

import { draftAda, stashDraft } from "./draft.js";
import { readLive } from "./liveDraft.js";

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
  });
  if (res.status === 401) {
    // Rescue builder drafts before redirecting to login.
    try {
      const readers = readLive();
      const d = readers.tx();
      if (d && (d.nama_project || d.nama_client || d.baris?.length))
        stashDraft("transaksi", d);
      const rd = readers.rab();
      if (draftAda(rd)) stashDraft("rab", rd);
      const br = readers.brief();
      if (br) stashDraft("brief", br);
    } catch {}
    // pi-lens-ignore: no-open-redirect, no-open-redirect-js
    location.href = "login.html";
    throw new Error("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
