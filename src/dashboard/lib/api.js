// HTTP client for the dashboard (spec: ticket 10, ADR-0014).
//
// This is the same fetch wrapper with the 401 draft-rescue branch that lived
// in DashboardApp.svelte, then in store.svelte.js. It has its own module now
// because the store is about data+actions while this is transport + auth.
//
// COUPLED TO THE UI ON PURPOSE: the 401 branch snapshots the in-flight builder
// drafts before redirecting to login (Q36). Those drafts are view/UI state, so
// api.js cannot import them — instead the shell registers readers via
// setDraftReaders (same shape as nav's setNavHooks). ADR-0014 records this
// coupling as explicit and deliberately not inverted.

import { draftAda, stashDraft } from "./draft.js";

let draftReaders = { tx: () => ({}), rab: () => ({}), brief: () => null };

export function setDraftReaders(readers) {
  draftReaders = { ...draftReaders, ...readers };
}

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
  });
  if (res.status === 401) {
    // Q36: selamatkan draft builder sebelum pindah ke login.
    const d = draftReaders.tx();
    if (d.nama_project || d.nama_client || d.baris?.length)
      stashDraft("transaksi", d);
    const rd = draftReaders.rab();
    if (draftAda(rd)) stashDraft("rab", rd);
    const br = draftReaders.brief();
    if (br) stashDraft("brief", br);
    // pi-lens-ignore: no-open-redirect, no-open-redirect-js
    location.href = "login.html";
    throw new Error("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
