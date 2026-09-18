// Cetak dokumen Ember: kop terracotta + tabel A4 + tombol Cetak/Simpan PDF.
// Pure terhadap store: terima record + snapshot settings + total yang sudah
// dihitung pemanggil. Di-render sebagai snippet Svelte di PrintModal, bukan
// window.print dari HTML mentah, agar tombol dan state ikut pola Svelte.

import { rupiah, tgl, subJenis } from "./format.js";

// Jalur logo kop: file statis public/img/logo-red.png (URL img/logo-red.png).
// Sampai file disuplai, kop memakai teks nama studio. Ganti logo = taruh
// file lalu deploy, tanpa ubah kode.
export const LOGO_URL = "img/logo-red.png";
export const EMBER = "#C2410C";

// Header kop merah: slot logo + fallback teks, identitas dari settings.
// Inline style + tabel agar konsisten di jendela cetak polos.
export function kop(settings, subjudul = "") {
  const s = settings ?? {};
  return `<table style="width:100%;border-collapse:collapse;border-bottom:2px solid ${EMBER};padding-bottom:12px;margin-bottom:16px"><tr>
    <td style="vertical-align:middle">
      <img src="${LOGO_URL}" alt="" style="height:48px;display:block" onerror="this.style.display='none'" />
      <div style="font-size:20px;font-weight:700;color:${EMBER};letter-spacing:-0.02em">${s.nama ?? "Nava Creative"}</div>
      ${[s.hp, s.email].filter(Boolean).length ? `<div style="font-size:12px;color:#57534e">${[s.hp, s.email].filter(Boolean).join(" · ")}</div>` : ""}
    </td>
    <td style="vertical-align:middle;text-align:right;font-size:12px;color:#333">
      ${subjudul ? `<div style="font-weight:700;color:${EMBER};text-transform:uppercase;letter-spacing:0.06em">${subjudul}</div>` : ""}
    </td></tr></table>`;
}

export const CETAK_CSS = `body{font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:32px auto;color:#111;font-size:13px}
  h1{color:${EMBER};font-size:22px;margin:18px 0 10px;letter-spacing:0}
  table.layout{width:100%;border-collapse:collapse}
  .ember{color:${EMBER}}`;

// Cetak lewat <iframe> tersembunyi same-origin: tanpa popup, tanpa redirect,
// tidak bisa diblokir popup blocker. Dokumen + print() ditulis sekaligus.
export function cetak(judul, body) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.append(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(
    `<html lang="id"><head><meta charset="utf-8"><title>${judul}</title><style>${CETAK_CSS}</style></head><body onload="print()">${body}</body></html>`,
  );
  doc.close();
  setTimeout(() => frame.remove(), 1000);
}

// --- Lembar RAB: kop + meta klien + tabel baris + subtotal jenis + total ---
export function lembarRab(r, settings) {
  const rows = (r.baris ?? [])
    .map(
      (b) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd">${b.nama}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;white-space:nowrap">${b.qty} ${b.satuan ?? ""}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${rupiah(b.qty * b.harga_satuan)}</td></tr>`,
    )
    .join("");
  const sj = subJenis(r.baris);
  return `
    ${kop(settings, "Rencana Anggaran Biaya")}
    <p style="margin:0 0 12px;color:#555">${r.nomor} · ${tgl(r.tanggal_rab)}</p>
    <table class="layout" style="margin:8px 0 16px"><tr>
      <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Project</div><div style="font-weight:700;font-size:15px">${r.nama_project}</div></td>
      <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Untuk</div><div style="font-weight:700;font-size:15px">${r.nama_client}${r.perusahaan_client ? " — " + r.perusahaan_client : ""}</div></td>
    </tr></table>
    <table class="layout" style="border-top:2px solid #111">
      <tr><th style="text-align:left;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Item</th><th style="text-align:left;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Qty</th><th style="text-align:right;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Subtotal</th></tr>
      ${rows}
    </table>
    <table class="layout" style="margin-top:8px"><tr>
      <td style="padding:6px 8px;color:#555">Alat ${rupiah(sj.Alat)} · Jasa ${rupiah(sj.Jasa)} · Biaya ${rupiah(sj.Biaya)}${r.diskon ? ` · Diskon −${rupiah(r.diskon)}` : ""}</td>
      <td style="padding:6px 8px;text-align:right;font-weight:700;font-size:18px;color:${EMBER};white-space:nowrap">TOTAL ${rupiah(r.total)}</td>
    </tr></table>
    ${r.catatan ? `<p style="margin-top:16px"><b>Catatan</b><br>${r.catatan}</p>` : ""}
    <p style="margin-top:16px;font-style:italic;color:#555">RAB bersifat estimasi; harga final dapat menyesuaikan scope project.</p>`;
}

// --- Lembar Invoice: kop + nomor + DARI/KEPADA + baris + bayar/sisa + bank ---
export function lembarInvoice(i, settings) {
  const rows = (i.baris ?? [])
    .map(
      (b) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd">${b.nama}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;white-space:nowrap">${b.qty} ${b.satuan ?? ""}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${rupiah(b.qty * b.harga_satuan)}</td></tr>`,
    )
    .join("");
  const pays = (i.bayar ?? [])
    .map(
      (p) =>
        `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee">${tgl(p.tanggal)}</td><td style="padding:5px 8px;border-bottom:1px solid #eee">${p.label}</td><td style="padding:5px 8px;border-bottom:1px solid #eee">${p.metode}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right">${rupiah(p.jumlah)}</td></tr>`,
    )
    .join("");
  // Bank dari snapshot terbit: cetakan lama tak ikut berubah saat settings
  // bank diganti kemudian. Fallback ke settings bila snapshot kosong.
  const bankTeks =
    i.bank_snapshot ||
    [settings.bank, settings.norek, settings.atas_nama]
      .filter(Boolean)
      .join(" ");
  const s = settings ?? {};
  return `
    ${kop(settings, i.nomor)}
    <table class="layout" style="margin:8px 0 16px"><tr>
      <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Dari</div><div style="font-weight:700;font-size:15px">${s.nama ?? ""}</div><div style="color:#555">${[s.hp, s.email].filter(Boolean).join("<br>")}</div></td>
      <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Kepada</div><div style="font-weight:700;font-size:15px">${i.transaksi?.nama_client ?? ""}</div></td>
    </tr></table>
    <p style="margin:0 0 12px;color:#555">${i.nomor} · Terbit ${tgl(i.tanggal_terbit)} · Jatuh tempo ${tgl(i.jatuh_tempo)}</p>
    <table class="layout" style="border-top:2px solid #111">
      <tr><th style="text-align:left;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Deskripsi</th><th style="text-align:left;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Qty</th><th style="text-align:right;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Subtotal</th></tr>
      ${rows}
    </table>
    <table class="layout" style="margin-top:8px;border-top:2px solid #111"><tr>
      <td style="padding:10px 8px;text-align:right;font-weight:700">TOTAL</td>
      <td style="padding:10px 8px;text-align:right;font-weight:700;font-size:18px;color:${EMBER};white-space:nowrap">${rupiah(i.total)}</td>
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
    <p style="color:#555">Pembayaran paling lambat 7 hari setelah invoice diterima.</p>`;
}

// --- Lembar Brief: kop + hanya field terisi ---
export function lembarBrief(t, brief, settings) {
  const b = brief ?? {};
  const row = (k, v) =>
    v
      ? `<tr><td style="vertical-align:top;padding:6px 8px;width:160px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">${k}</td><td style="vertical-align:top;padding:6px 8px;border-bottom:1px solid #eee">${String(v).replace(/\n/g, "<br>")}</td></tr>`
      : "";
  return `
    ${kop(settings, "Project Brief")}
    <p style="margin:0 0 12px;color:#555">${t.nama_project} · ${t.nama_client}</p>
    <table class="layout">
    ${row("Objective", b.objective)}${row("Audience", b.audience)}
    ${row("Style", b.style)}${row("Mood", b.mood)}
    ${row("DO", b.dos)}${row("DON'T", b.donts)}
    ${row("Lokasi", b.lokasi)}${row("Talent", b.talent)}
    ${row("Deliverables", b.deliverables)}${row("Deadline", b.deadline)}
    ${row("Notes", b.notes)}
    </table>`;
}
