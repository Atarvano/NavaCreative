// Print templates for the dashboard documents (spec: ticket 06).
// Pure with respect to the store: every function receives what it needs
// (the record, the settings snapshot, the row grouper). Nothing here reads
// the store — the store supplies the arguments.
// Output must stay byte-identical: kop, CSS, red, logo fallback, dates.

import { rupiah, tglCetak } from "./format.js";

// Logo merah studio: file statis di public/ (B5). Sampai user menaruh file,
// kop memakai fallback teks nama studio. Path ini juga disebut di Settings
// (Q29) supaya mengganti logo = taruh file + deploy, tanpa ubah kode.
export const LOGO_PATH = "img/logo-red.png";
export const MERAH = "#b3001b"; // merah kop dokumen (di luar palet landing; cetak saja)

// Kop merah: slot logo + fallback teks sampai file disuplai, identitas dari
// settings (Q23). Inline style + tabel agar konsisten di jendela print polos.
export function kopDokumen(settings, subjudul = "") {
  const s = settings;
  const kontak = [s.hp, s.email].filter(Boolean).join(" · ");
  const logo = `<img src="${LOGO_PATH}" alt="${s.nama ?? "Nava Creative"}" style="height:56px;display:block" onerror="this.style.display='none';document.getElementById('kop-fallback').style.display='block'" />`;
  const fallback = `<div id="kop-fallback" style="display:none;font-size:26px;font-weight:700;color:${MERAH};letter-spacing:-0.02em">${s.nama ?? "Nava Creative"}</div>`;
  return `<table style="width:100%;border-collapse:collapse;border-bottom:3px solid ${MERAH};padding-bottom:12px"><tr>
      <td style="vertical-align:middle">${logo}${fallback}</td>
      <td style="vertical-align:middle;text-align:right;font-size:12px;color:#333">
        ${subjudul ? `<div style="font-weight:700;color:${MERAH}">${subjudul}</div>` : ""}
        ${kontak ? `<div>${kontak}</div>` : ""}
      </td></tr></table>`;
}

// CSS dasar semua dokumen cetak plek (font, margin, warna judul merah).
export const CETAK_CSS = `body{font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:32px auto;color:#111;font-size:13px}
    h1{color:${MERAH};font-size:22px;margin:18px 0 10px;letter-spacing:0}
    table.layout{width:100%;border-collapse:collapse}
    .merah{color:${MERAH}}`;

// ponytail: satu pintu cetak — 3 print fn hanya menyetor judul + body.
//
// Prints via a hidden same-origin <iframe> rather than window.open: the popup
// route tripped an open-redirect lint false positive (the flagged URL argument
// was the empty string, never a user-supplied target). An iframe keeps the
// print path local, has no redirect surface at all, and cannot be blocked by a
// popup blocker. The written document and the print() call are byte-identical
// to the previous window.open path.
export function cetakDokumen(judul, body) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.append(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  // Byte-identical body to the previous window.open path, `onload="print()"`
  // included: the frame's own load event fires the print dialog, so the
  // written document and the print trigger are both unchanged.
  doc.write(
    `<html lang="id"><head><meta charset="utf-8"><title>${judul}</title><style>${CETAK_CSS}</style></head><body onload="print()">${body}</body></html>`,
  );
  doc.close();
  // Drop the hidden frame once the print dialog has been raised.
  setTimeout(() => frame.remove(), 1000);
}

// Print RAB plek dokumen asli (redesign 08, #61): kop merah (slot logo +
// fallback teks), judul merah + nomor sistem, PROJECT vs UNTUK, grup
// kategori + subtotal merah, TOTAL FINAL merah, catatan, disclaimer estimasi.
export function printRab(r, settings, rabGrup) {
  const grup = rabGrup(r);
  const grupHtml = grup
    .map((g) => {
      const baris = g.baris
        .map(
          (b) =>
            `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd">${b.nama}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;white-space:nowrap">${b.qty} ${b.satuan ?? ""}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${rupiah(b.qty * b.harga_satuan)}</td></tr>`,
        )
        .join("");
      return `<tr><td colspan="3" style="padding:10px 8px 4px;font-weight:700;color:${MERAH};text-transform:uppercase;letter-spacing:0.04em">${g.kategori}</td></tr>
          ${baris}
          <tr><td colspan="2" style="padding:6px 8px;text-align:right;font-weight:700;color:${MERAH}">Subtotal ${g.kategori}</td><td style="padding:6px 8px;text-align:right;font-weight:700;color:${MERAH}">${rupiah(g.subtotal)}</td></tr>`;
    })
    .join("");
  cetakDokumen(
    r.nomor,
    `
      ${kopDokumen(settings, "RANCANGAN ANGGARAN BIAYA")}
      <h1>RANCANGAN ANGGARAN BIAYA</h1>
      <table class="layout" style="margin:8px 0 16px"><tr>
        <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Project</div><div style="font-weight:700;font-size:15px">${r.nama_project}</div></td>
        <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Untuk</div><div style="font-weight:700;font-size:15px">${r.nama_client}${r.perusahaan_client ? " — " + r.perusahaan_client : ""}</div></td>
      </tr></table>
      <p style="margin:0 0 12px;color:#555">${r.nomor} · ${tglCetak(r.tanggal_rab)}</p>
      <table class="layout" style="border-top:2px solid #111">
        <tr><th style="text-align:left;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Item</th><th style="text-align:left;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Qty</th><th style="text-align:right;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Subtotal</th></tr>
        ${grupHtml}
      </table>
      <table class="layout" style="margin-top:8px;border-top:2px solid #111"><tr>
        <td style="padding:10px 8px;text-align:right;font-weight:700">${r.diskon ? `Diskon −${rupiah(r.diskon)} · ` : ""}TOTAL FINAL</td>
        <td style="padding:10px 8px;text-align:right;font-weight:700;font-size:18px;color:${MERAH};white-space:nowrap">${rupiah(r.total)}</td>
      </tr></table>
      ${r.catatan ? `<p style="margin-top:16px"><b>Catatan</b><br>${r.catatan}</p>` : ""}
      <p style="margin-top:16px;font-style:italic;color:#555">RAB bersifat estimasi; harga final dapat menyesuaikan scope project.</p>`,
  );
}

// Print Invoice plek screenshot 181411 (redesign 08, #61): kop (logo + nomor),
// judul merah, DARI vs KEPADA, tabel baris, TOTAL merah, lalu seksi
// Pembayaran (dibayar + sisa bold + riwayat tanggal+label+metode) di antara
// TOTAL dan TRANSFER KE — pengganti Nota (Y2). Bank dari snapshot saat
// terbit (bukan settings live), terms 7 hari. Tanggal Indonesia pendek (Q33).
export function printInvoice(i, settings) {
  if (!i) return;
  const rows = (i.baris ?? [])
    .map(
      (b) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd">${b.nama}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;white-space:nowrap">${b.qty} ${b.satuan ?? ""}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${rupiah(b.qty * b.harga_satuan)}</td></tr>`,
    )
    .join("");
  const pays = (i.bayar ?? [])
    .map(
      (p) =>
        `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee">${tglCetak(p.tanggal)}</td><td style="padding:5px 8px;border-bottom:1px solid #eee">${p.label}</td><td style="padding:5px 8px;border-bottom:1px solid #eee">${p.metode}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right">${rupiah(p.jumlah)}</td></tr>`,
    )
    .join("");
  // Bank dari snapshot terbit (M-snapshot): print lama tak ikut berubah saat
  // settings bank diganti kemudian. Fallback ke settings bila snapshot kosong.
  const bankTeks =
    i.bank_snapshot ||
    [settings.bank, settings.norek, settings.atas_nama]
      .filter(Boolean)
      .join(" ");
  const s = settings;
  cetakDokumen(
    i.nomor,
    `
      ${kopDokumen(settings, i.nomor)}
      <h1>INVOICE</h1>
      <table class="layout" style="margin:8px 0 16px"><tr>
        <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Dari</div><div style="font-weight:700;font-size:15px">${s.nama ?? ""}</div><div style="color:#555">${[s.hp, s.email].filter(Boolean).join("<br>")}</div></td>
        <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Kepada</div><div style="font-weight:700;font-size:15px">${i.transaksi?.nama_client ?? ""}</div></td>
      </tr></table>
      <p style="margin:0 0 12px;color:#555">${i.nomor} · Terbit ${tglCetak(i.tanggal_terbit)} · Jatuh tempo ${tglCetak(i.jatuh_tempo)}</p>
      <table class="layout" style="border-top:2px solid #111">
        <tr><th style="text-align:left;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Deskripsi</th><th style="text-align:left;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Qty</th><th style="text-align:right;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Subtotal</th></tr>
        ${rows}
      </table>
      <table class="layout" style="margin-top:8px;border-top:2px solid #111"><tr>
        <td style="padding:10px 8px;text-align:right;font-weight:700">TOTAL</td>
        <td style="padding:10px 8px;text-align:right;font-weight:700;font-size:18px;color:${MERAH};white-space:nowrap">${rupiah(i.total)}</td>
      </tr></table>
      <div style="margin-top:16px;padding:12px;border:1px solid #ddd;background:#fafafa">
        <div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Pembayaran</div>
        <table class="layout"><tr>
          <td style="padding:2px 0">Dibayar</td><td style="padding:2px 0;text-align:right">${rupiah(i.dibayar)}</td>
        </tr><tr>
          <td style="padding:2px 0;font-weight:700">Sisa</td><td style="padding:2px 0;text-align:right;font-weight:700">${rupiah(i.sisa)}</td>
        </tr></table>
        ${pays ? `<table class="layout" style="margin-top:8px"><tr><th style="text-align:left;padding:4px 8px;font-size:11px;color:#777">Tanggal</th><th style="text-align:left;padding:4px 8px;font-size:11px;color:#777">Label</th><th style="text-align:left;padding:4px 8px;font-size:11px;color:#777">Metode</th><th style="text-align:right;padding:4px 8px;font-size:11px;color:#777">Jumlah</th></tr>${pays}</table>` : '<p style="margin:8px 0 0;color:#777">Belum ada pembayaran.</p>'}
      </div>
      <p style="margin-top:16px"><b>TRANSFER KE</b><br>${bankTeks}</p>
      <p style="color:#555">Pembayaran paling lambat 7 hari setelah invoice diterima.</p>`,
  );
}

// Print Brief (redesign 08, #61): kop rapi + hanya field yang terisi (Q32).
export function printBrief(t, brief, settings) {
  const b = brief ?? {};
  const row = (k, v) =>
    v
      ? `<tr><td style="vertical-align:top;padding:6px 8px;width:160px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">${k}</td><td style="vertical-align:top;padding:6px 8px;border-bottom:1px solid #eee">${String(v).replace(/\n/g, "<br>")}</td></tr>`
      : "";
  cetakDokumen(
    `Brief — ${t.nama_project}`,
    `
      ${kopDokumen(settings, "PROJECT BRIEF")}
      <h1>PROJECT BRIEF</h1>
      <p style="margin:0 0 12px;color:#555">${t.nama_project} · ${t.nama_client}</p>
      <table class="layout">
      ${row("Objective", b.objective)}${row("Audience", b.audience)}
      ${row("Style", b.style)}${row("Mood", b.mood)}
      ${row("DO", b.dos)}${row("DON'T", b.donts)}
      ${row("Lokasi", b.lokasi)}${row("Talent", b.talent)}
      ${row("Deliverables", b.deliverables)}${row("Deadline", b.deadline)}
      ${row("Notes", b.notes)}
      </table>`,
  );
}
