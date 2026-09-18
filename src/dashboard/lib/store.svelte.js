// Dashboard store (spec: ticket 07, ADR-0014).
//
// Owns DATA (me, alat, paket, rabs, transaksi, invoices, settings, ringkasan)
// and the ACTIONS that mutate it. Views consume these and keep only their own
// UI state (form fields, which row is open).
//
// This is a `.svelte.js` module so Svelte 5 runes work outside a component.
//
// WHY ONE `state` OBJECT, NOT `export let x = $state(...)`:
// Svelte 5 makes an imported binding read-only, so a component cannot do
// `error = '...'` on a binding imported from another module. Exporting one
// reactive object and mutating its PROPERTIES (`store.error = '...'`) is the
// supported cross-module pattern and keeps every call site working.
//
// BEHAVIOUR CONTRACT — these asymmetries are deliberate (audited pre-refactor)
// and must NOT be "fixed" in this pass:
//   1. Fourteen mutations end with `await load()`, which fetches SIX endpoints
//      SEQUENTIALLY in the fixed order alat -> paket -> rab -> transaksi ->
//      invoice -> settings. Do not parallelise, narrow, or skip it.
//   2. `simpanBrief` and `simpanSettings` deliberately DO NOT refetch.
//   3. `toggle` and the detail openers update only a slice, not the whole store.

import { ambilDraft, hapusDraft, draftAda, stashDraft } from "./draft.js";
import { subtotal } from "./format.js";
import { api } from "./api.js";
import { showToast } from "./ui.svelte.js";

// Re-exported so existing callers (the shell's onMount) keep one import site.
export { api };

// Retrieve rescued 401 drafts (called once by the shell after initial load).
// Toast + drawer opening is the caller's concern via openDrawer.
export function pulihkanDraft401() {
  const tx = ambilDraft("transaksi");
  const rb = ambilDraft("rab");
  const br = ambilDraft("brief");
  if (draftAda(tx) || draftAda(rb) || br) {
    showToast("Draft pekerjaan Anda berhasil dipulihkan secara otomatis!");
    return { tx: draftAda(tx) ? tx : null, rb: draftAda(rb) ? rb : null, br };
  }
  return { tx: null, rb: null, br: null };
}

// State
export const state = $state({
  me: null,
  alat: [],
  paket: [],
  rabs: [],
  transaksi: [],
  invoices: [],
  settings: {},
  ringkasan: null,
  error: "",
  notice: "",
  busy: false,
});

// Load (six-endpoint sequential fetch)
export async function load() {
  const { res, data } = await api("/api/alat");
  if (!res.ok) {
    state.error = data.error ?? "Gagal memuat alat.";
    return;
  }
  state.alat = data.alat;
  const pr = await api("/api/paket");
  if (pr.res.ok) state.paket = pr.data.paket;
  const rr = await api("/api/rab");
  if (rr.res.ok) state.rabs = rr.data.rab;
  const tr = await api("/api/transaksi");
  if (tr.res.ok) state.transaksi = tr.data.transaksi;
  const ir = await api("/api/invoice");
  if (ir.res.ok) state.invoices = ir.data.invoice;
  // Identity auto-fill source (Q23); print views read from here.
  const sr = await api("/api/settings");
  if (sr.res.ok) state.settings = sr.data.settings;
}

export async function muatRingkasan() {
  const { res, data } = await api("/api/ringkasan");
  if (res.ok) state.ringkasan = data;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  // pi-lens-ignore: no-open-redirect, no-open-redirect-js
  location.href = "login.html";
}

// Alat
export async function addAlat(payload) {
  const { res, data } = await api("/api/alat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    state.error = data.error ?? "Gagal menambah alat.";
    return null;
  }
  state.notice = `${data.nama} ditambahkan. Modal awal ${"Rp " + Number(data.modal).toLocaleString("id-ID")}.`;
  await load();
  return data;
}

export async function arsipkan(a) {
  const { res, data } = await api(`/api/alat/${a.id}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: false }),
  });
  if (res.ok) {
    state.notice = `${a.nama} diarsipkan — aktifkan lagi lewat toggle “Tampilkan arsip”.`;
    await load();
  } else state.error = data.error ?? "Gagal mengarsipkan.";
  return res.ok;
}

export async function aktifkan(a) {
  const { res, data } = await api(`/api/alat/${a.id}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: true }),
  });
  if (res.ok) {
    state.notice = `${a.nama} aktif kembali.`;
    await load();
  } else state.error = data.error ?? "Gagal mengaktifkan kembali.";
  return res.ok;
}

// Servis history for one alat. Partial update by design (no full refetch).
export async function muatServis(alatId) {
  const { res, data } = await api(`/api/alat/${alatId}/servis`);
  return res.ok ? data.servis : [];
}

export async function addServis(a, payload) {
  const { res, data } = await api(`/api/alat/${a.id}/servis`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    state.error = data.error ?? "Gagal mencatat servis.";
    return null;
  }
  state.notice = `Servis ${"Rp " + Number(data.biaya).toLocaleString("id-ID")} tercatat. Modal ${a.nama} bertambah.`;
  await load();
  return data;
}

// Paket
export async function simpanPaket({ editing, targetId, payload }) {
  const { res, data } = await api(
    editing ? `/api/paket/${targetId}` : "/api/paket",
    {
      method: editing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    state.error =
      data.error ??
      (editing ? "Gagal mengubah paket." : "Gagal menyimpan paket.");
    return { ok: false };
  }
  state.notice = editing
    ? `${data.nama ?? payload.nama} diubah. RAB/Transaksi lama tidak ikut berubah.`
    : `${data.nama ?? payload.nama} ditambahkan.`;
  await load();
  return { ok: true, data };
}

// Create RAB from Paket: returns the copied rows; navigation stays in the view.
export async function dariPaket(p) {
  const { res, data } = await api(`/api/paket/${p.id}/ke-rab`);
  if (!res.ok) {
    state.error = data.error ?? "Gagal menyalin paket.";
    return null;
  }
  return data;
}

// RAB
export async function simpanRab(payload) {
  const { res, data } = await api("/api/rab", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    state.error = data.error ?? "Gagal menyimpan RAB.";
    return { ok: false };
  }
  state.notice = `${data.nomor} tersimpan sebagai draft.`;
  await load();
  return { ok: true, data };
}

export async function statusRab(r, status) {
  const { res, data } = await api(`/api/rab/${r.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (res.ok) {
    state.notice = `${r.nomor} → ${status}.`;
    await load();
  } else state.error = data.error ?? "Gagal ubah status.";
  return res.ok;
}

export async function setujui(r) {
  const { res, data } = await api(`/api/rab/${r.id}/setujui`, {
    method: "POST",
  });
  if (!res.ok) {
    state.error = data.error ?? "Gagal menyetujui.";
    return null;
  }
  state.notice = `${r.nomor} disetujui → Transaksi #${data.transaksi_id}.`;
  await load();
  return data.transaksi_id;
}

// Edit RAB: PATCH header + rows + discount + notes while not yet approved
// (approved locked by API, 409).
export async function ubahRab(id, payload) {
  const { res, data } = await api(`/api/rab/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    state.error = data.error ?? "Gagal mengubah RAB.";
    return { ok: false };
  }
  state.notice = `${data.nomor} diperbarui.`;
  await load();
  return { ok: true, data };
}

// Transaksi
export async function simpanTransaksi(payload) {
  const { res, data } = await api("/api/transaksi", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    state.error = data.error ?? "Gagal menyimpan transaksi.";
    return { ok: false };
  }
  state.notice = data.bentrok?.length
    ? `Tersimpan — bentrok dengan ${data.bentrok.map((b) => b.nama_project).join(", ")}.`
    : "Transaksi walk-in tersimpan.";
  await load();
  return { ok: true, data };
}

export async function statusTransaksi(t, status) {
  const { res, data } = await api(`/api/transaksi/${t.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (res.ok) {
    state.notice = data.bentrok?.length
      ? `Bentrok: ${data.bentrok.map((b) => b.nama_project).join(", ")}.`
      : `${t.nama_project} → ${status}.`;
    await load();
  } else state.error = data.error ?? "Gagal ubah status.";
  return res.ok;
}

// Detail openers: partial update by design (single response, no refetch).
export async function muatBrief(transaksiId) {
  const { res, data } = await api(`/api/transaksi/${transaksiId}/brief`);
  return res.ok ? data.brief : null;
}

// Deliberately NO refetch (contract asymmetry #2).
export async function simpanBrief(transaksiId, payload) {
  const { res, data } = await api(`/api/transaksi/${transaksiId}/brief`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    state.error = data.error ?? "Gagal menyimpan brief.";
    return { ok: false };
  }
  return { ok: true, brief: data.brief };
}

// Invoice
export async function terbitkan(t) {
  const jt = hariIniPlusLocal(7);
  const { res, data } = await api(`/api/transaksi/${t.id}/invoice`, {
    method: "POST",
    body: JSON.stringify({ jatuh_tempo: jt }),
  });
  if (!res.ok) {
    state.error = data.error ?? "Gagal menerbitkan invoice.";
    return null;
  }
  state.notice = `${data.nomor} terbit (tempo ${tglLocal(data.jatuh_tempo)}). Baris transaksi dikunci.`;
  await load();
  return data;
}

export async function muatInvoice(invoiceId) {
  const { res, data } = await api(`/api/invoice/${invoiceId}`);
  return res.ok ? data : null;
}

export async function simpanTempo(i, jatuhTempo) {
  const { res, data } = await api(`/api/invoice/${i.id}`, {
    method: "PATCH",
    body: JSON.stringify({ jatuh_tempo: jatuhTempo }),
  });
  if (!res.ok) {
    state.error = data.error ?? "Gagal mengubah jatuh tempo.";
    return { ok: false };
  }
  state.notice = `Tempo ${i.nomor} diubah ke ${tglLocal(data.jatuh_tempo)}.`;
  await load();
  return { ok: true, data };
}

export async function bayar(i, payload) {
  const { res, data } = await api(`/api/invoice/${i.id}/bayar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    state.error = data.error ?? "Gagal mencatat pembayaran.";
    return { ok: false };
  }
  state.notice = `Terbayar ${"Rp " + Number(data.dibayar).toLocaleString("id-ID")}, sisa ${"Rp " + Number(data.sisa).toLocaleString("id-ID")}.`;
  await load();
  return { ok: true, data };
}

export async function voidInvoice(i) {
  const { res, data } = await api(`/api/invoice/${i.id}/batal`, {
    method: "POST",
  });
  if (res.ok) {
    state.notice = `${i.nomor} dibatalkan.`;
    await load();
  } else state.error = data.error ?? "Gagal membatalkan.";
  return res.ok;
}

// Settings
// Deliberately NO refetch (contract asymmetry #2): updates from the response.
export async function simpanSettings(payload) {
  const { res, data } = await api("/api/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    state.error = data.error ?? "Gagal menyimpan settings.";
    return { ok: false };
  }
  state.settings = data.settings;
  state.notice = "Settings tersimpan. Dokumen berikutnya pakai identitas baru.";
  return { ok: true, settings: data.settings };
}

// Local date helpers
// Kept local (not imported from format.js) so the store has no dependency on
// presentation helpers; behaviour is identical to format.js.
function hariIniPlusLocal(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}
function tglLocal(iso) {
  return iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
}

// Re-export helpers callers commonly need alongside the store.
export { subtotal, ambilDraft, hapusDraft, draftAda, stashDraft };
