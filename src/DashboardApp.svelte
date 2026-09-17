<script>
  // DashboardApp: shell #54, tabel Transaksi #55 / RAB #56 / Invoice #57,
  // Ringkasan #58, Alat cards + servis lapis-dua + arsip toggle #59.
  import { onMount } from 'svelte';
  // Nav icons (ADR-0013, ticket 02): per-icon imports from @lucide/svelte so the
  // bundle only carries the seven glyphs the sidebar uses. Each glyph names its
  // view's artifact (overview / money transfer / budget doc / bill / package /
  // tool / settings) rather than being a decorative set (antislop R-04).
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
  import FileText from '@lucide/svelte/icons/file-text';
  import Receipt from '@lucide/svelte/icons/receipt';
  import Package from '@lucide/svelte/icons/package';
  import Wrench from '@lucide/svelte/icons/wrench';
  import Settings from '@lucide/svelte/icons/settings';
  import LogOut from '@lucide/svelte/icons/log-out';
  import Menu from '@lucide/svelte/icons/menu';
  import User from '@lucide/svelte/icons/user';
  import X from '@lucide/svelte/icons/x';

  let me = $state(null);
  let alat = $state([]);
  let paket = $state([]);
  let error = $state('');
  let notice = $state('');
  let busy = $state(false);

  // Add-alat form (no manual modal field anywhere — G2).
  let nama = $state('');
  let hargaBeli = $state('');
  let tarifEvent = $state('');

  // Per-alat expandable detail: servis history + add-servis form.
  let openId = $state(null);
  let servisRows = $state([]);
  let svTanggal = $state('');
  let svKeterangan = $state('');
  let svBiaya = $state('');

  // --- Redesign 06 (#59): Alat cards — tambah di balik +, servis lapis-dua,
  // arsip confirm beda-bobot, arsip toggle default-sembunyi. Tanpa tabel:
  // list sedikit + deskriptif (Q27). Modal tetap turunan (G2), pendapatan
  // cuma baris jenis=alat (Q13), tanpa hapus fisik (B4).
  let alatBuilderOpen = $state(false);
  let servisFormId = $state(null); // form catat = lapis-dua di dalam expand
  let showArsip = $state(false); // arsip default-sembunyi (Q27)

  // Arsip paling bawah (Q27): yang masih dipakai tak tenggelam di bawah arsip.
  const alatAktif = $derived(alat.filter((a) => a.is_active));
  const alatArsip = $derived(alat.filter((a) => !a.is_active));

  // Sisa event menuju balik modal pada tarif sekarang — teks badge + tier.
  const eventKurang = (a) =>
    a.tarif_event > 0 ? Math.max(0, Math.ceil((a.modal - a.pendapatan) / a.tarif_event)) : null;

  // Badge Balik modal 3-warna (Q11/Q16): hijau balik modal; kuning tinggal
  // ≤3 event (hampir); merah selebihnya / belum ada pendapatan. Teks selalu
  // menyertai warna (jumlah event pasti saat tarif > 0).
  const balikModalBadge = (a) => {
    if (a.balik_modal) return { cls: 'bg-forest-teal text-bone-white', text: 'Balik modal' };
    const kurang = eventKurang(a);
    if (kurang !== null && kurang <= 3) return { cls: 'bg-signal-yellow text-ink-black', text: `Kurang ${kurang} event` };
    return {
      cls: 'bg-magenta-bloom text-bone-white',
      text: kurang !== null ? `Belum balik modal · kurang ${kurang} event` : 'Belum balik modal',
    };
  };

  // Tombol + membuka form tambah pendek; tutup = buang isian.
  function bukaAlatBuilder() {
    alatBuilderOpen = !alatBuilderOpen;
    if (!alatBuilderOpen) {
      nama = '';
      hargaBeli = '';
      tarifEvent = '';
    }
  }

  // Per-paket expandable rows (#42: read-only rows + subtotals).
  let openPaketId = $state(null);

  // --- Redesign 07 (#60): Paket CRUD UI — tambah di balik +, ubah = form
  // terisi baris lama (PATCH wholesale), expand grup kategori + subtotal,
  // Buat RAB tetap. Tanpa DELETE (spirit B4): arsipkan bila perlu.
  let paketBuilderOpen = $state(false);
  let editPaketId = $state(null); // id paket yang sedang diubah (lapis-dua)

  // Form tambah (builder) — field header + baris sementara.
  let pkNama = $state('');
  let pkDeskripsi = $state('');
  let pkBaris = $state([]);
  // Form ubah — baris paket lama disalin ke sini, lalu PATCH wholesale.
  let pkEditNama = $state('');
  let pkEditDeskripsi = $state('');
  let pkEditBaris = $state([]);
  // Input baris baru (dipakai tambah + ubah; disalin ke array saat + Baris).
  let pbNama = $state('');
  let pbQty = $state('1');
  let pbSatuan = $state('');
  let pbHarga = $state('');
  let pbJenis = $state('alat');
  let pbKategori = $state('PRODUCTION');

  const resetPkInput = () => {
    pbNama = '';
    pbQty = '1';
    pbSatuan = '';
    pbHarga = '';
    pbJenis = 'alat';
    pbKategori = 'PRODUCTION';
  };

  // Tombol + membuka form tambah; tutup = buang isian (pola Alat/RAB, Q23).
  function bukaPaketBuilder() {
    paketBuilderOpen = !paketBuilderOpen;
    editPaketId = null; // tutup form ubah biar satu kerjaan satu waktu
    if (!paketBuilderOpen) {
      pkNama = '';
      pkDeskripsi = '';
      pkBaris = [];
      resetPkInput();
    }
  }

  // Ubah (lapis-dua di dalam kartu): salin baris lama — PATCH mengganti
  // wholesale, jadi form harus mulai dari snapshot baris yang ada.
  function bukaEditPaket(p) {
    if (editPaketId === p.id) {
      editPaketId = null;
      return;
    }
    editPaketId = p.id;
    paketBuilderOpen = false; // tutup form tambah
    pkEditNama = p.nama;
    pkEditDeskripsi = p.deskripsi ?? '';
    pkEditBaris = p.baris.map((b) => ({
      kategori: b.kategori,
      jenis: b.jenis,
      alat_id: b.alat_id ?? null,
      nama: b.nama,
      qty: b.qty,
      satuan: b.satuan,
      harga_satuan: b.harga_satuan,
    }));
    resetPkInput();
  }

  // + Baris: validasi ringan sisi-UI (kontrak penuh tetap di API, Q12).
  function pkTambahBaris(daftar, setDaftar) {
    const namaBaris = pbNama.trim();
    if (!namaBaris) return;
    setDaftar([
      ...daftar,
      {
        kategori: pbKategori || 'PRODUCTION',
        jenis: pbJenis,
        alat_id: null,
        nama: namaBaris,
        qty: Number(pbQty) || 1,
        satuan: pbSatuan,
        harga_satuan: Number(pbHarga) || 0,
      },
    ]);
    resetPkInput();
  }

  // ponytail: alias — didefinisikan ulang di bawah setelah subtotal ada
  // (const tidak bisa dipakai sebelum deklarasi / TDZ).
  const pkSum = (rows) => subtotal(rows);

  async function simpanPaket(e) {
    e.preventDefault();
    error = '';
    notice = '';
    busy = true;
    try {
      const { res, data } = await api('/api/paket', {
        method: 'POST',
        body: JSON.stringify({ nama: pkNama, deskripsi: pkDeskripsi, baris: pkBaris }),
      });
      if (!res.ok) {
        error = data.error ?? 'Gagal menyimpan paket.';
        return;
      }
      notice = `${data.nama ?? pkNama} ditambahkan.`;
      pkNama = '';
      pkDeskripsi = '';
      pkBaris = [];
      resetPkInput();
      paketBuilderOpen = false;
      await load();
    } finally {
      busy = false;
    }
  }

  // PATCH wholesale: baris paket diganti sekaligus. Dokumen lama tak ikut
  // berubah (snapshot milik sendiri) — notice mengingatkan itu.
  async function simpanEditPaket(p, e) {
    e.preventDefault();
    error = '';
    notice = '';
    busy = true;
    try {
      const { res, data } = await api(`/api/paket/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nama: pkEditNama, deskripsi: pkEditDeskripsi, baris: pkEditBaris }),
      });
      if (!res.ok) {
        error = data.error ?? 'Gagal mengubah paket.';
        return;
      }
      notice = `${data.nama ?? p.nama} diubah — RAB/Transaksi lama tidak ikut berubah.`;
      editPaketId = null;
      await load();
    } finally {
      busy = false;
    }
  }

  // Studio identity for document headers (Q23, auto-fill from settings).
  let settings = $state({});

  // RAB (#43): list + builder (header + rows, from paket or blank).
  let rabs = $state([]);
  let transaksi = $state([]);
  let openTransaksiId = $state(null);
  let openRabId = $state(null);
  let rbProject = $state('');
  let rbTanggal = $state(new Date().toISOString().slice(0, 10));
  let rbClient = $state('');
  let rbPerusahaan = $state('');
  let rbDiskon = $state('');
  let rbCatatan = $state('');
  let rbBaris = $state([]);
  let nbNama = $state('');
  let nbQty = $state('1');
  let nbSatuan = $state('');
  let nbHarga = $state('');
  let nbJenis = $state('alat');
  let nbKategori = $state('PRODUCTION');

  const rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
  // ponytail: one subtotal / one grouper / one sorter for all tables.
  const subtotal = (baris) => baris.reduce((t, b) => t + b.qty * b.harga_satuan, 0);
  const grupBaris = (baris) => {
    const by = new Map();
    for (const b of baris ?? []) {
      const g = b.kategori || 'PRODUCTION';
      if (!by.has(g)) by.set(g, []);
      by.get(g).push(b);
    }
    return [...by.entries()].map(([kategori, rows]) => ({ kategori, baris: rows, subtotal: subtotal(rows) }));
  };
  // Siklus sort satu kolom: desc → asc → terbaru (null). get/set agar
  // tx/rab/inv bisa berbagi badan yang sama.
  function urutkan(get, set, key) {
    const [k, desc] = get();
    if (k === key) set(!desc ? null : k, !desc ? true : false);
    else set(key, true);
  }

  // --- Cetak plek dokumen asli (redesign 08, #61) ---
  // Logo merah studio: file statis di public/ (B5). Sampai user menaruh file,
  // kop memakai fallback teks nama studio. Path ini juga disebut di Settings
  // (Q29) supaya mengganti logo = taruh file + deploy, tanpa ubah kode.
  const LOGO_PATH = 'img/logo-red.png';
  const MERAH = '#b3001b'; // merah kop dokumen (di luar palet landing; cetak saja)

  // Tanggal cetak Indonesia pendek (Q33): "17 Agu 2026". iso = 'YYYY-MM-DD'.
  const tglCetak = (iso) =>
    iso
      ? new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

  // Kop merah: slot logo + fallback teks sampai file disuplai, identitas dari
  // settings (Q23). Inline style + tabel agar konsisten di jendela print polos.
  function kopDokumen(subjudul = '') {
    const s = settings;
    const kontak = [s.hp, s.email].filter(Boolean).join(' · ');
    const logo = `<img src="${LOGO_PATH}" alt="${s.nama ?? 'Nava Creative'}" style="height:56px;display:block" onerror="this.style.display='none';document.getElementById('kop-fallback').style.display='block'" />`;
    const fallback = `<div id="kop-fallback" style="display:none;font-size:26px;font-weight:700;color:${MERAH};letter-spacing:-0.02em">${s.nama ?? 'Nava Creative'}</div>`;
    return `<table style="width:100%;border-collapse:collapse;border-bottom:3px solid ${MERAH};padding-bottom:12px"><tr>
      <td style="vertical-align:middle">${logo}${fallback}</td>
      <td style="vertical-align:middle;text-align:right;font-size:12px;color:#333">
        ${subjudul ? `<div style="font-weight:700;color:${MERAH}">${subjudul}</div>` : ''}
        ${kontak ? `<div>${kontak}</div>` : ''}
      </td></tr></table>`;
  }

  // CSS dasar semua dokumen cetak plek (font, margin, warna judul merah).
  const CETAK_CSS = `body{font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:32px auto;color:#111;font-size:13px}
    h1{color:${MERAH};font-size:22px;margin:18px 0 10px;letter-spacing:0}
    table.layout{width:100%;border-collapse:collapse}
    .merah{color:${MERAH}}`;
  // ponytail: satu pintu cetak — 3 print fn hanya menyetor judul + body.
  function cetakDokumen(judul, body) {
    const w = window.open('', '_blank');
    w.document.write(`<html lang="id"><head><meta charset="utf-8"><title>${judul}</title><style>${CETAK_CSS}</style></head><body onload="print()">${body}</body></html>`);
    w.document.close();
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
    });
    if (res.status === 401) {
      // Q36: selamatkan draft builder sebelum pindah ke login.
      const d = txDraft();
      if (d.nama_project || d.nama_client || d.baris?.length) stashDraft('transaksi', d);
      const rd = rbDraft();
      if (draftAda(rd)) stashDraft('rab', rd);
      if (briefOpenId) stashDraft('brief', { transaksi_id: briefOpenId, form: brForm });
      location.href = 'login.html';
      throw new Error('unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function load() {
    const { res, data } = await api('/api/alat');
    if (!res.ok) {
      error = data.error ?? 'Gagal memuat alat.';
      return;
    }
    alat = data.alat;
    const pr = await api('/api/paket');
    if (pr.res.ok) paket = pr.data.paket;
    const rr = await api('/api/rab');
    if (rr.res.ok) rabs = rr.data.rab;
    const tr = await api('/api/transaksi');
    if (tr.res.ok) transaksi = tr.data.transaksi;
    const ir = await api('/api/invoice');
    if (ir.res.ok) invoices = ir.data.invoice;
    // Identity auto-fill source (Q23); print views read from here.
    const sr = await api('/api/settings');
    if (sr.res.ok) settings = sr.data.settings;
  }

  onMount(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.status === 401) {
        location.href = 'login.html';
        return;
      }
      me = (await meRes.json()).username;
      await load();
      // Q36: draft terselamatkan saat 401 dibuka kembali + notice.
      const drafTx = ambilDraft('transaksi');
      if (draftAda(drafTx)) {
        txMuatDraft(drafTx);
        notice = 'Draft walk-in terselamatkan dari sesi sebelumnya.';
      }
      const drafBrief = ambilDraft('brief');
      if (drafBrief) {
        notice = draftAda(drafTx)
          ? 'Draft walk-in + Brief terselamatkan dari sesi sebelumnya — buka Rincian barisnya untuk lanjut Brief.'
          : 'Draft Brief terselamatkan dari sesi sebelumnya — buka Rincian barisnya untuk lanjut.';
      }
      const drafRab = ambilDraft('rab');
      if (draftAda(drafRab)) {
        rbMuatDraft(drafRab);
        // Draft is seeded into state; the Panel opens from “+ RAB baru” (ticket 05).
        notice = 'Draft RAB terselamatkan dari sesi sebelumnya, buka “+ RAB baru” untuk lanjut.';
      }
      await tampilkan(viewDariHash() ?? 'ringkasan');
    } catch {
      error = 'Tidak bisa menghubungi server.';
    }
  });

  async function addAlat(e) {
    e.preventDefault();
    error = '';
    notice = '';
    busy = true;
    try {
      const { res, data } = await api('/api/alat', {
        method: 'POST',
        body: JSON.stringify({
          nama,
          harga_beli: Number(hargaBeli),
          tarif_event: Number(tarifEvent),
        }),
      });
      if (!res.ok) {
        error = data.error ?? 'Gagal menambah alat.';
        return;
      }
      notice = `${data.nama} ditambahkan. Modal awal ${rupiah(data.modal)}.`;
      nama = '';
      hargaBeli = '';
      tarifEvent = '';
      alatBuilderOpen = false;
      await load();
    } finally {
      busy = false;
    }
  }

  // Arsip = satu-satunya aksi Alat yang selalu confirm (Q45), dan confirm-nya
  // beda-bobot dari aksi lain: tiga kalimat berurutan (arsip → riwayat aman →
  // cara mengaktifkan lagi), bukan satu kalimat. Tanpa hapus fisik (B4).
  async function arsipkan(a) {
    if (!confirm(`Arsipkan ${a.nama}? Kartu pindah ke daftar arsip (default tersembunyi).\n\nRiwayat servis, modal, dan pendapatan tetap tersimpan — tidak ada yang dihapus.\n\nAktifkan lagi kapan saja lewat toggle “Tampilkan arsip”.`)) return;
    const { res, data } = await api(`/api/alat/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: false }),
    });
    if (!res.ok) error = data.error ?? 'Gagal mengarsipkan.';
    else {
      notice = `${a.nama} diarsipkan — aktifkan lagi lewat toggle “Tampilkan arsip”.`;
      await load();
    }
  }

  async function aktifkan(a) {
    const { res, data } = await api(`/api/alat/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: true }),
    });
    if (!res.ok) error = data.error ?? 'Gagal mengaktifkan kembali.';
    else {
      notice = `${a.nama} aktif kembali.`;
      await load();
    }
  }

  async function toggle(a) {
    if (openId === a.id) {
      openId = null;
      servisFormId = null;
      return;
    }
    openId = a.id;
    servisFormId = null;
    svTanggal = '';
    svKeterangan = '';
    svBiaya = '';
    const { res, data } = await api(`/api/alat/${a.id}/servis`);
    servisRows = res.ok ? data.servis : [];
  }

  // Form catat = lapis-dua di dalam expand (Q18): riwayat dulu, form di balik
  // tombol. Buka = isi tanggal hari ini; tutup = buang isian.
  function bukaServisForm(a) {
    if (servisFormId === a.id) {
      servisFormId = null;
      return;
    }
    servisFormId = a.id;
    svTanggal = new Date().toISOString().slice(0, 10);
    svKeterangan = '';
    svBiaya = '';
  }

  async function addServis(a, e) {
    e.preventDefault();
    error = '';
    const { res, data } = await api(`/api/alat/${a.id}/servis`, {
      method: 'POST',
      body: JSON.stringify({
        tanggal: svTanggal,
        keterangan: svKeterangan,
        biaya: Number(svBiaya),
      }),
    });
    if (!res.ok) {
      error = data.error ?? 'Gagal mencatat servis.';
      return;
    }
    notice = `Servis ${rupiah(data.biaya)} tercatat. Modal ${a.nama} bertambah.`;
    await load();
    servisRows = [...servisRows, data];
    servisFormId = null;
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.href = 'login.html';
  }

  // --- RAB builder (#56): now opens in the shared Panel (ticket 05) ---
  // Behaviour unchanged; the Panel owns closing (Esc / outside click / button).
  // `rabBuilderOpen` was the inline-open flag and is gone.

  function resetBuilder() {
    rbProject = '';
    rbTanggal = new Date().toISOString().slice(0, 10);
    rbClient = '';
    rbPerusahaan = '';
    rbDiskon = '';
    rbCatatan = '';
    rbBaris = [];
  }

  const rbDraft = () => ({
    nama_project: rbProject, nama_client: rbClient, perusahaan_client: rbPerusahaan,
    tanggal_rab: rbTanggal, diskon: rbDiskon, catatan: rbCatatan, baris: rbBaris,
  });
  const rbMuatDraft = (d) => {
    rbProject = d.nama_project ?? '';
    rbClient = d.nama_client ?? '';
    rbPerusahaan = d.perusahaan_client ?? '';
    rbTanggal = d.tanggal_rab ?? new Date().toISOString().slice(0, 10);
    rbDiskon = d.diskon ?? '';
    rbCatatan = d.catatan ?? '';
    rbBaris = d.baris ?? [];
  };

  // Builder opens in the Panel; a stashed draft is re-seeded first + notice (Q23).
  function bukaRabBuilder() {
    if (draftAda(ambilDraft('rab'))) {
      rbMuatDraft(ambilDraft('rab'));
      notice = 'Draft RAB sebelumnya dibuka kembali.';
    }
    bukaPanel('RAB baru', rabBuilderSnippet);
  }

  // Buat RAB dari Paket (Q19/Q21): salin baris → auto-pindah #/rab + notice.
  // Builder kosong langsung salin; builder isi confirm-timpa dulu.
  async function dariPaket(p) {
    error = '';
    if (draftAda(rbDraft()) && !confirm('Timpa draft RAB yang sedang diisi dengan baris dari paket ini?')) return;
    const { res, data } = await api(`/api/paket/${p.id}/ke-rab`);
    if (!res.ok) {
      error = data.error ?? 'Gagal menyalin paket.';
      return;
    }
    rbProject = data.nama_project;
    rbBaris = data.baris.map((b) => ({ ...b }));
    hapusDraft('rab');
    notice = `Baris ${p.nama} disalin, lengkapi client lalu simpan.`;
    // Open the Panel AFTER the view switch: go('rab') fires hashchange ->
    // tampilkan() -> tutupPanel(), so a direct bukaPanel() here would be closed
    // again immediately. pendingPanel is consumed by tampilkan() once on #/rab;
    // when already on #/rab (re-copy), the hash does not change, so open directly.
    if (view === 'rab') bukaRabBuilder();
    else {
      pendingPanel = { view: 'rab', judul: 'RAB baru', isi: rabBuilderSnippet };
      go('rab');
    }
  }

  function tambahBaris(e) {
    e.preventDefault();
    rbBaris = [
      ...rbBaris,
      {
        kategori: nbKategori || 'PRODUCTION',
        jenis: nbJenis,
        alat_id: null,
        nama: nbNama.trim(),
        qty: Number(nbQty) || 1,
        satuan: nbSatuan,
        harga_satuan: Number(nbHarga) || 0,
      },
    ];
    nbNama = '';
    nbQty = '1';
    nbSatuan = '';
    nbHarga = '';
  }

  function hapusBaris(i) {
    rbBaris = rbBaris.filter((_, j) => j !== i);
  }

  const rbSum = () => subtotal(rbBaris);

  async function simpanRab(e) {
    e.preventDefault();
    error = '';
    notice = '';
    busy = true;
    try {
      const { res, data } = await api('/api/rab', {
        method: 'POST',
        body: JSON.stringify({
          nama_project: rbProject,
          tanggal_rab: rbTanggal,
          nama_client: rbClient,
          perusahaan_client: rbPerusahaan,
          diskon: Number(rbDiskon) || 0,
          catatan: rbCatatan,
          baris: rbBaris,
        }),
      });
      if (!res.ok) {
        error = data.error ?? 'Gagal menyimpan RAB.';
        return;
      }
      notice = `${data.nomor} tersimpan sebagai draft.`;
      resetBuilder();
      hapusDraft('rab');
      tutupPanel();
      await load();
    } finally {
      busy = false;
    }
  }

  async function statusRab(r, status) {
    const { res, data } = await api(`/api/rab/${r.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) error = data.error ?? 'Gagal ubah status.';
    else {
      notice = `${r.nomor} → ${status}.`;
      await load();
    }
  }

  // Setujui tanpa confirm (Q45): 1 klik → Transaksi, auto-pindah #/transaksi
  // + notice. Void + koreksi-minus di Transaksi tetap jadi pengaman.
  async function setujui(r) {
    const { res, data } = await api(`/api/rab/${r.id}/setujui`, { method: 'POST' });
    if (!res.ok) error = data.error ?? 'Gagal menyetujui.';
    else {
      notice = `${r.nomor} disetujui → Transaksi #${data.transaksi_id}.`;
      await load();
      go('transaksi');
    }
  }

  // Print RAB plek dokumen asli (redesign 08, #61): kop merah (slot logo +
  // fallback teks), judul merah + nomor sistem, PROJECT vs UNTUK, grup
  // kategori + subtotal merah, TOTAL FINAL merah, catatan, disclaimer estimasi.
  function printRab(r) {
    const grup = rabGrup(r);
    const grupHtml = grup
      .map((g) => {
        const baris = g.baris
          .map(
            (b) =>
              `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd">${b.nama}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;white-space:nowrap">${b.qty} ${b.satuan ?? ''}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${rupiah(b.qty * b.harga_satuan)}</td></tr>`,
          )
          .join('');
        return `<tr><td colspan="3" style="padding:10px 8px 4px;font-weight:700;color:${MERAH};text-transform:uppercase;letter-spacing:0.04em">${g.kategori}</td></tr>
          ${baris}
          <tr><td colspan="2" style="padding:6px 8px;text-align:right;font-weight:700;color:${MERAH}">Subtotal ${g.kategori}</td><td style="padding:6px 8px;text-align:right;font-weight:700;color:${MERAH}">${rupiah(g.subtotal)}</td></tr>`;
      })
      .join('');
    cetakDokumen(r.nomor, `
      ${kopDokumen('RANCANGAN ANGGARAN BIAYA')}
      <h1>RANCANGAN ANGGARAN BIAYA</h1>
      <table class="layout" style="margin:8px 0 16px"><tr>
        <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Project</div><div style="font-weight:700;font-size:15px">${r.nama_project}</div></td>
        <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Untuk</div><div style="font-weight:700;font-size:15px">${r.nama_client}${r.perusahaan_client ? ' — ' + r.perusahaan_client : ''}</div></td>
      </tr></table>
      <p style="margin:0 0 12px;color:#555">${r.nomor} · ${tglCetak(r.tanggal_rab)}</p>
      <table class="layout" style="border-top:2px solid #111">
        <tr><th style="text-align:left;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Item</th><th style="text-align:left;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Qty</th><th style="text-align:right;padding:8px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Subtotal</th></tr>
        ${grupHtml}
      </table>
      <table class="layout" style="margin-top:8px;border-top:2px solid #111"><tr>
        <td style="padding:10px 8px;text-align:right;font-weight:700">${r.diskon ? `Diskon −${rupiah(r.diskon)} · ` : ''}TOTAL FINAL</td>
        <td style="padding:10px 8px;text-align:right;font-weight:700;font-size:18px;color:${MERAH};white-space:nowrap">${rupiah(r.total)}</td>
      </tr></table>
      ${r.catatan ? `<p style="margin-top:16px"><b>Catatan</b><br>${r.catatan}</p>` : ''}
      <p style="margin-top:16px;font-style:italic;color:#555">RAB bersifat estimasi; harga final dapat menyesuaikan scope project.</p>`);
  }

  // --- Transaksi walk-in + lifecycle + Brief (#44) ---
  let txProject = $state('');
  let txClient = $state('');
  let txMulai = $state('');
  let txSelesai = $state('');
  let txLokasi = $state('');
  let txBaris = $state([]);
  let txNama = $state('');
  let txQty = $state('1');
  let txSatuan = $state('');
  let txHarga = $state('');
  let txJenis = $state('jasa');
  let brief = $state(null);
  let brForm = $state({});

  // --- Redesign 02 (#55): tabel + walk-in di balik + + Brief lapis-dua ---
  // Ticket 04: walk-in and Brief both open in the shared Panel, so no inline-open
  // flag remains; `briefOpenId` still tracks the open Brief for the 401 stash.
  let briefOpenId = $state(null);
  let briefTx = $state(null); // transaksi whose brief is open in the Panel
  // Table state (Q12/Q24): search + status filter + one sortable column.
  // Filter tetap state sesi (Q35) — session vars, never in the URL.
  let txSearch = $state('');
  let txStatusFilter = $state('semua');
  let txSortKey = $state(null); // null = id desc (default terbaru)
  let txSortDesc = $state(true);

  const TX_STATUSES = ['terjadwal', 'berjalan', 'selesai', 'batal'];
  const KATEGORI = ['PRODUCTION', 'LOGISTIK', 'MISC'];

  // Sort: satu kolom client-side (Q24) — Total; klik cycle desc→asc→terbaru.
  const txFiltered = $derived(
    (() => {
      const q = txSearch.trim().toLowerCase();
      let rows = transaksi.filter((t) => {
        const okStatus = txStatusFilter === 'semua' || t.status === txStatusFilter;
        const hay = [t.nama_project, t.nama_client, t.lokasi, t.perusahaan_client].filter(Boolean).join(' ').toLowerCase();
        return okStatus && (!q || hay.includes(q));
      });
      if (txSortKey) {
        const dir = txSortDesc ? -1 : 1;
        rows = [...rows].sort((a, b) => (a[txSortKey] - b[txSortKey]) * dir);
      }
      return rows;
    })(),
  );

  // Baris dikelompokkan per kategori + subtotal, plek dokumen (Q32).
  const txGrup = (t) => grupBaris(t.baris);
  function txUrutkan(key) {
    urutkan(() => [txSortKey, txSortDesc], (k, d) => { txSortKey = k; txSortDesc = d; }, key);
  }

  // 401 mid-draft (Q36): stash ke localStorage sebelum redirect ke login,
  // restore + notice setelah login. Key per builder.
  function stashDraft(key, value) {
    try {
      localStorage.setItem('nava-draft-' + key, JSON.stringify(value));
    } catch {}
  }
  function ambilDraft(key) {
    try {
      const raw = localStorage.getItem('nava-draft-' + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function hapusDraft(key) {
    try {
      localStorage.removeItem('nava-draft-' + key);
    } catch {}
  }
  const txDraft = () => ({
    nama_project: txProject, nama_client: txClient,
    tanggal_mulai: txMulai, tanggal_selesai: txSelesai, lokasi: txLokasi, baris: txBaris,
  });
  const txMuatDraft = (d) => {
    txProject = d.nama_project ?? '';
    txClient = d.nama_client ?? '';
    txMulai = d.tanggal_mulai ?? '';
    txSelesai = d.tanggal_selesai ?? '';
    txLokasi = d.lokasi ?? '';
    txBaris = d.baris ?? [];
  };
  const draftAda = (d) => !!(d && (d.nama_project || d.nama_client || d.baris?.length));

  // Walk-in (ticket 04): the builder now opens in the shared Panel instead of
  // pushing the table down (ADR-0012 amendment), mirroring the Brief. The draft
  // restore path is unchanged; opening only re-seeds the fields from localStorage
  // when a stashed draft exists. Panel owns closing (Esc / outside click / button).
  function bukaWalkin() {
    if (draftAda(ambilDraft('transaksi'))) {
      txMuatDraft(ambilDraft('transaksi'));
      notice = 'Draft walk-in sebelumnya dibuka kembali.';
    }
    bukaPanel('Walk-in baru', walkinFormSnippet);
  }

  function txTambahBaris(e) {
    e.preventDefault();
    txBaris = [...txBaris, { kategori: 'PRODUCTION', jenis: txJenis, alat_id: null, nama: txNama.trim(), qty: Number(txQty) || 1, satuan: txSatuan, harga_satuan: Number(txHarga) || 0 }];
    txNama = '';
    txQty = '1';
    txSatuan = '';
    txHarga = '';
  }

  // Brief (Q18, ticket 02): now opens in the shared Panel instead of pushing the
  // Transaksi table around (ADR-0012 amendment). briefOpenId still tracks which
  // transaksi's brief is showing, so the 401 draft-restore path is unchanged.
  function bukaBrief(t) {
    briefOpenId = t.id;
    briefTx = t;
    const draf = ambilDraft('brief');
    if (draf && draf.transaksi_id === t.id) {
      brForm = draf.form;
      notice = 'Draft Brief sebelumnya dibuka kembali.';
    }
    bukaPanel(`Brief — ${t.nama_project}`, briefFormSnippet);
  }

  async function simpanTransaksi(e) {
    e.preventDefault();
    error = '';
    notice = '';
    busy = true;
    try {
      const { res, data } = await api('/api/transaksi', {
        method: 'POST',
        body: JSON.stringify({
          nama_project: txProject, nama_client: txClient,
          tanggal_mulai: txMulai || undefined, tanggal_selesai: txSelesai || undefined,
          lokasi: txLokasi, baris: txBaris,
        }),
      });
      if (!res.ok) {
        error = data.error ?? 'Gagal menyimpan transaksi.';
        return;
      }
      notice = data.bentrok?.length
        ? `Tersimpan — bentrok dengan ${data.bentrok.map((b) => b.nama_project).join(', ')}.`
        : 'Transaksi walk-in tersimpan.';
      hapusDraft('transaksi');
      txMuatDraft({});
      tutupPanel();
      await load();
    } finally {
      busy = false;
    }
  }

  async function statusTransaksi(t, status) {
    const { res, data } = await api(`/api/transaksi/${t.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (!res.ok) error = data.error ?? 'Gagal ubah status.';
    else {
      notice = data.bentrok?.length ? `Bentrok: ${data.bentrok.map((b) => b.nama_project).join(', ')}.` : `${t.nama_project} → ${status}.`;
      await load();
    }
  }

  // --- Redesign 03 (#56): tabel RAB — search + status + sort + expand ---
  // Pola tabel meniru Transaksi (#55). Filter tetap state sesi (Q35).
  let rabSearch = $state('');
  let rabStatusFilter = $state('semua');
  let rabSortKey = $state(null); // null = id desc (default terbaru)
  let rabSortDesc = $state(true);

  const RAB_STATUSES = ['draft', 'sent', 'approved', 'rejected'];

  // Search: nomor + project + client + perusahaan (Q24). Sort: satu kolom
  // client-side (Total), klik cycle desc→asc→terbaru.
  const rabFiltered = $derived(
    (() => {
      const q = rabSearch.trim().toLowerCase();
      let rows = rabs.filter((r) => {
        const okStatus = rabStatusFilter === 'semua' || r.status === rabStatusFilter;
        const hay = [r.nomor, r.nama_project, r.nama_client, r.perusahaan_client].filter(Boolean).join(' ').toLowerCase();
        return okStatus && (!q || hay.includes(q));
      });
      if (rabSortKey) {
        const dir = rabSortDesc ? -1 : 1;
        rows = [...rows].sort((a, b) => (a[rabSortKey] - b[rabSortKey]) * dir);
      }
      return rows;
    })(),
  );

  function rabUrutkan(key) {
    urutkan(() => [rabSortKey, rabSortDesc], (k, d) => { rabSortKey = k; rabSortDesc = d; }, key);
  }

  // Expand grup kategori + subtotal, plek dokumen (Q32).
  const rabGrup = (r) => grupBaris(r.baris);

  // Expand Paket (#60): grup kategori + subtotal, plek dokumen (Q15).
  const paketGrup = (p) => grupBaris(p.baris);

  // --- Invoice (#45): terbit dari transaksi, bayar, void, cetak ---
  let invoices = $state([]);
  let openInvoiceId = $state(null);
  let invDetail = $state(null);
  let byTanggal = $state(new Date().toISOString().slice(0, 10));
  let byJumlah = $state('');
  let byMetode = $state('transfer');

  // --- Redesign 04 (#57): tabel Invoice — search + status(+overdue) + sort
  // + expand riwayat + form bayar lapis-dua + ubah tempo via PATCH. Pola
  // tabel meniru RAB (#56) / Transaksi (#55). Filter state sesi (Q35).
  let invSearch = $state('');
  let invStatusFilter = $state('semua');
  let invSortKey = $state(null); // null = id desc (default terbaru)
  let invSortDesc = $state(true);
  let invTempo = $state('');

  const INV_STATUSES = ['unpaid', 'partial', 'paid', 'batal'];

  // Client join sisi-FE (Q24): invoice tak bawa nama_client → tarik dari
  // transaksi induknya. Search: nomor + client. Overdue = opsi status ekstra.
  const invClient = (i) => transaksi.find((t) => t.id === i.transaksi_id)?.nama_client ?? '';
  const invFiltered = $derived(
    (() => {
      const q = invSearch.trim().toLowerCase();
      let rows = invoices.filter((i) => {
        const okStatus =
          invStatusFilter === 'semua' ||
          (invStatusFilter === 'overdue' ? i.overdue : i.status === invStatusFilter);
        const hay = [i.nomor, invClient(i)].filter(Boolean).join(' ').toLowerCase();
        return okStatus && (!q || hay.includes(q));
      });
      if (invSortKey) {
        const dir = invSortDesc ? -1 : 1;
        rows = [...rows].sort((a, b) => (a[invSortKey] > b[invSortKey] ? 1 : a[invSortKey] < b[invSortKey] ? -1 : 0) * dir);
      }
      return rows;
    })(),
  );

  // Sort satu kolom client-side (Q24) — Total / Tempo; klik cycle desc→asc→terbaru.
  function invUrutkan(key) {
    urutkan(() => [invSortKey, invSortDesc], (k, d) => { invSortKey = k; invSortDesc = d; }, key);
  }

  // Terbitkan = primer sekali-klik (Q45: tanpa confirm — void + koreksi
  // minus tetap pengaman), tempo default H+7, auto-pindah #/invoice + notice.
  // H+7 dihitung tanggal LOKAL, bukan UTC (toISOString bisa geser sehari
  // kalau diterbitkan pagi buta WIB).
  // ponytail: en-CA memberi YYYY-MM-DD lokal tanpa padStart manual.
  const hariIniPlus = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA');
  };
  async function terbitkan(t) {
    const jt = hariIniPlus(7);
    const { res, data } = await api(`/api/transaksi/${t.id}/invoice`, {
      method: 'POST',
      body: JSON.stringify({ jatuh_tempo: jt }),
    });
    if (!res.ok) error = data.error ?? 'Gagal menerbitkan invoice.';
    else {
      notice = `${data.nomor} terbit (tempo ${tgl(data.jatuh_tempo)}). Baris transaksi dikunci.`;
      await load();
      go('invoice');
    }
  }

  async function bukaInvoice(i) {
    // Expand seragam (Q25): single-open; isi ulang draft tempo saat buka.
    openInvoiceId = openInvoiceId === i.id ? null : i.id;
    invDetail = null;
    if (openInvoiceId) {
      invTempo = i.jatuh_tempo;
      const { res, data } = await api(`/api/invoice/${i.id}`);
      if (res.ok) invDetail = data;
    }
  }

  // Bayar cepat primer (Q17): satu klik dari baris → buka expand langsung
  // ke form bayar (lapis-dua), tak perlu Rincian dulu.
  function bayarCepat(i) {
    if (openInvoiceId !== i.id) bukaInvoice(i);
    byJumlah = i.sisa > 0 ? String(i.sisa) : '';
  }

  // Ubah jatuh tempo via PATCH (redesign #57): full invoice balik → sync
  // list + detail. Overdue ikut berubah (turunan dari tempo).
  async function simpanTempo(i, e) {
    e.preventDefault();
    error = '';
    const { res, data } = await api(`/api/invoice/${i.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ jatuh_tempo: invTempo }),
    });
    if (!res.ok) {
      error = data.error ?? 'Gagal mengubah jatuh tempo.';
      return;
    }
    notice = `Tempo ${i.nomor} diubah ke ${tgl(data.jatuh_tempo)}.`;
    invDetail = invDetail ? { ...invDetail, ...data } : invDetail;
    await load();
  }

  async function bayar(i, e) {
    e.preventDefault();
    error = '';
    const { res, data } = await api(`/api/invoice/${i.id}/bayar`, {
      method: 'POST',
      body: JSON.stringify({ tanggal: byTanggal, jumlah: Number(byJumlah), metode: byMetode }),
    });
    if (!res.ok) {
      error = data.error ?? 'Gagal mencatat pembayaran.';
      return;
    }
    notice = `Terbayar ${rupiah(data.dibayar)}, sisa ${rupiah(data.sisa)}.`;
    byJumlah = '';
    invDetail = { ...data, transaksi: invDetail?.transaksi, baris: invDetail?.baris ?? [] };
    await load();
  }

  async function voidInvoice(i) {
    if (!confirm(`Batalkan ${i.nomor}? Riwayat tetap tersimpan.`)) return;
    const { res, data } = await api(`/api/invoice/${i.id}/batal`, { method: 'POST' });
    if (!res.ok) error = data.error ?? 'Gagal membatalkan.';
    else {
      notice = `${i.nomor} dibatalkan.`;
      await load();
    }
  }

  // Print Invoice plek screenshot 181411 (redesign 08, #61): kop (logo + nomor),
  // judul merah, DARI vs KEPADA, tabel baris, TOTAL merah, lalu seksi
  // Pembayaran (dibayar + sisa bold + riwayat tanggal+label+metode) di antara
  // TOTAL dan TRANSFER KE — pengganti Nota (Y2). Bank dari snapshot saat
  // terbit (bukan settings live), terms 7 hari. Tanggal Indonesia pendek (Q33).
  function printInvoice() {
    const i = invDetail;
    if (!i) return;
    const rows = (i.baris ?? [])
      .map(
        (b) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd">${b.nama}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;white-space:nowrap">${b.qty} ${b.satuan ?? ''}</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${rupiah(b.qty * b.harga_satuan)}</td></tr>`,
      )
      .join('');
    const pays = (i.bayar ?? [])
      .map(
        (p) =>
          `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee">${tglCetak(p.tanggal)}</td><td style="padding:5px 8px;border-bottom:1px solid #eee">${p.label}</td><td style="padding:5px 8px;border-bottom:1px solid #eee">${p.metode}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right">${rupiah(p.jumlah)}</td></tr>`,
      )
      .join('');
    // Bank dari snapshot terbit (M-snapshot): print lama tak ikut berubah saat
    // settings bank diganti kemudian. Fallback ke settings bila snapshot kosong.
    const bankTeks = i.bank_snapshot || [settings.bank, settings.norek, settings.atas_nama].filter(Boolean).join(' ');
    const s = settings;
    cetakDokumen(i.nomor, `
      ${kopDokumen(i.nomor)}
      <h1>INVOICE</h1>
      <table class="layout" style="margin:8px 0 16px"><tr>
        <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Dari</div><div style="font-weight:700;font-size:15px">${s.nama ?? ''}</div><div style="color:#555">${[s.hp, s.email].filter(Boolean).join('<br>')}</div></td>
        <td style="vertical-align:top;width:50%"><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">Kepada</div><div style="font-weight:700;font-size:15px">${i.transaksi?.nama_client ?? ''}</div></td>
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
      <p style="color:#555">Pembayaran paling lambat 7 hari setelah invoice diterima.</p>`);
  }

  async function bukaTransaksi(t) {
    // Expand seragam (Q25): single-open per view; lapis-dua Brief ikut ketutup.
    openTransaksiId = openTransaksiId === t.id ? null : t.id;
    briefOpenId = null;
    brief = null;
    if (openTransaksiId) {
      const { res, data } = await api(`/api/transaksi/${t.id}/brief`);
      if (res.ok) {
        brief = data.brief;
        brForm = { ...(data.brief ?? {}) };
      }
    }
  }

  async function simpanBrief(t, e) {
    e.preventDefault();
    const { res, data } = await api(`/api/transaksi/${t.id}/brief`, { method: 'PUT', body: JSON.stringify(brForm) });
    if (!res.ok) error = data.error ?? 'Gagal menyimpan brief.';
    else {
      brief = data.brief;
      notice = `Brief ${t.nama_project} tersimpan.`;
      hapusDraft('brief');
      tutupPanel();
    }
  }

  // Print Brief (redesign 08, #61): kop rapi + hanya field yang terisi (Q32).
  function printBrief(t) {
    const b = brief ?? {};
    const row = (k, v) =>
      v
        ? `<tr><td style="vertical-align:top;padding:6px 8px;width:160px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.06em">${k}</td><td style="vertical-align:top;padding:6px 8px;border-bottom:1px solid #eee">${String(v).replace(/\n/g, '<br>')}</td></tr>`
        : '';
    cetakDokumen(`Brief — ${t.nama_project}`, `
      ${kopDokumen('PROJECT BRIEF')}
      <h1>PROJECT BRIEF</h1>
      <p style="margin:0 0 12px;color:#555">${t.nama_project} · ${t.nama_client}</p>
      <table class="layout">
      ${row('Objective', b.objective)}${row('Audience', b.audience)}
      ${row('Style', b.style)}${row('Mood', b.mood)}
      ${row('DO', b.dos)}${row("DON'T", b.donts)}
      ${row('Lokasi', b.lokasi)}${row('Talent', b.talent)}
      ${row('Deliverables', b.deliverables)}${row('Deadline', b.deadline)}
      ${row('Notes', b.notes)}
      </table>`);
  }

  // --- Shell #54 (ADR-0012): sidebar + drawer + hash nav + banner ---
  let view = $state('ringkasan');
  let ringkasan = $state(null);
  let setForm = $state({});
  // Nav map: view key → label + icon component. The icon choice is written down
  // per view (antislop R-04): dashboard = overview, arrow-left-right = money
  // in/out, file-text = budget document (RAB), receipt = bill (Invoice),
  // package = bundled paket, wrench = equipment (Alat), settings = Settings.
  const NAV = [
    ['OPERASIONAL', [
      ['ringkasan', 'Ringkasan', LayoutDashboard],
      ['transaksi', 'Transaksi', ArrowLeftRight],
      ['rab', 'RAB', FileText],
      ['invoice', 'Invoice', Receipt],
      ['paket', 'Paket', Package],
    ]],
    ['MASTER', [['alat', 'Alat', Wrench]]],
  ];
  const VIEW_KEYS = [...NAV.flatMap(([, g]) => g.map(([k]) => k)), 'settings'];

  // Lompat Ringkasan (#58): satu-satunya pengecualian reset-expand (Q25) —
  // target expand/filter dibawa variabel ini, dipasang SETELAH tampilkan()
  // selesai mereset. Sekali pakai: tampilkan() mengonsumsinya.
  // Sengaja BUKAN $state: hanya dibaca imperatif di dalam tampilkan(),
  // tak pernah dari markup/$derived — jangan dipakai reaktif.
  let lompatExpand = null;

  // Cross-view Panel open (ticket 05): `dariPaket` switches to #/rab and wants the
  // RAB builder Panel open there. `tampilkan()` closes the Panel on every view
  // change, so the open has to happen AFTER that reset — this one-shot carries it,
  // consumed by tampilkan() once the view has switched. Imperative, never reactive.
  let pendingPanel = null;

  async function tampilkan(v) {
    if (!VIEW_KEYS.includes(v)) v = 'ringkasan';
    view = v;
    // Panel is bound to a form opened from one view; leaving that view closes it
    // so a stale Panel never floats over an unrelated view (ticket 02).
    tutupPanel();
    // Q25: expand reset saat pindah view (lompat Ringkasan #58 = pengecualian:
    // lompatExpand dipasang ulang tepat sesudah reset di bawah).
    if (v !== 'transaksi') {
      openTransaksiId = null;
      briefOpenId = null;
    }
    if (v !== 'rab') openRabId = null;
    if (v !== 'invoice') openInvoiceId = null;
    // Expand + builder Paket ikut reset (Q25); tak ada lapis-dua tersisa.
    if (v !== 'paket') {
      openPaketId = null;
      paketBuilderOpen = false;
      editPaketId = null;
    }
    // Expand + lapis-dua Alat ikut reset (Q25); toggle arsip sesi tetap.
    if (v !== 'alat') {
      openId = null;
      servisFormId = null;
    }
    if (lompatExpand) {
      const { target, id } = lompatExpand;
      lompatExpand = null;
      if (target === 'invoice' && v === 'invoice') {
        const inv = invoices.find((x) => x.id === id);
        if (inv) bukaInvoice(inv);
      } else if (target === 'transaksi' && v === 'transaksi') {
        const t = transaksi.find((x) => x.id === id);
        if (t) bukaTransaksi(t);
      }
    }
    if (v === 'ringkasan') {
      const { res, data } = await api('/api/ringkasan');
      if (res.ok) ringkasan = data;
    }
    // Cross-view Panel open (ticket 05): consumed after the reset above so the
    // Panel is not closed again by this same tampilkan() call. Clear it whichever
    // view lands, so a redirected/missed switch can never leave a stale one-shot
    // that pops the Panel on a later unrelated #/rab visit.
    if (pendingPanel) {
      const { view: wantView, judul, isi } = pendingPanel;
      pendingPanel = null;
      if (wantView === v) bukaPanel(judul, isi);
    }
    if (v === 'settings') setForm = { ...settings };
  }

  // --- Redesign 05 (#58): 4 kartu + perhatian + recent, semua klik-lompat ---
  // Mapping klik (spec): kas → Invoice; piutang → Invoice prefilter unpaid;
  // alat → Alat; job aktif → Transaksi prefilter terjadwal; item perhatian →
  // Invoice terfilter + expand itemnya; recent → expand barisnya di Transaksi.
  // Perhatian = overdue dulu lalu belum-lunas lain (tanpa clash-math).
  const perhatian = $derived(
    ringkasan
      ? [
          ...ringkasan.overdue.map((o) => ({ ...o, isOverdue: true })),
          ...ringkasan.belum_lunas.filter((b) => !ringkasan.overdue.some((o) => o.id === b.id)),
        ]
      : [],
  );
  const alatBalikModal = $derived(ringkasan ? ringkasan.per_alat.filter((a) => a.balik_modal).length : 0);
  // Label bulan statis (bukan filter tanggal): "Kas masuk September 2026".
  // Dirender dari kas_bulan yang dihitung API — bulan label = bulan angka,
  // tak bisa geser saat tengah malam beda zona worker vs browser.
  const bulanIni = $derived(
    ringkasan?.kas_bulan
      ? new Date(ringkasan.kas_bulan + '-02').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      : '',
  );

  function lompatInvoice(filter = 'semua', expandId = null) {
    invSearch = '';
    invStatusFilter = filter;
    if (view === 'invoice') {
      // Sudah di view target: tak ada hashchange → pasang expand langsung.
      const inv = expandId ? invoices.find((x) => x.id === expandId) : null;
      if (inv) bukaInvoice(inv);
      else openInvoiceId = null;
      return;
    }
    lompatExpand = expandId ? { target: 'invoice', id: expandId } : null;
    go('invoice');
  }

  function lompatTransaksi(filter = 'semua', expandId = null) {
    txSearch = '';
    txStatusFilter = filter;
    if (view === 'transaksi') {
      const t = expandId ? transaksi.find((x) => x.id === expandId) : null;
      if (t) bukaTransaksi(t);
      else {
        openTransaksiId = null;
        briefOpenId = null;
      }
      return;
    }
    lompatExpand = expandId ? { target: 'transaksi', id: expandId } : null;
    go('transaksi');
  }

  function go(v) {
    location.hash = '#/' + v;
  }
  const viewDariHash = () => (location.hash.match(/^#\/([\w-]+)/) ?? [])[1];

  // Badge sidebar (Q29): invoice belum-lunas (merah bila ada overdue,
  // kuning selain itu), transaksi aktif (navy). 0 = badge hilang.
  const invBelumLunas = $derived(invoices.filter((i) => i.status !== 'paid' && i.status !== 'batal'));
  const invOverdue = $derived(invBelumLunas.some((i) => i.overdue));
  const txAktif = $derived(transaksi.filter((t) => t.status === 'terjadwal' || t.status === 'berjalan').length);

  // Drawer (Q36): tutup via pilih menu, back, Esc, klik-luar. Back
  // ditangkap dengan satu pushState saat buka; popstate menutup drawer,
  // dan bila ada view tertunda hash diset SETELAH back selesai supaya
  // tidak ada entri history mati.
  let drawerOpen = $state(false);
  let drawerPushed = false;
  let pendingView = null;

  function bukaDrawer() {
    if (drawerOpen) return;
    drawerOpen = true;
    drawerPushed = true;
    history.pushState({ drawer: 1 }, '');
  }
  function tutupDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;
    if (drawerPushed) {
      drawerPushed = false;
      history.back();
    }
  }
  function pilih(v) {
    if (!drawerOpen) return go(v);
    pendingView = v;
    tutupDrawer();
  }
  window.addEventListener('popstate', () => {
    drawerPushed = false;
    drawerOpen = false;
    if (pendingView) {
      const v = pendingView;
      pendingView = null;
      go(v);
    }
  });
  window.addEventListener('hashchange', () => tampilkan(viewDariHash() ?? 'ringkasan'));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') tutupDrawer();
  });

  // --- Panel (ADR-0012 amendment, ticket 02): shared right-side drawer ---
  // Heavyweight forms open here instead of pushing their table around. Built on
  // the native <dialog> element so Esc-to-close and top-layer stacking come from
  // the platform (no custom focus trap); a click on the backdrop also closes it.
  // 480-560px right drawer on desktop, full-screen sheet under md.
  let panelOpen = $state(false);
  let panelEl = $state(null); // <dialog> ref, used for showModal()/close()
  // Title + body are set by whoever opens the panel; the panel itself owns only
  // the drawer chrome (Esc, backdrop, close button).
  let panelTitle = $state('');
  let panelIsi = $state(null); // a snippet to render inside the sheet

  // $effect keeps the dialog's open state in sync with panelOpen, so any trigger
  // (or Esc, which closes the dialog natively) leaves the flag consistent.
  $effect(() => {
    if (!panelEl) return;
    if (panelOpen && !panelEl.open) panelEl.showModal();
    if (!panelOpen && panelEl.open) panelEl.close();
  });

  function bukaPanel(judul, isi) {
    panelTitle = judul;
    panelIsi = isi;
    panelOpen = true;
  }
  function tutupPanel() {
    panelOpen = false;
    // Brief state is only meaningful while its Panel is open; clearing it here keeps
    // the 401 draft-stash from stashing a Brief the user already dismissed.
    briefOpenId = null;
    briefTx = null;
  }
  // Backdrop click: the dialog's own box is the sheet, so a click whose target
  // is the dialog element itself landed outside the content and should close.
  function panelKlikLuar(e) {
    if (e.target === panelEl) tutupPanel();
  }

  // Banner sticky (Q37): notice auto-hides after 6s, error stays until dismissed.
  $effect(() => {
    if (!notice) return;
    const t = setTimeout(() => (notice = ''), 6000);
    return () => clearTimeout(t);
  });

  // Chip status 3 warna + teks (Q11): hijau selesai, kuning berjalan,
  // merah bahaya. Teks status tetap tampil di sebelah warna.
  // Satu klasifikasi lifecycle dipakai bersama: palette light (landing-era
  // views, ticket 04-06) dan palette rw dark memetakan kind yang SAMA.
  const statusKind = (status, overdue = false) => {
    if (overdue || status === 'batal' || status === 'rejected') return 'danger';
    if (status === 'paid' || status === 'approved' || status === 'selesai') return 'ok';
    return 'neutral';
  };
  const chipCls = (status, overdue = false) => {
    const kind = statusKind(status, overdue);
    if (kind === 'danger') return 'bg-magenta-bloom text-bone-white';
    if (kind === 'ok') return 'bg-forest-teal text-bone-white';
    return 'bg-signal-yellow text-ink-black';
  };
  // Chip status versi Railway (ADR-0013 Q19): teks terang di atas tint 15%,
  // kontras >=7:1 pada permukaan charcoal #33323E tempat badge ini dirender.
  // Nilai status dari data tetap apa adanya.
  const rwChip = (status, overdue = false) => {
    const kind = statusKind(status, overdue);
    if (kind === 'danger') return 'bg-rw-danger/15 text-rw-danger-text';
    if (kind === 'ok') return 'bg-rw-ok/15 text-rw-ok-text';
    return 'bg-rw-off-white/10 text-rw-off-white';
  };

  // Tanggal tampil Indonesia pendek (Q30): 2 Agu 2026. Input tetap date.
  const tgl = (iso) =>
    iso
      ? new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

  async function simpanSettings(e) {
    e.preventDefault();
    error = '';
    const { res, data } = await api('/api/settings', { method: 'PUT', body: JSON.stringify(setForm) });
    if (!res.ok) error = data.error ?? 'Gagal menyimpan settings.';
    else {
      settings = data.settings;
      notice = 'Settings tersimpan. Dokumen berikutnya pakai identitas baru.';
    }
  }
</script>

<!-- Skeleton (ticket 02): pure-CSS loading placeholder, no image, no JS timer.
     The bars are decorative (aria-hidden); a visually-hidden live label keeps the
     loading state announced to assistive tech, which the old "Memuat…" text did.
     The shimmer runs under prefers-reduced-motion: no-preference, so a
     reduced-motion user still gets a static grey block (antislop R-27). -->
{#snippet skeleton(baris = 3)}
  <div role="status" data-skeleton>
    <span class="sr-only">Memuat…</span>
    <div class="grid gap-2" aria-hidden="true">
      {#each Array(baris) as _}
        <div class="skeleton-bar h-4 w-full rounded-rw-badge"></div>
      {/each}
    </div>
  </div>
{/snippet}

<!-- Walk-in form body — rendered inside the Panel by bukaWalkin() (ticket 04).
     Behaviour is unchanged from the previous inline form; only the container
     moved, per ADR-0012's Detail Pattern hybrid: heavy forms live in the Panel,
     light detail stays expand-in-place. -->
{#snippet walkinFormSnippet()}
  <form class="grid gap-4" onsubmit={simpanTransaksi} data-walkin-form>
    <div class="grid gap-4 max-md:grid-cols-1 md:grid-cols-2">
      <label class="grid gap-1 text-body-sm">Nama project<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" required bind:value={txProject} placeholder="Drone Bandar Baru" /></label>
      <label class="grid gap-1 text-body-sm">Nama client<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" required bind:value={txClient} placeholder="Pak Suhaimi" /></label>
      <label class="grid gap-1 text-body-sm">Tanggal mulai<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="date" bind:value={txMulai} /></label>
      <label class="grid gap-1 text-body-sm">Tanggal selesai<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="date" bind:value={txSelesai} /></label>
      <label class="grid gap-1 text-body-sm md:col-span-2">Lokasi<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={txLokasi} placeholder="Bandar Baru" /></label>
    </div>
    {#if txBaris.length}
      <ul class="grid gap-1 text-body-sm">
        {#each txBaris as b, i (i)}
          <li class="flex justify-between gap-2"><span>{b.nama} × {b.qty} <span class="text-rw-light-gray">[{b.jenis}]</span></span><span>{rupiah(b.qty * b.harga_satuan)} <button type="button" class="underline" onclick={() => (txBaris = txBaris.filter((_, j) => j !== i))}>hapus</button></span></li>
        {/each}
      </ul>
    {:else}
      <p class="text-body-sm text-rw-light-gray">Belum ada baris, tambah item di bawah.</p>
    {/if}
    <div class="grid gap-3 max-md:grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end">
      <label class="grid gap-1 text-body-sm">Item<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={txNama} placeholder="Jasa Drone" /></label>
      <label class="grid gap-1 text-body-sm">Jenis<select class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={txJenis}><option value="jasa">jasa</option><option value="alat">alat</option><option value="biaya">biaya</option></select></label>
      <label class="grid gap-1 text-body-sm">Qty<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="number" min="1" bind:value={txQty} /></label>
      <label class="grid gap-1 text-body-sm">Harga (Rp)<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="number" min="0" bind:value={txHarga} /></label>
      <button type="button" class="rounded-rw-control border border-rw-border-gray/40 px-5 py-2.5 text-body-sm max-md:py-3 max-md:w-full" onclick={txTambahBaris}>+ Baris</button>
    </div>
    <button class="rounded-rw-control bg-rw-accent px-6 py-2.5 text-body-sm text-rw-white disabled:opacity-50 md:col-span-2 md:justify-self-start max-md:w-full" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan transaksi'}</button>
  </form>
{/snippet}

<!-- Brief form body — rendered inside the Panel by bukaBrief(). Field set and
     bindings are unchanged from the previous inline form; only the container
     moved (antislop: a form's behaviour is not restyled by relocating it). -->
{#snippet briefFormSnippet()}
  {#if briefTx}
    <form class="grid gap-3 max-md:grid-cols-1 md:grid-cols-2" onsubmit={(e) => simpanBrief(briefTx, e)} data-brief-form>
      {#each [['objective', 'Objective'], ['audience', 'Audience'], ['style', 'Style'], ['mood', 'Mood'], ['lokasi', 'Lokasi'], ['talent', 'Talent'], ['deliverables', 'Deliverables'], ['deadline', 'Deadline'], ['notes', 'Notes']] as [f, label] (f)}
        <label class="grid gap-1 text-body-sm">{label}<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2 text-body-sm" type={f === 'deadline' ? 'date' : 'text'} bind:value={brForm[f]} /></label>
      {/each}
      <label class="grid gap-1 text-body-sm">DO<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2 text-body-sm" bind:value={brForm.dos} /></label>
      <label class="grid gap-1 text-body-sm">DON'T<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2 text-body-sm" bind:value={brForm.donts} /></label>
      <button class="rounded-rw-control bg-rw-accent px-6 py-2.5 text-body-sm text-rw-white disabled:opacity-50 md:col-span-2 md:justify-self-start max-md:w-full" type="submit" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Simpan brief'}
      </button>
    </form>
  {/if}
{/snippet}

<!-- RAB builder body — rendered inside the Panel by bukaRabBuilder() (ticket 05).
     Behaviour is unchanged from the previous inline form (dari-Paket copy, add/
     remove baris, subtotal, flat total); only the container moved, per ADR-0012's
     Detail Pattern hybrid. Field set and bindings stay the same. -->
{#snippet rabBuilderSnippet()}
  <form class="grid gap-4" onsubmit={simpanRab} data-rab-form>
    <div class="grid gap-4 max-md:grid-cols-1 md:grid-cols-2">
      <label class="grid gap-1 text-body-sm">
        Nama project
        <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" name="rb_project" required bind:value={rbProject} placeholder="Paket Nikahan" />
      </label>
      <label class="grid gap-1 text-body-sm">
        Tanggal RAB
        <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="date" required bind:value={rbTanggal} />
      </label>
      <label class="grid gap-1 text-body-sm">
        Nama client
        <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" name="rb_client" required bind:value={rbClient} placeholder="Soleh Permana" />
      </label>
      <label class="grid gap-1 text-body-sm">
        Perusahaan (opsional)
        <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={rbPerusahaan} />
      </label>
    </div>
    {#if rbBaris.length}
      <ul class="grid gap-1 text-body-sm">
        {#each rbBaris as b, i (i)}
          <li class="flex justify-between gap-2">
            <span>{b.nama} × {b.qty} {b.satuan} <span class="text-rw-light-gray">[{b.jenis}]</span></span>
            <span>{rupiah(b.qty * b.harga_satuan)} <button type="button" class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => hapusBaris(i)}>hapus</button></span>
          </li>
        {/each}
      </ul>
      <p class="text-body-sm">Subtotal {rupiah(rbSum())}</p>
    {:else}
      <p class="text-body-sm text-rw-light-gray">Belum ada baris, salin dari paket lewat tombol “Buat RAB”, atau tambah manual di bawah.</p>
    {/if}
    <div class="grid gap-3 max-md:grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-end">
      <label class="grid gap-1 text-body-sm">
        Item
        <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={nbNama} placeholder="Live Streaming 2 camera" />
      </label>
      <label class="grid gap-1 text-body-sm">
        Jenis
        <select class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={nbJenis}>
          <option value="alat">alat</option>
          <option value="jasa">jasa</option>
          <option value="biaya">biaya</option>
        </select>
      </label>
      <label class="grid gap-1 text-body-sm">
        Qty
        <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="number" min="1" step="1" bind:value={nbQty} />
      </label>
      <label class="grid gap-1 text-body-sm">
        Satuan
        <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={nbSatuan} placeholder="Hari" />
      </label>
      <label class="grid gap-1 text-body-sm">
        Harga (Rp)
        <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="number" min="0" step="1" bind:value={nbHarga} />
      </label>
      <button type="button" class="rounded-rw-control border border-rw-border-gray/40 px-5 py-2.5 text-body-sm max-md:py-3 max-md:w-full" onclick={tambahBaris}>+ Baris</button>
    </div>
    <div class="grid gap-3 max-md:grid-cols-1 md:grid-cols-[1fr_2fr_auto] md:items-end">
      <label class="grid gap-1 text-body-sm">
        Diskon (Rp)
        <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="number" min="0" step="1" bind:value={rbDiskon} placeholder="0" />
      </label>
      <label class="grid gap-1 text-body-sm">
        Catatan
        <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={rbCatatan} placeholder="Include file edit" />
      </label>
      <button class="rounded-rw-control bg-rw-accent px-6 py-2.5 text-body-sm text-rw-white disabled:opacity-50 md:justify-self-start max-md:py-3 max-md:w-full" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan draft'}</button>
    </div>
  </form>
{/snippet}

{#snippet txRow(t)}
  <tr class="border-b border-rw-border-gray/40 align-top scroll-mt-24 {openTransaksiId === t.id ? 'bg-rw-darker' : ''}">
    <td class="px-3 py-2 max-md:py-3">
      <p class="text-body font-normal">{t.nama_project}</p>
      {#if t.lokasi}<p class="text-caption text-rw-light-gray">{t.lokasi}</p>{/if}
    </td>
    <td class="px-3 py-2 max-md:py-3">
      {t.nama_client}
      {#if t.perusahaan_client}<p class="text-caption text-rw-light-gray">{t.perusahaan_client}</p>{/if}
    </td>
    <td class="px-3 py-2 whitespace-nowrap max-md:py-3">{t.tanggal_mulai ? `${tgl(t.tanggal_mulai)}${t.tanggal_selesai && t.tanggal_selesai !== t.tanggal_mulai ? ` – ${tgl(t.tanggal_selesai)}` : ''}` : '—'}</td>
    <td class="px-3 py-2 text-right tabular-nums whitespace-nowrap max-md:py-3">{rupiah(t.total)}</td>
    <td class="px-3 py-2 max-md:py-3"><span class="rounded-rw-badge px-2 py-0.5 text-caption {rwChip(t.status)}">{t.status}</span></td>
    <td class="px-3 py-2 max-md:py-3">
      <div class="flex flex-wrap items-center justify-end gap-3">
        {#if t.status === 'terjadwal'}
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => statusTransaksi(t, 'berjalan')}>Mulai</button>
        {:else if t.status === 'berjalan'}
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => statusTransaksi(t, 'selesai')}>Selesai</button>
        {:else if t.status === 'selesai' && !t.invoice_terbit}
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => terbitkan(t)}>Terbitkan</button>
        {/if}
        <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => bukaTransaksi(t)}>{openTransaksiId === t.id ? 'Tutup' : 'Rincian'}</button>
      </div>
    </td>
  </tr>
  {#if openTransaksiId === t.id}
  <tr class="bg-rw-darker"><td colspan="6" class="px-3 py-4">
    <div class="grid gap-2">
      {#each txGrup(t) as g (g.kategori)}
        <p class="text-caption uppercase text-rw-light-gray">{g.kategori}: subtotal {rupiah(g.subtotal)}</p>
        <ul class="grid gap-1 text-body-sm">
          {#each g.baris as b (b.id)}
            <li class="flex justify-between gap-2"><span>{b.nama} × {b.qty} {b.satuan} <span class="text-rw-light-gray">[{b.jenis}]</span></span><span class="tabular-nums">{rupiah(b.qty * b.harga_satuan)}</span></li>
          {/each}
        </ul>
      {/each}
      {#if !txGrup(t).length}<p class="text-body-sm text-rw-light-gray">Tanpa baris.</p>{/if}
    </div>
    <div class="mt-3 flex flex-wrap gap-4 text-body-sm">
      <button class="underline" onclick={() => bukaBrief(t)} data-brief-toggle>Brief</button>
      <button class="underline" onclick={() => printBrief(t)}>Cetak brief</button>
      {#if !t.invoice_terbit && t.status !== 'selesai' && t.status !== 'batal'}<button class="underline" onclick={() => terbitkan(t)}>Terbitkan invoice</button>{/if}
      {#if t.status !== 'batal' && t.status !== 'selesai'}<button class="underline" onclick={() => statusTransaksi(t, 'batal')}>Batal</button>{/if}
    </div>
  </td></tr>
  {/if}
{/snippet}

{#snippet rabRow(r)}
  <tr class="border-b border-rw-border-gray/40 align-top scroll-mt-24 {openRabId === r.id ? 'bg-rw-darker' : ''}">
    <td class="px-3 py-2 whitespace-nowrap max-md:py-3">{r.nomor}</td>
    <td class="px-3 py-2 max-md:py-3"><p class="text-body font-normal">{r.nama_project}</p></td>
    <td class="px-3 py-2 max-md:py-3">
      {r.nama_client}
      {#if r.perusahaan_client}<p class="text-caption text-rw-light-gray">{r.perusahaan_client}</p>{/if}
    </td>
    <td class="px-3 py-2 text-right tabular-nums whitespace-nowrap max-md:py-3">{rupiah(r.total)}</td>
    <td class="px-3 py-2 max-md:py-3"><span class="rounded-rw-badge px-2 py-0.5 text-caption {rwChip(r.status)}">{r.status}</span></td>
    <td class="px-3 py-2 max-md:py-3">
      <div class="flex flex-wrap items-center justify-end gap-3">
        {#if r.status === 'draft'}
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => statusRab(r, 'sent')}>Kirim</button>
        {:else if r.status === 'sent'}
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => setujui(r)}>Setujui</button>
        {/if}
        <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => (openRabId = openRabId === r.id ? null : r.id)}>{openRabId === r.id ? 'Tutup' : 'Rincian'}</button>
      </div>
    </td>
  </tr>
  {#if openRabId === r.id}
  <tr class="bg-rw-darker"><td colspan="6" class="px-3 py-4">
    <div class="grid gap-2">
      {#each rabGrup(r) as g (g.kategori)}
        <p class="text-caption uppercase text-rw-light-gray">{g.kategori}: subtotal {rupiah(g.subtotal)}</p>
        <ul class="grid gap-1 text-body-sm">
          {#each g.baris as b (b.id)}
            <li class="flex justify-between gap-2"><span>{b.nama} × {b.qty} {b.satuan} <span class="text-rw-light-gray">[{b.jenis}]</span></span><span class="tabular-nums">{rupiah(b.qty * b.harga_satuan)}</span></li>
          {/each}
        </ul>
      {/each}
      {#if !rabGrup(r).length}<p class="text-body-sm text-rw-light-gray">Tanpa baris.</p>{/if}
      <p class="text-body-sm">
        {#if r.diskon}Diskon −{rupiah(r.diskon)} · {/if}<span class="font-normal">Total {rupiah(r.total)}</span>
      </p>
      {#if r.catatan}<p class="text-body-sm text-rw-light-gray">Catatan: {r.catatan}</p>{/if}
    </div>
    <div class="mt-3 flex flex-wrap gap-4 text-body-sm">
      {#if r.status === 'sent'}
        <button class="underline" onclick={() => statusRab(r, 'rejected')}>Tolak</button>
        <button class="underline" onclick={() => statusRab(r, 'draft')}>Revisi</button>
      {:else if r.status === 'draft'}
        <button class="underline" onclick={() => statusRab(r, 'rejected')}>Tolak</button>
      {/if}
      {#if r.status === 'rejected'}
        <button class="underline" onclick={() => statusRab(r, 'draft')}>Revisi</button>
      {/if}
      <button class="underline" onclick={() => printRab(r)}>Cetak</button>
    </div>
  </td></tr>
  {/if}
{/snippet}

{#snippet invRow(i)}
  <tr class="border-b border-ash align-top scroll-mt-24 {openInvoiceId === i.id ? 'bg-canvas' : ''}">
    <td class="px-3 py-3 whitespace-nowrap">{i.nomor}</td>
    <td class="px-3 py-3"><p class="text-body font-normal">{invClient(i) || '—'}</p></td>
    <td class="px-3 py-3 text-right">{rupiah(i.total)}</td>
    <td class="px-3 py-3 text-right">{rupiah(i.dibayar)}</td>
    <!-- Sisa bold saat overdue (Q17) biar yang ditagih paling menonjol. -->
    <td class="px-3 py-3 text-right {i.overdue ? 'font-medium' : ''}">{rupiah(i.sisa)}</td>
    <td class="px-3 py-3 whitespace-nowrap">{tgl(i.jatuh_tempo)}</td>
    <td class="px-3 py-3"><span class="rounded-pill px-3 py-1 text-caption {chipCls(i.status, i.overdue)}">{i.status}{i.overdue ? ' · overdue' : ''}</span></td>
    <td class="px-3 py-3">
      <div class="flex flex-wrap justify-end gap-3">
        {#if i.status !== 'paid' && i.status !== 'batal'}
          <button class="underline scroll-mt-32" onclick={() => bayarCepat(i)} data-inv-bayar>Bayar</button>
        {/if}
        <button class="underline scroll-mt-32" onclick={() => bukaInvoice(i)}>{openInvoiceId === i.id ? 'Tutup' : 'Rincian'}</button>
      </div>
    </td>
  </tr>
  {#if openInvoiceId === i.id}
  <tr class="bg-canvas"><td colspan="8" class="px-3 py-4">
    {#if invDetail}
      <!-- Riwayat bayar: tanggal + label DP/Cicilan/Pelunasan + metode (B3). -->
      <p class="text-caption uppercase text-graphite">Riwayat pembayaran — dibayar {rupiah(i.dibayar)} · sisa {rupiah(i.sisa)}</p>
      {#if invDetail.bayar.length}
        <ul class="mt-2 grid gap-1 text-body-sm">
          {#each invDetail.bayar as p (p.id)}
            <li class="flex justify-between gap-2"><span>{tgl(p.tanggal)} ({p.label}) — {p.metode}</span><span>{rupiah(p.jumlah)}</span></li>
          {/each}
        </ul>
      {:else}
        <p class="mt-2 text-body-sm text-graphite">Belum ada pembayaran.</p>
      {/if}

      <!-- Form bayar lapis-dua (Q18); minus = koreksi (M1); batal → terkunci. -->
      {#if i.status !== 'batal'}
        <form class="mt-4 grid gap-3 border-t border-ash pt-4 max-md:grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end" onsubmit={(e) => bayar(i, e)} data-inv-bayar-form>
          <p class="text-body font-normal md:col-span-4">Catat pembayaran</p>
          <label class="grid gap-1 text-body-sm">Tanggal<input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" type="date" required bind:value={byTanggal} /></label>
          <label class="grid gap-1 text-body-sm">Jumlah (Rp, minus = koreksi)<input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" type="number" step="1" required bind:value={byJumlah} /></label>
          <label class="grid gap-1 text-body-sm">Metode<select class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" bind:value={byMetode}><option value="transfer">transfer</option><option value="cash">cash</option></select></label>
          <button class="rounded-pill bg-navy-ink px-5 py-2 text-body-sm text-bone-white max-md:w-full" type="submit">Catat bayar</button>
        </form>

        <!-- Ubah jatuh tempo via PATCH (redesign #57); overdue ikut turunan. -->
        <form class="mt-4 grid gap-3 border-t border-ash pt-4 max-md:grid-cols-1 md:grid-cols-[1fr_auto] md:items-end" onsubmit={(e) => simpanTempo(i, e)} data-inv-tempo-form>
          <label class="grid gap-1 text-body-sm">Jatuh tempo<input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" type="date" required bind:value={invTempo} /></label>
          <button class="rounded-pill border border-ash px-5 py-2 text-body-sm max-md:w-full" type="submit">Simpan tempo</button>
        </form>
      {:else}
        <p class="mt-4 border-t border-ash pt-4 text-body-sm text-graphite">Invoice dibatalkan — pembayaran & tempo terkunci, riwayat tetap tersimpan.</p>
      {/if}

      <div class="mt-4 flex flex-wrap gap-4 text-body-sm">
        <button class="underline" onclick={printInvoice}>Cetak</button>
        {#if i.status !== 'paid' && i.status !== 'batal'}
          <button class="underline" onclick={() => voidInvoice(i)}>Batalkan</button>
        {/if}
      </div>
    {:else}
      {@render skeleton(2)}
    {/if}
  </td></tr>
  {/if}
{/snippet}

{#snippet alatCard(a)}
  {@const badge = balikModalBadge(a)}
  <li class="border border-ash bg-bone-white p-4 {a.is_active ? '' : 'opacity-75'}" data-alat-card data-alat-id={a.id}>
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <p class="text-body font-normal">
        {a.nama}
        {#if !a.is_active}<span class="ml-2 text-caption text-graphite uppercase">Arsip</span>{/if}
      </p>
      <!-- Badge Balik modal 3-warna: hijau / kuning ≤3 event / merah. -->
      <span class="rounded-pill px-3 py-1 text-caption {badge.cls}" data-balik-modal-badge>{badge.text}</span>
    </div>
    <p class="mt-2 text-body-sm text-graphite">
      Modal {rupiah(a.modal)} · Pendapatan {rupiah(a.pendapatan)} · Tarif {rupiah(a.tarif_event)}/event
    </p>
    <div class="mt-3 flex flex-wrap gap-4 text-body-sm">
      <button class="underline" onclick={() => toggle(a)} data-alat-servis-toggle>
        {openId === a.id ? 'Tutup servis' : 'Servis & riwayat'}
      </button>
      {#if a.is_active}
        <button class="underline" onclick={() => arsipkan(a)} data-alat-arsip>Arsipkan</button>
      {:else}
        <button class="underline" onclick={() => aktifkan(a)} data-alat-aktifkan>Aktifkan kembali</button>
      {/if}
    </div>
    {#if openId === a.id}
      <div class="mt-4 border-t border-ash pt-4" data-alat-servis>
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-caption uppercase text-graphite">Riwayat servis — menambah Modal</p>
          <!-- Form catat = lapis-dua di dalam expand (Q18). -->
          <button class="underline text-body-sm" onclick={() => bukaServisForm(a)} data-servis-form-toggle>
            {servisFormId === a.id ? 'Tutup form' : '+ Catat servis'}
          </button>
        </div>
        {#if !servisRows.length}
          <p class="mt-2 text-body-sm text-graphite">Belum ada servis tercatat.</p>
        {:else}
          <ul class="mt-2 grid gap-2 text-body-sm">
            {#each servisRows as s (s.id)}
              <li class="flex justify-between gap-2"><span>{tgl(s.tanggal)} — {s.keterangan || '(tanpa keterangan)'}</span><span>{rupiah(s.biaya)}</span></li>
            {/each}
          </ul>
        {/if}
        {#if servisFormId === a.id}
          <form class="mt-4 grid gap-3 border-t border-ash pt-4 max-md:grid-cols-1 md:grid-cols-[1fr_2fr_1fr_auto] md:items-end" onsubmit={(e) => addServis(a, e)} data-servis-form>
            <label class="grid gap-1 text-body-sm">
              Tanggal
              <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" type="date" required bind:value={svTanggal} />
            </label>
            <label class="grid gap-1 text-body-sm">
              Keterangan
              <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" bind:value={svKeterangan} placeholder="Ganti kabel" />
            </label>
            <label class="grid gap-1 text-body-sm">
              Biaya (Rp)
              <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" type="number" min="0" step="1" required bind:value={svBiaya} />
            </label>
            <button class="rounded-pill bg-navy-ink px-5 py-3 text-body-sm text-bone-white max-md:w-full" type="submit">Catat</button>
          </form>
        {/if}
      </div>
    {/if}
  </li>
{/snippet}

{#snippet navItem(v, label, Icon)}
  <!-- Active item: purple text + a thin purple tint on charcoal, so location is
       marked by the one accent (antislop: purple is the dashboard's single
       deliberate accent) rather than a heavy solid block. -->
  <button
    class="flex min-h-11 w-full items-center justify-between gap-2 rounded-rw-control px-3 py-2 text-left text-body-sm transition-colors {view === v
      ? 'bg-rw-accent/15 text-rw-accent'
      : 'text-rw-light-gray hover:bg-rw-off-white/5 hover:text-rw-off-white'}"
    aria-current={view === v ? 'page' : undefined}
    onclick={() => pilih(v)}
  >
    <span class="flex items-center gap-3">
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </span>
    {#if v === 'invoice' && invBelumLunas.length}
      <span data-badge-invoice class="rounded-rw-badge px-2 py-0.5 text-caption {invOverdue ? 'bg-rw-danger/20 text-rw-danger-text' : 'bg-rw-off-white/10 text-rw-off-white'}">{invBelumLunas.length}</span>
    {:else if v === 'transaksi' && txAktif}
      <span data-badge-transaksi class="rounded-rw-badge bg-rw-off-white/10 px-2 py-0.5 text-caption text-rw-off-white">{txAktif}</span>
    {/if}
  </button>
{/snippet}

{#snippet sidebar()}
  <p class="px-3 pt-5 pb-2 font-rw-serif text-subheading">Nava</p>
  <nav class="flex-1 overflow-y-auto px-2 pb-4" aria-label="Dashboard">
    {#each NAV as [group, items] (group)}
      <p class="px-3 pt-4 pb-1 text-caption uppercase tracking-wide text-rw-mid-gray">{group}</p>
      {#each items as [v, label, Icon] (v)}
        {@render navItem(v, label, Icon)}
      {/each}
    {/each}
    <div class="mx-3 mt-4 border-t border-rw-border-gray/40"></div>
    {@render navItem('settings', 'Settings', Settings)}
  </nav>
  <div class="flex items-center justify-between gap-3 border-t border-rw-border-gray/40 px-3 py-3">
    <span class="flex min-w-0 items-center gap-2 text-body-sm text-rw-light-gray">
      <User size={16} strokeWidth={1.75} aria-hidden="true" />
      {#if me}<span class="truncate">{me}</span>{/if}
    </span>
    <button class="flex shrink-0 items-center gap-2 text-body-sm text-rw-light-gray hover:text-rw-off-white" onclick={logout}>
      <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
      Keluar
    </button>
  </div>
{/snippet}

<!-- Sidebar desktop, fixed ~260px (ADR-0012). Charcoal surface (#33323E) reads
     as chrome on the #13111C ground; hairline border separates the two. -->
<aside data-sidebar class="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-rw-border-gray/40 bg-rw-charcoal md:flex">
  {@render sidebar()}
</aside>

<!-- Topbar mobile: hamburger + Nava + user -->
<header class="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-rw-border-gray/40 bg-rw-charcoal px-4 md:hidden">
  <button class="-ml-2 rounded-rw-control p-2 text-rw-off-white" aria-label="Buka menu" onclick={bukaDrawer}>
    <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
  </button>
  <p class="font-rw-serif text-subheading">Nava</p>
  <span class="flex items-center gap-2 text-body-sm text-rw-light-gray">
    <User size={16} strokeWidth={1.75} aria-hidden="true" />
    {me}
  </span>
</header>

<!-- Drawer overlay mobile -->
{#if drawerOpen}
  <div class="fixed inset-0 z-50 md:hidden">
    <button class="absolute inset-0 bg-rw-darker/70" aria-label="Tutup menu" onclick={tutupDrawer}></button>
    <div data-drawer class="absolute inset-y-0 left-0 flex w-[260px] flex-col bg-rw-charcoal">
      {@render sidebar()}
    </div>
  </div>
{/if}

<!-- Panel (ticket 02): shared heavyweight-form container. Native <dialog> so
     Esc and top-layer come from the platform; backdrop click also closes.
     The dialog itself is a full-viewport layer (inset-0) so its exposed area is
     clickable for outside-click; the sheet is pinned right on desktop and fills
     the screen on mobile (the sheet's own w-screen under md). -->
<dialog
  bind:this={panelEl}
  data-panel
  aria-labelledby="panel-judul"
  onclose={tutupPanel}
  onclick={panelKlikLuar}
  class="panel inset-0 m-0 h-dvh w-screen max-h-none max-w-none border-0 bg-transparent p-0 text-rw-off-white"
>
  <div class="ml-auto flex h-dvh w-screen flex-col border-l border-rw-border-gray/40 bg-rw-charcoal md:w-[480px]">
    <div class="flex items-center justify-between gap-4 border-b border-rw-border-gray/40 px-5 py-4">
      <h2 id="panel-judul" class="text-subheading">{panelTitle}</h2>
      <button class="rounded-rw-control p-2 text-rw-light-gray hover:text-rw-off-white" aria-label="Tutup panel" onclick={tutupPanel}>
        <X size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
    <div class="flex-1 overflow-y-auto px-5 py-4">
      {@render panelIsi?.()}
    </div>
  </div>
</dialog>

<div class="min-h-dvh bg-rw-ground md:pl-[260px]">
  <!-- Banner sticky (Q37): error merah menetap, notice hijau→netral auto 6 dtk.
       Colours are the dark-palette tints (ADR-0013) so the banner reads on the
       #13111C ground instead of the old light banner blocks. -->
  {#if error || notice}
    <div
      class="sticky top-14 z-30 flex items-center justify-between gap-4 border-b px-(--pad) py-3 text-body-sm md:top-0 {error
        ? 'border-rw-danger/30 bg-rw-danger/15 text-rw-danger-text'
        : 'border-rw-border-gray/40 bg-rw-charcoal text-rw-off-white'}"
      role={error ? 'alert' : 'status'}
    >
      <span>{error || notice}</span>
      <button class="shrink-0 text-current underline" aria-label="Tutup notifikasi" onclick={() => { error = ''; notice = ''; }}>Tutup</button>
    </div>
  {/if}

  <main class="px-(--pad) py-6">

    {#if view === 'alat'}
    <!-- Alat (#59): kartu deskriptif (bukan tabel — list sedikit), tambah di
         balik +, servis lapis-dua di dalam expand, arsip confirm beda-bobot
         + toggle default-sembunyi. HP: semua field tumpuk penuh (Q24). -->
    <section class="mt-8" data-view="alat">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-subheading font-normal">Alat</h2>
        <button class="rounded-pill bg-navy-ink px-5 py-3 text-body-sm text-bone-white" onclick={bukaAlatBuilder} data-alat-toggle>
          {alatBuilderOpen ? 'Tutup' : '+ Alat baru'}
        </button>
      </div>

      {#if alatBuilderOpen}
      <form class="mt-4 grid gap-4 border border-ash bg-bone-white p-4 max-md:grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end" onsubmit={addAlat} data-alat-form>
        <label class="grid gap-1 text-body-sm">
          Nama
          <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" name="nama" required bind:value={nama} placeholder="Sony NXR-100" />
        </label>
        <label class="grid gap-1 text-body-sm">
          Harga beli (Rp)
          <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" name="harga_beli" type="number" min="0" step="1" required bind:value={hargaBeli} placeholder="10000000" />
        </label>
        <label class="grid gap-1 text-body-sm">
          Tarif/event (Rp)
          <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" name="tarif_event" type="number" min="0" step="1" required bind:value={tarifEvent} placeholder="350000" />
        </label>
        <button class="rounded-pill bg-navy-ink px-6 py-3 text-body-sm text-bone-white disabled:opacity-50 max-md:w-full" type="submit" disabled={busy}>
          {busy ? '…' : 'Tambah'}
        </button>
      </form>
      {/if}

      {#if !alat.length}
        <!-- Empty state: satu baris + CTA (Q34). -->
        <p class="mt-4 text-body-sm text-graphite">Belum ada alat. Tambahkan lewat tombol “+ Alat baru” di atas.</p>
      {:else if !alatAktif.length}
        <p class="mt-4 text-body-sm text-graphite">Semua alat terarsip. <button class="underline" onclick={() => (showArsip = true)} data-arsip-toggle>Tampilkan arsip</button></p>
      {:else}
        <ul class="mt-4 grid gap-4">
          {#each alatAktif as a (a.id)}
            {@render alatCard(a)}
          {/each}
        </ul>
      {/if}

      {#if alatArsip.length}
        <!-- Arsip: default-sembunyi (Q27), toggle sesi; tanpa hapus fisik. -->
        <div class="mt-8 border-t border-ash pt-4">
          <button class="text-body-sm underline" onclick={() => (showArsip = !showArsip)} data-arsip-toggle>
            {showArsip ? 'Sembunyikan arsip' : `Tampilkan arsip (${alatArsip.length})`}
          </button>
          {#if showArsip}
            <ul class="mt-4 grid gap-4">
              {#each alatArsip as a (a.id)}
                {@render alatCard(a)}
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </section>
    {/if}
    {#if view === 'paket'}
    <section class="mt-8" data-view="paket">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-subheading font-normal">Paket</h2>
        <button class="rounded-pill bg-navy-ink px-5 py-3 text-body-sm text-bone-white" onclick={bukaPaketBuilder} data-paket-toggle>
          {paketBuilderOpen ? 'Tutup' : '+ Paket baru'}
        </button>
      </div>

      {#if paketBuilderOpen}
      <form class="mt-4 grid gap-4 border border-ash bg-bone-white p-4" onsubmit={simpanPaket} data-paket-form>
        <div class="grid gap-4 max-md:grid-cols-1 md:grid-cols-2">
          <label class="grid gap-1 text-body-sm">
            Nama paket
            <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" name="nama" required bind:value={pkNama} placeholder="Paket Dokumentasi" />
          </label>
          <label class="grid gap-1 text-body-sm">
            Deskripsi (opsional)
            <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" bind:value={pkDeskripsi} placeholder="Live streaming 1 kamera" />
          </label>
        </div>
        {#if pkBaris.length}
          <ul class="grid gap-1 text-body-sm">
            {#each pkBaris as b, i (i)}
              <li class="flex justify-between gap-2">
                <span>{b.nama} × {b.qty} {b.satuan} <span class="text-graphite">[{b.jenis} · {b.kategori}]</span></span>
                <span>{rupiah(b.qty * b.harga_satuan)} <button type="button" class="underline" onclick={() => (pkBaris = pkBaris.filter((_, j) => j !== i))}>hapus</button></span>
              </li>
            {/each}
          </ul>
          <p class="text-body-sm">Total {rupiah(pkSum(pkBaris))}</p>
        {:else}
          <p class="text-body-sm text-graphite">Belum ada baris — tambah kategori/jenis/qty/satuan/rate di bawah.</p>
        {/if}
        <div class="grid gap-3 max-md:grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] md:items-end">
          <label class="grid gap-1 text-body-sm">
            Item
            <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" bind:value={pbNama} placeholder="SONY NXR-100" data-pk-item />
          </label>
          <label class="grid gap-1 text-body-sm">
            Jenis
            <select class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" bind:value={pbJenis} data-pk-jenis>
              <option value="alat">alat</option>
              <option value="jasa">jasa</option>
              <option value="biaya">biaya</option>
            </select>
          </label>
          <label class="grid gap-1 text-body-sm">
            Kategori
            <select class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" bind:value={pbKategori} data-pk-kategori>
              {#each KATEGORI as k (k)}<option value={k}>{k}</option>{/each}
            </select>
          </label>
          <label class="grid gap-1 text-body-sm">
            Qty
            <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" type="number" min="1" step="1" bind:value={pbQty} data-pk-qty />
          </label>
          <label class="grid gap-1 text-body-sm">
            Satuan
            <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" bind:value={pbSatuan} placeholder="Unit" data-pk-satuan />
          </label>
          <label class="grid gap-1 text-body-sm">
            Rate (Rp)
            <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" type="number" min="0" step="1" bind:value={pbHarga} data-pk-harga />
          </label>
          <button type="button" class="rounded-pill border border-ash px-5 py-3 text-body-sm max-md:w-full" onclick={() => pkTambahBaris(pkBaris, (v) => (pkBaris = v))} data-pk-tambah-baris>+ Baris</button>
        </div>
        <button class="rounded-pill bg-navy-ink px-6 py-3 text-body-sm text-bone-white disabled:opacity-50 md:justify-self-start max-md:w-full" type="submit" disabled={busy}>{busy ? '…' : 'Simpan paket'}</button>
      </form>
      {/if}

      {#if !paket.length}
        <!-- Empty state: satu baris + CTA (Q34). -->
        <p class="mt-4 text-body-sm text-graphite">Belum ada paket. Mulai lewat tombol “+ Paket baru” di atas.</p>
      {:else}
        <ul class="mt-4 grid gap-4">
          {#each paket as p (p.id)}
            <li class="border border-ash bg-bone-white p-4" data-paket-card data-paket-id={p.id}>
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <p class="text-body font-normal">{p.nama}</p>
                <p class="text-body-sm">{rupiah(p.total)}</p>
              </div>
              {#if p.deskripsi}<p class="mt-1 text-caption text-graphite">{p.deskripsi}</p>{/if}
              <div class="mt-2 flex flex-wrap gap-4 text-body-sm">
                <button class="underline" onclick={() => (openPaketId = openPaketId === p.id ? null : p.id)}>
                  {openPaketId === p.id ? 'Tutup rincian' : `Lihat ${p.baris.length} baris`}
                </button>
                <button class="underline" onclick={() => bukaEditPaket(p)}>{editPaketId === p.id ? 'Tutup ubah' : 'Ubah'}</button>
                <button class="underline" onclick={() => dariPaket(p)}>Buat RAB</button>
              </div>
              {#if openPaketId === p.id}
                <div class="mt-3 border-t border-ash pt-3">
                  {#each paketGrup(p) as g (g.kategori)}
                    <p class="mt-2 text-caption uppercase text-graphite">{g.kategori}: subtotal {rupiah(g.subtotal)}</p>
                    <ul class="grid gap-1 text-body-sm">
                      {#each g.baris as b (b.id)}
                        <li class="flex justify-between gap-2">
                          <span>{b.nama} × {b.qty} {b.satuan} <span class="text-graphite">[{b.jenis}]</span></span>
                          <span>{rupiah(b.qty * b.harga_satuan)}</span>
                        </li>
                      {/each}
                    </ul>
                  {/each}
                  <p class="mt-2 text-body-sm font-normal">Total {rupiah(p.total)}</p>
                </div>
              {/if}
              {#if editPaketId === p.id}
                <form class="mt-4 grid gap-4 border-t border-ash pt-4" onsubmit={(e) => simpanEditPaket(p, e)} data-paket-edit-form>
                  <p class="text-body-sm text-graphite">Mengubah paket tidak mengubah RAB/Transaksi lama — dokumen itu punya snapshot sendiri.</p>
                  <div class="grid gap-4 max-md:grid-cols-1 md:grid-cols-2">
                    <label class="grid gap-1 text-body-sm">
                      Nama paket
                      <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" required bind:value={pkEditNama} />
                    </label>
                    <label class="grid gap-1 text-body-sm">
                      Deskripsi (opsional)
                      <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" bind:value={pkEditDeskripsi} />
                    </label>
                  </div>
                  {#if pkEditBaris.length}
                    <ul class="grid gap-1 text-body-sm">
                      {#each pkEditBaris as b, i (i)}
                        <li class="flex justify-between gap-2">
                          <span>{b.nama} × {b.qty} {b.satuan} <span class="text-graphite">[{b.jenis} · {b.kategori}]</span></span>
                          <span>{rupiah(b.qty * b.harga_satuan)} <button type="button" class="underline" onclick={() => (pkEditBaris = pkEditBaris.filter((_, j) => j !== i))}>hapus</button></span>
                        </li>
                      {/each}
                    </ul>
                    <p class="text-body-sm">Total {rupiah(pkSum(pkEditBaris))}</p>
                  {:else}
                    <p class="text-body-sm text-graphite">Belum ada baris — tambah di bawah.</p>
                  {/if}
                  <div class="grid gap-3 max-md:grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] md:items-end">
                    <label class="grid gap-1 text-body-sm">
                      Item
                      <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" bind:value={pbNama} placeholder="SONY NXR-100" data-pk-item />
                    </label>
                    <label class="grid gap-1 text-body-sm">
                      Jenis
                      <select class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" bind:value={pbJenis} data-pk-jenis>
                        <option value="alat">alat</option>
                        <option value="jasa">jasa</option>
                        <option value="biaya">biaya</option>
                      </select>
                    </label>
                    <label class="grid gap-1 text-body-sm">
                      Kategori
                      <select class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" bind:value={pbKategori} data-pk-kategori>
                        {#each KATEGORI as k (k)}<option value={k}>{k}</option>{/each}
                      </select>
                    </label>
                    <label class="grid gap-1 text-body-sm">
                      Qty
                      <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" type="number" min="1" step="1" bind:value={pbQty} data-pk-qty />
                    </label>
                    <label class="grid gap-1 text-body-sm">
                      Satuan
                      <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" bind:value={pbSatuan} placeholder="Unit" data-pk-satuan />
                    </label>
                    <label class="grid gap-1 text-body-sm">
                      Rate (Rp)
                      <input class="rounded-none border border-ash bg-bone-white px-3 py-3 text-body-sm" type="number" min="0" step="1" bind:value={pbHarga} data-pk-harga />
                    </label>
                    <button type="button" class="rounded-pill border border-ash px-5 py-3 text-body-sm max-md:w-full" onclick={() => pkTambahBaris(pkEditBaris, (v) => (pkEditBaris = v))} data-pk-tambah-baris>+ Baris</button>
                  </div>
                  <button class="rounded-pill bg-navy-ink px-6 py-3 text-body-sm text-bone-white disabled:opacity-50 md:justify-self-start max-md:w-full" type="submit" disabled={busy}>{busy ? '…' : 'Simpan perubahan'}</button>
                </form>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
    {/if}
    {#if view === 'rab'}
    <section class="mt-8" data-view="rab">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-subheading font-normal">RAB</h2>
        <button class="rounded-rw-control bg-rw-accent px-5 py-2.5 text-body-sm text-rw-white max-md:py-3" onclick={bukaRabBuilder} data-rab-toggle>
          + RAB baru
        </button>
      </div>

      {#if !rabs.length}
        <p class="mt-4 text-body-sm text-rw-light-gray">Belum ada RAB. Mulai lewat tombol “+ RAB baru” di atas, atau salin dari Paket lewat “Buat RAB”.</p>
      {:else}
      <div class="mt-4 flex flex-wrap gap-3">
        <input class="min-w-40 flex-1 rounded-rw-control border border-rw-border-gray/40 bg-rw-charcoal px-3 py-2 text-body-sm placeholder:text-rw-light-gray max-md:py-3" placeholder="Cari nomor / project / client" bind:value={rabSearch} data-rab-search />
        <select class="rounded-rw-control border border-rw-border-gray/40 bg-rw-charcoal px-3 py-2 text-body-sm max-md:py-3" bind:value={rabStatusFilter} data-rab-status>
          <option value="semua">semua status</option>
          {#each RAB_STATUSES as s (s)}<option value={s}>{s}</option>{/each}
        </select>
      </div>

      {#if !rabFiltered.length}
        <p class="mt-4 text-body-sm text-rw-light-gray">Tidak ada yang cocok dengan pencarian/filter. <button class="underline" onclick={() => { rabSearch = ''; rabStatusFilter = 'semua'; }}>Reset</button></p>
      {:else}
      <!-- Rail table (ticket 05): dense on desktop, comfortable on mobile. Same
           pattern as the Transaksi table (ticket 04). -->
      <div class="mt-4 overflow-x-auto rounded-rw-card border border-rw-border-gray/40">
        <table class="w-full min-w-[640px] border-collapse text-body-sm">
          <thead class="bg-rw-charcoal md:sticky md:top-0">
            <tr class="border-b border-rw-border-gray/40 text-left text-rw-light-gray">
              <th class="px-3 py-2 font-normal">Nomor</th>
              <th class="px-3 py-2 font-normal">Project</th>
              <th class="px-3 py-2 font-normal">Client</th>
              <th class="px-3 py-2 text-right font-normal"><button class="underline {rabSortKey === 'total' ? 'font-medium' : ''}" onclick={() => rabUrutkan('total')}>Total {rabSortKey === 'total' ? (rabSortDesc ? '↓' : '↑') : ''}</button></th>
              <th class="px-3 py-2 font-normal">Status</th>
              <th class="px-3 py-2 text-right font-normal">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#each rabFiltered as r (r.id)}
              {@render rabRow(r)}
            {/each}
          </tbody>
        </table>
      </div>
      {/if}
      {/if}
    </section>
    {/if}
    {#if view === 'transaksi'}
    <section class="mt-8" data-view="transaksi">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-subheading font-normal">Transaksi</h2>
        <button class="rounded-rw-control bg-rw-accent px-5 py-2.5 text-body-sm text-rw-white max-md:py-3" onclick={bukaWalkin} data-walkin-toggle>
          + Walk-in
        </button>
      </div>

      {#if !transaksi.length}
        <p class="mt-4 text-body-sm text-rw-light-gray">Belum ada transaksi. Mulai lewat tombol “+ Walk-in” di atas.</p>
      {:else}
      <div class="mt-4 flex flex-wrap gap-3">
        <input class="min-w-40 flex-1 rounded-rw-control border border-rw-border-gray/40 bg-rw-charcoal px-3 py-2 text-body-sm placeholder:text-rw-light-gray max-md:py-3" placeholder="Cari project / client / lokasi" bind:value={txSearch} data-tx-search />
        <select class="rounded-rw-control border border-rw-border-gray/40 bg-rw-charcoal px-3 py-2 text-body-sm max-md:py-3" bind:value={txStatusFilter} data-tx-status>
          <option value="semua">semua status</option>
          {#each TX_STATUSES as s (s)}<option value={s}>{s}</option>{/each}
        </select>
      </div>

      {#if !txFiltered.length}
        <p class="mt-4 text-body-sm text-rw-light-gray">Tidak ada yang cocok dengan pencarian/filter. <button class="underline" onclick={() => { txSearch = ''; txStatusFilter = 'semua'; }}>Reset</button></p>
      {:else}
      <!-- Rail table (ticket 04): dense on desktop, comfortable to tap on mobile.
           The overflow wrapper is the scroll container, so the thead sticks only
           from md up (mobile keeps its short header scrolling with the body). -->
      <div class="mt-4 overflow-x-auto rounded-rw-card border border-rw-border-gray/40">
        <table class="w-full min-w-[640px] border-collapse text-body-sm">
          <thead class="bg-rw-charcoal md:sticky md:top-0">
            <tr class="border-b border-rw-border-gray/40 text-left text-rw-light-gray">
              <th class="px-3 py-2 font-normal">Project</th>
              <th class="px-3 py-2 font-normal">Client</th>
              <th class="px-3 py-2 font-normal">Tgl event</th>
              <th class="px-3 py-2 text-right font-normal"><button class="underline {txSortKey === 'total' ? 'font-medium' : ''}" onclick={() => txUrutkan('total')}>Total {txSortKey === 'total' ? (txSortDesc ? '↓' : '↑') : ''}</button></th>
              <th class="px-3 py-2 font-normal">Status</th>
              <th class="px-3 py-2 text-right font-normal">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#each txFiltered as t (t.id)}
              {@render txRow(t)}
            {/each}
          </tbody>
        </table>
      </div>
      {/if}
      {/if}
    </section>
    {/if}
    {#if view === 'invoice'}
    <section class="mt-8" data-view="invoice">
      <h2 class="text-subheading font-normal">Invoice</h2>
      {#if !invoices.length}
        <!-- Empty state: satu baris + CTA (Q34). -->
        <p class="mt-4 text-body-sm text-graphite">Belum ada invoice. Terbitkan dari Transaksi lewat tombol “Terbitkan invoice”.</p>
      {:else}
      <div class="mt-4 flex flex-wrap gap-3">
        <input class="min-w-40 flex-1 rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" placeholder="Cari nomor / client" bind:value={invSearch} data-inv-search />
        <select class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" bind:value={invStatusFilter} data-inv-status>
          <option value="semua">semua status</option>
          {#each INV_STATUSES as s (s)}<option value={s}>{s}</option>{/each}
          <option value="overdue">overdue</option>
        </select>
      </div>

      {#if !invFiltered.length}
        <!-- Filter-miss beda dari empty: tawarkan reset (Q34). -->
        <p class="mt-4 text-body-sm text-graphite">Tidak ada yang cocok dengan pencarian/filter. <button class="underline" onclick={() => { invSearch = ''; invStatusFilter = 'semua'; }}>Reset</button></p>
      {:else}
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[720px] border-collapse text-body-sm">
          <thead class="bg-bone-white md:sticky md:top-0">
            <tr class="border-b border-ash text-left">
              <th class="px-3 py-2 font-normal">Nomor</th>
              <th class="px-3 py-2 font-normal">Client</th>
              <th class="px-3 py-2 text-right font-normal"><button class="underline {invSortKey === 'total' ? 'font-medium' : ''}" onclick={() => invUrutkan('total')}>Total {invSortKey === 'total' ? (invSortDesc ? '↓' : '↑') : ''}</button></th>
              <th class="px-3 py-2 text-right font-normal">Dibayar</th>
              <th class="px-3 py-2 text-right font-normal">Sisa</th>
              <th class="px-3 py-2 font-normal"><button class="underline {invSortKey === 'jatuh_tempo' ? 'font-medium' : ''}" onclick={() => invUrutkan('jatuh_tempo')}>Tempo {invSortKey === 'jatuh_tempo' ? (invSortDesc ? '↓' : '↑') : ''}</button></th>
              <th class="px-3 py-2 font-normal">Status</th>
              <th class="px-3 py-2 text-right font-normal">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#each invFiltered as i (i.id)}
              {@render invRow(i)}
            {/each}
          </tbody>
        </table>
      </div>
      {/if}
      {/if}
    </section>
    {/if}
    {#if view === 'ringkasan'}
    <!-- Ringkasan (#58, ticket 03): pintu masuk kerja harian. Satu kartu hero
         (kas masuk bulan ini) sebagai angka terpenting, dikelilingi grid metrik
         flat; lalu Perlu perhatian dan Transaksi terbaru. Semua kartu/item/baris
         klik-lompat sesuai mapping spec; deep-link tetap sama persis. -->
    <section class="mt-8" data-view="ringkasan">
      <h2 class="text-subheading font-normal">Ringkasan</h2>
      {#if !ringkasan}
        <div class="mt-4">{@render skeleton(4)}</div>
      {:else}
        <div class="mt-4 grid gap-4">
          <!-- Hero: satu angka terpenting, selebar grid. Label kecil di atas,
               nominal besar serif di bawah. Klik → Invoice (label bulan statis,
               bukan filter tanggal — mapping #58 tak berubah). -->
          <button
            class="group flex flex-wrap items-end justify-between gap-4 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-6 text-left transition-colors hover:border-rw-border-gray"
            onclick={() => lompatInvoice()}
            data-card-kas
          >
            <span class="grid gap-3">
              <span class="text-caption uppercase tracking-wide text-rw-light-gray">Kas masuk {bulanIni}</span>
              <span class="font-rw-serif text-heading-sm leading-none">{rupiah(ringkasan.kas_bulan_ini)}</span>
            </span>
            <span class="text-body-sm text-rw-light-gray transition-colors group-hover:text-rw-off-white" aria-hidden="true">Lihat Invoice →</span>
          </button>

          <!-- Grid metrik pendamping: label kecil, angka medium. -->
          <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
            <button class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 text-left transition-colors hover:border-rw-border-gray" onclick={() => lompatInvoice('unpaid')} data-card-piutang>
              <p class="text-caption uppercase tracking-wide text-rw-light-gray">Outstanding</p>
              <p class="mt-2 text-subheading font-normal">{rupiah(ringkasan.piutang)}</p>
            </button>
            <button class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 text-left transition-colors hover:border-rw-border-gray" onclick={() => go('alat')} data-card-alat>
              <p class="text-caption uppercase tracking-wide text-rw-light-gray">Alat balik modal</p>
              <p class="mt-2 text-subheading font-normal">{alatBalikModal}/{ringkasan.per_alat.length}</p>
            </button>
            <button class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 text-left transition-colors hover:border-rw-border-gray max-md:col-span-2" onclick={() => lompatTransaksi('terjadwal')} data-card-job>
              <p class="text-caption uppercase tracking-wide text-rw-light-gray">Job aktif</p>
              <p class="mt-2 text-subheading font-normal">{ringkasan.job_aktif}</p>
            </button>
          </div>
        </div>

        <!-- Perlu perhatian (Q7): overdue + belum-lunas saja, tanpa
             clash-math. Semua-lunas = pesan all-clear eksplisit (Q9). -->
        <h3 class="mt-8 text-body font-normal">Perlu perhatian</h3>
        {#if perhatian.length}
          <ul class="mt-2 grid gap-2">
            {#each perhatian as b (b.id)}
              <li>
                <button class="flex w-full justify-between gap-2 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-3 text-left text-body-sm transition-colors hover:border-rw-border-gray" onclick={() => lompatInvoice(b.isOverdue ? 'overdue' : 'unpaid', b.id)} data-perhatian-item>
                  <span class="flex items-center gap-2">
                    {b.nomor} · tempo {tgl(b.jatuh_tempo)}
                    {#if b.isOverdue}<span class="rounded-rw-badge px-2 py-0.5 text-caption {rwChip(b.status, true)}">overdue</span>{/if}
                  </span>
                  <span>{rupiah(b.sisa)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="mt-2 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-3 text-body-sm text-rw-light-gray" data-all-clear>Semua invoice lunas, tidak ada yang perlu perhatian.</p>
        {/if}

        <h3 class="mt-8 text-body font-normal">Transaksi terbaru</h3>
        {#if ringkasan.recent.length}
          <ul class="mt-2 grid gap-2">
            {#each ringkasan.recent as t (t.id)}
              <li>
                <button class="flex w-full justify-between gap-2 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-3 text-left text-body-sm transition-colors hover:border-rw-border-gray" onclick={() => lompatTransaksi('semua', t.id)} data-recent-item>
                  <span class="flex items-center gap-2">{t.nama_project} · {t.nama_client} <span class="rounded-rw-badge px-2 py-0.5 text-caption {rwChip(t.status)}">{t.status}</span></span>
                  <span>{rupiah(t.total)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="mt-2 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-3 text-body-sm text-rw-light-gray">Belum ada transaksi. Mulai lewat tombol “+ Walk-in” di Transaksi.</p>
        {/if}
      {/if}
    </section>
    {/if}
    {#if view === 'settings'}
    <section class="mt-8">
      <h2 class="text-subheading font-normal">Settings</h2>
      <p class="mt-2 text-body-sm text-graphite">Identitas + rekening untuk kop dokumen. Nilai ini mengisi otomatis kop RAB/Brief dan blok DARI/TRANSFER KE di Invoice baru (invoice lama menyimpan snapshot bank-nya sendiri).</p>
      <!-- Q29: sebut path file logo yang ditunggu kop cetak — ganti logo = taruh file + deploy. -->
      <div class="mt-4 border border-ash bg-bone-white p-4" data-logo-note>
        <p class="text-caption uppercase text-graphite">Logo kop cetak</p>
        <p class="mt-1 text-body-sm">Kop cetak memakai file <code class="bg-canvas px-1 font-mono text-body-sm">public/img/logo-red.png</code> (path URL <code class="bg-canvas px-1 font-mono text-body-sm">img/logo-red.png</code>). Sampai file itu disuplai, kop memakai teks nama studio. Ganti logo = taruh file lalu deploy.</p>
      </div>
      <form class="mt-4 grid gap-4 max-md:grid-cols-1 md:grid-cols-2" onsubmit={simpanSettings}>
        {#each [['nama', 'Nama studio'], ['hp', 'No. HP'], ['email', 'Email'], ['bank', 'Bank'], ['norek', 'No. rekening'], ['atas_nama', 'Atas nama']] as [f, label] (f)}
          <label class="grid gap-1 text-body-sm">{label}<input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" bind:value={setForm[f]} /></label>
        {/each}
        <button class="rounded-pill bg-navy-ink px-6 py-2 text-body-sm text-bone-white justify-self-start md:col-span-2" type="submit">Simpan settings</button>
      </form>
    </section>
    {/if}
  </main>
</div>
