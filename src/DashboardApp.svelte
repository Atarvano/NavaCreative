<script>
  // DashboardApp: shell #54, tabel Transaksi #55 / RAB #56 / Invoice #57,
  // Ringkasan #58, Alat cards + servis lapis-dua + arsip toggle #59.
  import { onMount } from 'svelte';
  import { rupiah, subtotal, grupBaris, urutkan, eventKurang, balikModalBadge, statusKind, rwChip, tgl, hariIniPlus, tglCetak } from './dashboard/lib/format.js';
  import { stashDraft, ambilDraft, hapusDraft, draftAda } from './dashboard/lib/draft.js';
  import { LOGO_PATH, MERAH, kopDokumen as kopDokumenPure, CETAK_CSS as CETAK_CSS_PURE, cetakDokumen, printRab as printRabPure, printInvoice as printInvoicePure, printBrief as printBriefPure } from './dashboard/lib/print.js';
  // Store (ticket 07, ADR-0014): data + actions live in a shared rune module.
  // This component consumes it and owns only UI state. The store exposes ONE
  // reactive `state` object (Svelte 5 makes imported bindings read-only, so a
  // bare `export let` could not be assigned from here). `s` is a local alias,
  // and the `$derived` bindings below keep the markup's bare names working.
  import * as store from './dashboard/lib/store.svelte.js';
  // Nav (ticket 08, ADR-0014): hash-based navigation + the pending-panel bridge.
  // The shell registers its Panel / per-view hooks below; nav never imports them.
  import { NAV, VIEW_KEYS, view as navView, setNavHooks, setPendingPanel, tampilkan, lompatInvoice, lompatTransaksi, go, viewDariHash } from './dashboard/lib/nav.svelte.js';
  import {
    api, load, logout, muatRingkasan, setDraftReaders,
    addAlat as storeAddAlat, arsipkan as storeArsipkan, aktifkan as storeAktifkan,
    muatServis, addServis as storeAddServis,
    simpanPaket as storeSimpanPaket, dariPaket as storeDariPaket,
    simpanRab as storeSimpanRab, statusRab as storeStatusRab, setujui as storeSetujui,
    simpanTransaksi as storeSimpanTransaksi, statusTransaksi as storeStatusTransaksi,
    muatBrief, simpanBrief as storeSimpanBrief,
    terbitkan as storeTerbitkan, muatInvoice, simpanTempo as storeSimpanTempo,
    bayar as storeBayar, voidInvoice as storeVoidInvoice,
    simpanSettings as storeSimpanSettings,
  } from './dashboard/lib/store.svelte.js';
  const s = store.state;
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

  // Store-backed data, aliased to the bare names the markup already uses.
  // (Read-only views of store.state; writes go through store actions below.)
  const me = $derived(s.me);
  const alat = $derived(s.alat);
  const paket = $derived(s.paket);
  const rabs = $derived(s.rabs);
  const transaksi = $derived(s.transaksi);
  const invoices = $derived(s.invoices);
  const settings = $derived(s.settings);
  const ringkasan = $derived(s.ringkasan);
  const error = $derived(s.error);
  const notice = $derived(s.notice);
  const busy = $derived(s.busy);
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

  // --- Redesign 07 (#60, ticket 07): Paket CRUD — add + edit both open in the
  // shared Panel (ADR-0012 amendment). One builder snippet serves both modes;
  // a heavyweight form lives in the Panel, not inline. Expand grup kategori +
  // subtotal stays in the card, and "Buat RAB" (dariPaket) is unchanged.
  let pkMode = $state('add'); // 'add' | 'edit'
  let pkTarget = $state(null); // the paket being edited in 'edit' mode

  // Header fields shared by both modes (seeded from the target when editing).
  let pkNama = $state('');
  let pkDeskripsi = $state('');
  let pkBaris = $state([]);
  // Input baris baru (dipakai add + edit; disalin ke array saat + Baris).
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

  const pkReset = () => {
    pkNama = '';
    pkDeskripsi = '';
    pkBaris = [];
    resetPkInput();
  };

  // + Paket baru: open the Panel in add mode, blank fields.
  function bukaPaketBuilder() {
    pkMode = 'add';
    pkTarget = null;
    pkReset();
    bukaPanel('Paket baru', paketBuilderSnippet);
  }

  // Ubah: open the Panel in edit mode, seeded from a snapshot of the paket's rows
  // (PATCH replaces wholesale, so the form must start from the current rows).
  function bukaEditPaket(p) {
    pkMode = 'edit';
    pkTarget = p;
    pkNama = p.nama;
    pkDeskripsi = p.deskripsi ?? '';
    pkBaris = p.baris.map((b) => ({
      kategori: b.kategori,
      jenis: b.jenis,
      alat_id: b.alat_id ?? null,
      nama: b.nama,
      qty: b.qty,
      satuan: b.satuan,
      harga_satuan: b.harga_satuan,
    }));
    resetPkInput();
    bukaPanel(`Ubah paket: ${p.nama}`, paketBuilderSnippet);
  }

  // + Baris: validasi ringan sisi-UI (kontrak penuh tetap di API, Q12).
  function pkTambahBaris() {
    const namaBaris = pbNama.trim();
    if (!namaBaris) return;
    pkBaris = [
      ...pkBaris,
      {
        kategori: pbKategori || 'PRODUCTION',
        jenis: pbJenis,
        alat_id: null,
        nama: namaBaris,
        qty: Number(pbQty) || 1,
        satuan: pbSatuan,
        harga_satuan: Number(pbHarga) || 0,
      },
    ];
    resetPkInput();
  }

  const pkHapusBaris = (i) => (pkBaris = pkBaris.filter((_, j) => j !== i));

  // ponytail: alias — subtotal defined above; kept for the header/row totals.
  const pkSum = (rows) => subtotal(rows);

  // One submit for both modes: POST when adding, PATCH when editing.
  async function simpanPaket(e) {
    e.preventDefault();
    s.error = '';
    s.notice = '';
    s.busy = true;
    try {
      const editing = pkMode === 'edit' && pkTarget;
      const { res, data } = await api(editing ? `/api/paket/${pkTarget.id}` : '/api/paket', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({ nama: pkNama, deskripsi: pkDeskripsi, baris: pkBaris }),
      });
      if (!res.ok) {
        s.error = data.error ?? (editing ? 'Gagal mengubah paket.' : 'Gagal menyimpan paket.');
        return;
      }
      s.notice = editing
        ? `${data.nama ?? pkNama} diubah. RAB/Transaksi lama tidak ikut berubah.`
        : `${data.nama ?? pkNama} ditambahkan.`;
      pkReset();
      pkTarget = null;
      tutupPanel();
      await load();
    } finally {
      s.busy = false;
    }
  }

  // Studio identity for document headers (Q23, auto-fill from settings).
  // settings / rabs / transaksi / invoices now live in the store (ticket 07).

  // RAB (#43): list + builder (header + rows, from paket or blank).
  // openTransaksiId / openRabId stay here (UI state); the LISTS are in the store.

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

  // rupiah / subtotal / grupBaris / urutkan removed: imported from ./dashboard/lib/format.js

  // LOGO_PATH / MERAH / tglCetak / kopDokumen / CETAK_CSS / cetakDokumen removed:
  // imported from ./dashboard/lib/print.js (printed output stays byte-identical).

  // api() and load() removed: both live in the store (ticket 07, ADR-0014);
  // imported above. The store's api() is the same fetch wrapper with the 401
  // draft-rescue branch, which reads the builders' draft readers registered
  // in onMount below.

  onMount(async () => {
    // Register the builder draft readers with the store's HTTP client (ticket 07).
    // The 401 branch calls these to snapshot a half-typed walk-in / RAB / Brief
    // before redirecting to login (Q36). They live here because the builder form
    // fields are UI state of this component, not of the store.
    setDraftReaders({
      tx: () => txDraft(),
      rab: () => rbDraft(),
      brief: () => (briefOpenId ? { transaksi_id: briefOpenId, form: brForm } : null),
    });
    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.status === 401) {
        location.href = 'login.html';
        return;
      }
      s.me = (await meRes.json()).username;
      await load();
      // Q36: draft terselamatkan saat 401 dibuka kembali + notice.
      const drafTx = ambilDraft('transaksi');
      if (draftAda(drafTx)) {
        txMuatDraft(drafTx);
        s.notice = 'Draft walk-in terselamatkan dari sesi sebelumnya.';
      }
      const drafBrief = ambilDraft('brief');
      if (drafBrief) {
        s.notice = draftAda(drafTx)
          ? 'Draft walk-in + Brief terselamatkan dari sesi sebelumnya — buka Rincian barisnya untuk lanjut Brief.'
          : 'Draft Brief terselamatkan dari sesi sebelumnya — buka Rincian barisnya untuk lanjut.';
      }
      const drafRab = ambilDraft('rab');
      if (draftAda(drafRab)) {
        rbMuatDraft(drafRab);
        // Draft is seeded into state; the Panel opens from “+ RAB baru” (ticket 05).
        s.notice = 'Draft RAB terselamatkan dari sesi sebelumnya, buka “+ RAB baru” untuk lanjut.';
      }
      await tampilkan(viewDariHash() ?? 'ringkasan');
    } catch {
      s.error = 'Tidak bisa menghubungi server.';
    }
  });

  async function addAlat(e) {
    e.preventDefault();
    s.error = '';
    s.notice = '';
    s.busy = true;
    try {
      await storeAddAlat({
        nama,
        harga_beli: Number(hargaBeli),
        tarif_event: Number(tarifEvent),
      });
      if (!error) {
        nama = '';
        hargaBeli = '';
        tarifEvent = '';
        alatBuilderOpen = false;
      }
    } finally {
      s.busy = false;
    }
  }

  async function arsipkan(a) {
    if (!confirm(`Arsipkan ${a.nama}? Kartu pindah ke daftar arsip (default tersembunyi).\n\nRiwayat servis, modal, dan pendapatan tetap tersimpan — tidak ada yang dihapus.\n\nAktifkan lagi kapan saja lewat toggle “Tampilkan arsip”.`)) return;
    await storeArsipkan(a);
  }

  async function aktifkan(a) {
    await storeAktifkan(a);
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
    servisRows = await muatServis(a.id);
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
    s.error = '';
    const data = await storeAddServis(a, {
      tanggal: svTanggal,
      keterangan: svKeterangan,
      biaya: Number(svBiaya),
    });
    if (!data) return;
    servisRows = [...servisRows, data];
    servisFormId = null;
  }

  // logout() removed: lives in the store (ticket 07); the markup calls it directly.

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
      s.notice = 'Draft RAB sebelumnya dibuka kembali.';
    }
    bukaPanel('RAB baru', rabBuilderSnippet);
  }

  // Buat RAB dari Paket (Q19/Q21): salin baris → auto-pindah #/rab + notice.
  // Builder kosong langsung salin; builder isi confirm-timpa dulu.
  async function dariPaket(p) {
    s.error = '';
    if (draftAda(rbDraft()) && !confirm('Timpa draft RAB yang sedang diisi dengan baris dari paket ini?')) return;
    const { res, data } = await api(`/api/paket/${p.id}/ke-rab`);
    if (!res.ok) {
      s.error = data.error ?? 'Gagal menyalin paket.';
      return;
    }
    rbProject = data.nama_project;
    rbBaris = data.baris.map((b) => ({ ...b }));
    hapusDraft('rab');
    s.notice = `Baris ${p.nama} disalin, lengkapi client lalu simpan.`;
    // Open the Panel AFTER the view switch: go('rab') fires hashchange ->
    // tampilkan() -> tutupPanel(), so a direct bukaPanel() here would be closed
    // again immediately. pendingPanel is consumed by tampilkan() once on #/rab;
    // when already on #/rab (re-copy), the hash does not change, so open directly.
    if (view === 'rab') bukaRabBuilder();
    else {
      setPendingPanel({ view: 'rab', judul: 'RAB baru', isi: rabBuilderSnippet });
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
    s.error = '';
    s.notice = '';
    s.busy = true;
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
        s.error = data.error ?? 'Gagal menyimpan RAB.';
        return;
      }
      s.notice = `${data.nomor} tersimpan sebagai draft.`;
      resetBuilder();
      hapusDraft('rab');
      tutupPanel();
      await load();
    } finally {
      s.busy = false;
    }
  }

  async function statusRab(r, status) {
    const { res, data } = await api(`/api/rab/${r.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) s.error = data.error ?? 'Gagal ubah status.';
    else {
      s.notice = `${r.nomor} → ${status}.`;
      await load();
    }
  }

  // Setujui tanpa confirm (Q45): 1 klik → Transaksi, auto-pindah #/transaksi
  // + notice. Void + koreksi-minus di Transaksi tetap jadi pengaman.
  async function setujui(r) {
    const { res, data } = await api(`/api/rab/${r.id}/setujui`, { method: 'POST' });
    if (!res.ok) s.error = data.error ?? 'Gagal menyetujui.';
    else {
      s.notice = `${r.nomor} disetujui → Transaksi #${data.transaksi_id}.`;
      await load();
      go('transaksi');
    }
  }

  // printRab removed: imported from ./dashboard/lib/print.js.
  function printRab(r) {
    printRabPure(r, settings, rabGrup);
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
  // stashDraft / ambilDraft / hapusDraft / draftAda removed: imported from
  // ./dashboard/lib/draft.js (keys + snapshot shapes unchanged).
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
  // draftAda removed: imported from ./dashboard/lib/draft.js.

  // Walk-in (ticket 04): the builder now opens in the shared Panel instead of
  // pushing the table down (ADR-0012 amendment), mirroring the Brief. The draft
  // restore path is unchanged; opening only re-seeds the fields from localStorage
  // when a stashed draft exists. Panel owns closing (Esc / outside click / button).
  function bukaWalkin() {
    if (draftAda(ambilDraft('transaksi'))) {
      txMuatDraft(ambilDraft('transaksi'));
      s.notice = 'Draft walk-in sebelumnya dibuka kembali.';
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
      s.notice = 'Draft Brief sebelumnya dibuka kembali.';
    }
    bukaPanel(`Brief — ${t.nama_project}`, briefFormSnippet);
  }

  async function simpanTransaksi(e) {
    e.preventDefault();
    s.error = '';
    s.notice = '';
    s.busy = true;
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
        s.error = data.error ?? 'Gagal menyimpan transaksi.';
        return;
      }
      s.notice = data.bentrok?.length
        ? `Tersimpan — bentrok dengan ${data.bentrok.map((b) => b.nama_project).join(', ')}.`
        : 'Transaksi walk-in tersimpan.';
      hapusDraft('transaksi');
      txMuatDraft({});
      tutupPanel();
      await load();
    } finally {
      s.busy = false;
    }
  }

  async function statusTransaksi(t, status) {
    const { res, data } = await api(`/api/transaksi/${t.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (!res.ok) s.error = data.error ?? 'Gagal ubah status.';
    else {
      s.notice = data.bentrok?.length ? `Bentrok: ${data.bentrok.map((b) => b.nama_project).join(', ')}.` : `${t.nama_project} → ${status}.`;
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
  // invoices now lives in the store (ticket 07).

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
  // Invoice whose bayar/tempo Panel is open (ticket 06). No-arg form snippets
  // read this, matching briefTx: a snippet passed to the Panel as a value must
  // not be pre-invoked with an argument (that yields a fragment, not a snippet).
  let invForm = $state(null);

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
  // hariIniPlus removed: imported from ./dashboard/lib/format.js.
  async function terbitkan(t) {
    const jt = hariIniPlus(7);
    const { res, data } = await api(`/api/transaksi/${t.id}/invoice`, {
      method: 'POST',
      body: JSON.stringify({ jatuh_tempo: jt }),
    });
    if (!res.ok) s.error = data.error ?? 'Gagal menerbitkan invoice.';
    else {
      s.notice = `${data.nomor} terbit (tempo ${tgl(data.jatuh_tempo)}). Baris transaksi dikunci.`;
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

  // Bayar cepat primer (Q17): satu klik dari baris → buka Panel bayar, tak
  // perlu Rincian dulu. Rincian tetap riwayat-only (ticket 06).
  function bayarCepat(i) {
    byJumlah = i.sisa > 0 ? String(i.sisa) : '';
    byTanggal = hariIniPlus(0);
    invForm = i;
    bukaPanel(`Catat bayar ${i.nomor}`, bayarFormSnippet);
  }

  // Ubah jatuh tempo dari rincian → Panel (ticket 06). Overdue turunan tempo.
  function bukaTempo(i) {
    invTempo = i.jatuh_tempo;
    invForm = i;
    bukaPanel(`Ubah tempo ${i.nomor}`, tempoFormSnippet);
  }

  // Ubah jatuh tempo via PATCH (redesign #57): full invoice balik → sync
  // list + detail. Overdue ikut berubah (turunan dari tempo).
  async function simpanTempo(i, e) {
    e.preventDefault();
    s.error = '';
    s.busy = true;
    try {
      const { res, data } = await api(`/api/invoice/${i.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ jatuh_tempo: invTempo }),
      });
      if (!res.ok) {
        s.error = data.error ?? 'Gagal mengubah jatuh tempo.';
        return;
      }
      s.notice = `Tempo ${i.nomor} diubah ke ${tgl(data.jatuh_tempo)}.`;
      invDetail = invDetail ? { ...invDetail, ...data } : invDetail;
      tutupPanel();
      await load();
    } finally {
      s.busy = false;
    }
  }

  async function bayar(i, e) {
    e.preventDefault();
    s.error = '';
    s.busy = true;
    try {
      const { res, data } = await api(`/api/invoice/${i.id}/bayar`, {
        method: 'POST',
        body: JSON.stringify({ tanggal: byTanggal, jumlah: Number(byJumlah), metode: byMetode }),
      });
      if (!res.ok) {
        s.error = data.error ?? 'Gagal mencatat pembayaran.';
        return;
      }
      s.notice = `Terbayar ${rupiah(data.dibayar)}, sisa ${rupiah(data.sisa)}.`;
      byJumlah = '';
      invDetail = invDetail ? { ...data, transaksi: invDetail.transaksi, baris: invDetail.baris ?? [] } : invDetail;
      tutupPanel();
      await load();
    } finally {
      s.busy = false;
    }
  }

  async function voidInvoice(i) {
    if (!confirm(`Batalkan ${i.nomor}? Riwayat tetap tersimpan.`)) return;
    const { res, data } = await api(`/api/invoice/${i.id}/batal`, { method: 'POST' });
    if (!res.ok) s.error = data.error ?? 'Gagal membatalkan.';
    else {
      s.notice = `${i.nomor} dibatalkan.`;
      await load();
    }
  }

  // Print Invoice removed: delegates to ./dashboard/lib/print.js (byte-identical).
  function printInvoice() {
    printInvoicePure(invDetail, settings);
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
    if (!res.ok) s.error = data.error ?? 'Gagal menyimpan brief.';
    else {
      brief = data.brief;
      s.notice = `Brief ${t.nama_project} tersimpan.`;
      hapusDraft('brief');
      tutupPanel();
    }
  }

  // Print Brief removed: delegates to ./dashboard/lib/print.js (byte-identical).
  function printBrief(t) {
    printBriefPure(t, brief, settings);
  }

  // --- Shell #54 (ADR-0012): sidebar + drawer + hash nav + banner ---
  // `view` now lives in nav.svelte.js (ticket 08); aliased for the markup.
  const view = $derived(navView.current);
  const setForm = $state({});
  // Nav map lives in nav.svelte.js (keys + labels); the shell supplies icons.
  // Icons (antislop R-04): dashboard = overview, arrow-left-right = money in/out,
  // file-text = budget document (RAB), receipt = bill (Invoice), package =
  // bundled paket, wrench = equipment (Alat), settings = Settings.
  const NAV_ICONS = {
    ringkasan: LayoutDashboard,
    transaksi: ArrowLeftRight,
    rab: FileText,
    invoice: Receipt,
    paket: Package,
    alat: Wrench,
  };

  // Lompat Ringkasan + cross-view Panel opening now live in nav.svelte.js
  // (ticket 08) as imperative one-shots with a documented ordering contract.

  // Register the shell's hooks with nav: the Panel, the view openers, and the
  // per-view UI reset. Nav calls these; it never imports them (ADR-0014).
  setNavHooks({
    tutupPanel: () => tutupPanel(),
    bukaPanel: (judul, isi) => bukaPanel(judul, isi),
    bukaInvoice: (inv) => bukaInvoice(inv),
    bukaTransaksi: (t) => bukaTransaksi(t),
    onSettingsEnter: () => {
      // Copy ALL settings keys (not a hardcoded subset) so the form can never
      // silently drop a field the API returns; setForm is a const object, so
      // mutate it in place rather than reassigning the binding.
      for (const k of Object.keys(setForm)) delete setForm[k];
      Object.assign(setForm, settings);
    },
    resetViewUi: (v) => {
      // Q25: expand reset saat pindah view (lompat = pengecualian, ditangani nav).
      if (v !== 'transaksi') {
        openTransaksiId = null;
        briefOpenId = null;
      }
      if (v !== 'rab') openRabId = null;
      if (v !== 'invoice') openInvoiceId = null;
      if (v !== 'paket') {
        openPaketId = null;
        pkTarget = null;
      }
      if (v !== 'alat') {
        openId = null;
        servisFormId = null;
      }
    },
  });

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

  // lompatInvoice / lompatTransaksi / go / viewDariHash removed: they live in
  // nav.svelte.js (ticket 08). These thin local adapters supply the view-local
  // filter setters + open-clearing helpers nav needs (same shape as before).
  const navDeps = {
    setInvFilter: (f) => {
      invSearch = '';
      invStatusFilter = f;
    },
    setTxFilter: (f) => {
      txSearch = '';
      txStatusFilter = f;
    },
    clearInvoiceOpen: () => (openInvoiceId = null),
    clearTransaksiOpen: () => {
      openTransaksiId = null;
      briefOpenId = null;
    },
  };
  const lompatKeInvoice = (filter = 'semua', expandId = null) => lompatInvoice(filter, expandId, navDeps);
  const lompatKeTransaksi = (filter = 'semua', expandId = null) => lompatTransaksi(filter, expandId, navDeps);

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
    // Same for the Invoice bayar/tempo target: cleared so a dismissed Panel never
    // re-renders a stale target form (ticket 06).
    invForm = null;
    // And the Paket builder target (ticket 07).
    pkTarget = null;
    pkMode = 'add';
  }
  // Backdrop click: the dialog's own box is the sheet, so a click whose target
  // is the dialog element itself landed outside the content and should close.
  function panelKlikLuar(e) {
    if (e.target === panelEl) tutupPanel();
  }

  // Banner sticky (Q37): notice auto-hides after 6s, error stays until dismissed.
  $effect(() => {
    if (!notice) return;
    const t = setTimeout(() => (s.notice = ''), 6000);
    return () => clearTimeout(t);
  });

  // statusKind / rwChip removed: imported from ./dashboard/lib/format.js.

  async function simpanSettings(e) {
    e.preventDefault();
    s.error = '';
    const { res, data } = await api('/api/settings', { method: 'PUT', body: JSON.stringify(setForm) });
    if (!res.ok) s.error = data.error ?? 'Gagal menyimpan settings.';
    else {
      s.settings = data.settings;
      s.notice = 'Settings tersimpan. Dokumen berikutnya pakai identitas baru.';
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

<!-- Payment form body — rendered inside the Panel by bukaBayar() (ticket 06).
     No-arg snippet reading `invForm` state, matching briefFormSnippet: a snippet
     passed to the Panel as a value must not be pre-invoked with an argument.
     Field set, bindings and the minus-is-correction rule are unchanged from the
     previous inline form; only the container moved (ADR-0012 Detail Pattern).
     The DP/Cicilan/Pelunasan label is derived server-side and shown in the
     rincian's payment history, so it stays visible without the form. -->
{#snippet bayarFormSnippet()}
  {#if invForm}
  <form class="grid gap-4" onsubmit={(e) => bayar(invForm, e)} data-inv-bayar-form>
    <p class="text-body-sm text-rw-light-gray">
      {invForm.nomor} · dibayar {rupiah(invForm.dibayar)} · sisa <span class={invForm.overdue ? 'text-rw-danger-text' : ''}>{rupiah(invForm.sisa)}</span>
    </p>
    <label class="grid gap-1 text-body-sm">Tanggal<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="date" required bind:value={byTanggal} /></label>
    <label class="grid gap-1 text-body-sm">Jumlah (Rp, minus = koreksi)<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="number" step="1" required bind:value={byJumlah} /></label>
    <label class="grid gap-1 text-body-sm">Metode<select class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={byMetode}><option value="transfer">transfer</option><option value="cash">cash</option></select></label>
    <button class="rounded-rw-control bg-rw-accent px-6 py-2.5 text-body-sm text-rw-white disabled:opacity-50 max-md:py-3 max-md:w-full" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Catat bayar'}</button>
  </form>
  {/if}
{/snippet}

<!-- Tempo form body — rendered inside the Panel by bukaTempo() (ticket 06).
     No-arg snippet reading `invForm`; PATCH body unchanged; overdue is derived
     from jatuh_tempo, so it follows. -->
{#snippet tempoFormSnippet()}
  {#if invForm}
  <form class="grid gap-4" onsubmit={(e) => simpanTempo(invForm, e)} data-inv-tempo-form>
    <p class="text-body-sm text-rw-light-gray">{invForm.nomor} · jatuh tempo sekarang {tgl(invForm.jatuh_tempo)}</p>
    <label class="grid gap-1 text-body-sm">Jatuh tempo<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="date" required bind:value={invTempo} /></label>
    <button class="rounded-rw-control border border-rw-border-gray/40 px-6 py-2.5 text-body-sm max-md:py-3 max-md:w-full" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan tempo'}</button>
  </form>
  {/if}
{/snippet}

<!-- Paket builder body — rendered inside the Panel by bukaPaketBuilder()/
     bukaEditPaket() (ticket 07). One no-arg snippet serves add + edit (mode is
     `pkMode`), matching briefFormSnippet/invForm: a snippet passed to the Panel
     as a value must not be pre-invoked with an argument. Each item row is a
     labelled sub-card (two field rows), not a seven-column single line, so no
     field relies on a placeholder as its label. -->
{#snippet paketBuilderSnippet()}
  <form class="grid gap-5" onsubmit={simpanPaket} data-paket-form data-pk-mode={pkMode}>
    {#if pkMode === 'edit'}
      <p class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm text-rw-light-gray">
        Mengubah paket tidak mengubah RAB/Transaksi lama. Dokumen itu punya snapshot sendiri.
      </p>
    {/if}
    <div class="grid gap-4 max-md:grid-cols-1 md:grid-cols-2">
      <label class="grid gap-1 text-body-sm">Nama paket<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" name="nama" required bind:value={pkNama} placeholder="Paket Dokumentasi" /></label>
      <label class="grid gap-1 text-body-sm">Deskripsi (opsional)<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={pkDeskripsi} placeholder="Live streaming 1 kamera" /></label>
    </div>

    <!-- Existing rows: labelled sub-cards (ticket 07). -->
    {#if pkBaris.length}
      <div class="grid gap-3">
        {#each pkBaris as b, i (i)}
          <div class="rounded-rw-card border border-rw-border-gray/40 bg-rw-ground p-3" data-pk-baris>
            <div class="flex items-start justify-between gap-3">
              <p class="text-body-sm font-normal">{b.nama}</p>
              <button type="button" class="shrink-0 text-body-sm text-rw-danger-text underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" aria-label={`Hapus baris ${b.nama}`} onclick={() => pkHapusBaris(i)}>hapus</button>
            </div>
            <dl class="mt-2 grid grid-cols-2 gap-2 text-caption text-rw-light-gray sm:grid-cols-4">
              <div><dt class="uppercase tracking-wide">Jenis</dt><dd class="text-body-sm text-rw-off-white">{b.jenis}</dd></div>
              <div><dt class="uppercase tracking-wide">Kategori</dt><dd class="text-body-sm text-rw-off-white">{b.kategori}</dd></div>
              <div><dt class="uppercase tracking-wide">Qty</dt><dd class="text-body-sm text-rw-off-white">{b.qty} {b.satuan}</dd></div>
              <div class="text-right"><dt class="uppercase tracking-wide">Rate</dt><dd class="text-body-sm tabular-nums text-rw-off-white">{rupiah(b.harga_satuan)}</dd></div>
            </dl>
          </div>
        {/each}
        <p class="text-body-sm">Total {rupiah(pkSum(pkBaris))}</p>
      </div>
    {:else}
      <p class="text-body-sm text-rw-light-gray">Belum ada baris, tambah item lewat sub-kartu di bawah.</p>
    {/if}

    <!-- Add-row sub-card: labelled fields in two rows (replaces the 7-column line). -->
    <fieldset class="grid gap-3 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-3">
      <legend class="px-1 text-caption uppercase tracking-wide text-rw-light-gray">+ Item baru</legend>
      <label class="grid gap-1 text-body-sm">Item<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={pbNama} placeholder="SONY NXR-100" data-pk-item /></label>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label class="grid gap-1 text-body-sm">Jenis<select class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={pbJenis} data-pk-jenis><option value="alat">alat</option><option value="jasa">jasa</option><option value="biaya">biaya</option></select></label>
        <label class="grid gap-1 text-body-sm">Kategori<select class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={pbKategori} data-pk-kategori>{#each KATEGORI as k (k)}<option value={k}>{k}</option>{/each}</select></label>
        <label class="grid gap-1 text-body-sm">Qty<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="number" min="1" step="1" bind:value={pbQty} data-pk-qty /></label>
        <label class="grid gap-1 text-body-sm">Satuan<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={pbSatuan} placeholder="Unit" data-pk-satuan /></label>
      </div>
      <label class="grid gap-1 text-body-sm">Rate (Rp)<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="number" min="0" step="1" bind:value={pbHarga} data-pk-harga /></label>
      <button type="button" class="rounded-rw-control border border-rw-border-gray/40 px-5 py-2.5 text-body-sm max-md:py-3 max-md:w-full" onclick={pkTambahBaris} data-pk-tambah-baris>+ Tambah baris</button>
    </fieldset>

    <button class="rounded-rw-control bg-rw-accent px-6 py-2.5 text-body-sm text-rw-white disabled:opacity-50 max-md:py-3 max-md:w-full" type="submit" disabled={busy}>
      {busy ? 'Menyimpan…' : pkMode === 'edit' ? 'Simpan perubahan' : 'Simpan paket'}
    </button>
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
  <tr class="border-b border-rw-border-gray/40 align-top scroll-mt-24 {openInvoiceId === i.id ? 'bg-rw-darker' : ''}">
    <td class="px-3 py-2 whitespace-nowrap max-md:py-3">{i.nomor}</td>
    <td class="px-3 py-2 max-md:py-3"><p class="text-body font-normal">{invClient(i) || '-'}</p></td>
    <td class="px-3 py-2 text-right tabular-nums whitespace-nowrap max-md:py-3">{rupiah(i.total)}</td>
    <td class="px-3 py-2 text-right tabular-nums whitespace-nowrap max-md:py-3">{rupiah(i.dibayar)}</td>
    <!-- Sisa bold saat overdue (Q17) biar yang ditagih paling menonjol. -->
    <td class="px-3 py-2 text-right tabular-nums whitespace-nowrap max-md:py-3 {i.overdue ? 'font-medium text-rw-danger-text' : ''}">{rupiah(i.sisa)}</td>
    <td class="px-3 py-2 whitespace-nowrap max-md:py-3">{tgl(i.jatuh_tempo)}</td>
    <td class="px-3 py-2 max-md:py-3"><span class="rounded-rw-badge px-2 py-0.5 text-caption {rwChip(i.status, i.overdue)}">{i.status}{i.overdue ? ' · overdue' : ''}</span></td>
    <td class="px-3 py-2 max-md:py-3">
      <div class="flex flex-wrap items-center justify-end gap-3">
        {#if i.status !== 'paid' && i.status !== 'batal'}
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => bayarCepat(i)} data-inv-bayar>Bayar</button>
        {/if}
        <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => bukaInvoice(i)}>{openInvoiceId === i.id ? 'Tutup' : 'Rincian'}</button>
      </div>
    </td>
  </tr>
  {#if openInvoiceId === i.id}
  <tr class="bg-rw-darker"><td colspan="8" class="px-3 py-4">
    {#if invDetail}
      <!-- Riwayat bayar ringan (ticket 06): read-only, tetap terlihat. Label
           DP/Cicilan/Pelunasan datang dari server (derived), tampil apa adanya.
           Form bayar + ubah tempo pindah ke Panel (tombol di bawah). -->
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="text-caption uppercase text-rw-light-gray">Riwayat pembayaran</p>
        <p class="text-body-sm text-rw-light-gray">dibayar {rupiah(i.dibayar)} · sisa {rupiah(i.sisa)}</p>
      </div>
      {#if invDetail.bayar.length}
        <ul class="mt-2 grid gap-1 text-body-sm">
          {#each invDetail.bayar as p (p.id)}
            <li class="flex justify-between gap-2"><span>{tgl(p.tanggal)} ({p.label}) · {p.metode}</span><span class="tabular-nums">{rupiah(p.jumlah)}</span></li>
          {/each}
        </ul>
      {:else}
        <p class="mt-2 text-body-sm text-rw-light-gray">Belum ada pembayaran.</p>
      {/if}

      {#if i.status === 'batal'}
        <p class="mt-3 text-body-sm text-rw-light-gray">Invoice dibatalkan, pembayaran & tempo terkunci, riwayat tetap tersimpan.</p>
      {/if}

      <div class="mt-3 flex flex-wrap gap-4 text-body-sm">
        {#if i.status !== 'paid' && i.status !== 'batal'}
          <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => bayarCepat(i)} data-inv-bayar-detail>Catat bayar</button>
        {/if}
        {#if i.status !== 'batal'}
          <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => bukaTempo(i)} data-inv-tempo-toggle>Ubah tempo</button>
        {/if}
        <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={printInvoice}>Cetak</button>
        {#if i.status !== 'paid' && i.status !== 'batal'}
          <button class="underline text-rw-danger-text max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => voidInvoice(i)}>Batalkan</button>
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
  <li class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 {a.is_active ? '' : 'opacity-75'}" data-alat-card data-alat-id={a.id}>
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <p class="text-body font-normal">
        {a.nama}
        {#if !a.is_active}<span class="ml-2 rounded-rw-badge bg-rw-off-white/10 px-2 py-0.5 text-caption uppercase text-rw-light-gray">Arsip</span>{/if}
      </p>
      <!-- Badge Balik modal 3-warna: hijau / kuning ≤3 event / merah. -->
      <span class="rounded-rw-badge px-2 py-0.5 text-caption {badge.cls}" data-balik-modal-badge>{badge.text}</span>
    </div>
    <p class="mt-2 text-body-sm text-rw-light-gray">
      Modal <span class="tabular-nums">{rupiah(a.modal)}</span> · Pendapatan <span class="tabular-nums">{rupiah(a.pendapatan)}</span> · Tarif <span class="tabular-nums">{rupiah(a.tarif_event)}</span>/event
    </p>
    <div class="mt-3 flex flex-wrap gap-4 text-body-sm">
      <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => toggle(a)} data-alat-servis-toggle>
        {openId === a.id ? 'Tutup servis' : 'Servis & riwayat'}
      </button>
      {#if a.is_active}
        <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => arsipkan(a)} data-alat-arsip>Arsipkan</button>
      {:else}
        <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => aktifkan(a)} data-alat-aktifkan>Aktifkan kembali</button>
      {/if}
    </div>
    {#if openId === a.id}
      <div class="mt-4 border-t border-rw-border-gray/40 pt-4" data-alat-servis>
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-caption uppercase text-rw-light-gray">Riwayat servis: menambah Modal</p>
          <!-- Form catat = lapis-dua di dalam expand (Q18). -->
          <button class="underline text-body-sm max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => bukaServisForm(a)} data-servis-form-toggle>
            {servisFormId === a.id ? 'Tutup form' : '+ Catat servis'}
          </button>
        </div>
        {#if !servisRows.length}
          <p class="mt-2 text-body-sm text-rw-light-gray">Belum ada servis tercatat.</p>
        {:else}
          <ul class="mt-2 grid gap-2 text-body-sm">
            {#each servisRows as s (s.id)}
              <li class="flex justify-between gap-2"><span>{tgl(s.tanggal)}: {s.keterangan || '(tanpa keterangan)'}</span><span class="tabular-nums">{rupiah(s.biaya)}</span></li>
            {/each}
          </ul>
        {/if}
        {#if servisFormId === a.id}
          <form class="mt-4 grid gap-3 border-t border-rw-border-gray/40 pt-4 max-md:grid-cols-1 md:grid-cols-[1fr_2fr_1fr_auto] md:items-end" onsubmit={(e) => addServis(a, e)} data-servis-form>
            <label class="grid gap-1 text-body-sm">
              Tanggal
              <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="date" required bind:value={svTanggal} />
            </label>
            <label class="grid gap-1 text-body-sm">
              Keterangan
              <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={svKeterangan} placeholder="Ganti kabel" />
            </label>
            <label class="grid gap-1 text-body-sm">
              Biaya (Rp)
              <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" type="number" min="0" step="1" required bind:value={svBiaya} />
            </label>
            <button class="rounded-rw-control bg-rw-accent px-5 py-2.5 text-body-sm text-rw-white max-md:py-3 max-md:w-full" type="submit">Catat</button>
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
      {#each items as [v, label] (v)}
        {@render navItem(v, label, NAV_ICONS[v])}
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
      <button class="shrink-0 text-current underline" aria-label="Tutup notifikasi" onclick={() => { s.error = ''; s.notice = ''; }}>Tutup</button>
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
        <button class="rounded-rw-control bg-rw-accent px-5 py-2.5 text-body-sm text-rw-white max-md:py-3" onclick={bukaAlatBuilder} data-alat-toggle>
          {alatBuilderOpen ? 'Tutup' : '+ Alat baru'}
        </button>
      </div>

      {#if alatBuilderOpen}
      <form class="mt-4 grid gap-4 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 max-md:grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end" onsubmit={addAlat} data-alat-form>
        <label class="grid gap-1 text-body-sm">
          Nama
          <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" name="nama" required bind:value={nama} placeholder="Sony NXR-100" />
        </label>
        <label class="grid gap-1 text-body-sm">
          Harga beli (Rp)
          <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" name="harga_beli" type="number" min="0" step="1" required bind:value={hargaBeli} placeholder="10000000" />
        </label>
        <label class="grid gap-1 text-body-sm">
          Tarif/event (Rp)
          <input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" name="tarif_event" type="number" min="0" step="1" required bind:value={tarifEvent} placeholder="350000" />
        </label>
        <button class="rounded-rw-control bg-rw-accent px-6 py-2.5 text-body-sm text-rw-white disabled:opacity-50 max-md:py-3 max-md:w-full" type="submit" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Tambah'}
        </button>
      </form>
      {/if}

      {#if !alat.length}
        <!-- Empty state: satu baris + CTA (Q34). -->
        <p class="mt-4 text-body-sm text-rw-light-gray">Belum ada alat. Tambahkan lewat tombol “+ Alat baru” di atas.</p>
      {:else if !alatAktif.length}
        <p class="mt-4 text-body-sm text-rw-light-gray">Semua alat terarsip. <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => (showArsip = true)} data-arsip-toggle>Tampilkan arsip</button></p>
      {:else}
        <ul class="mt-4 grid gap-4">
          {#each alatAktif as a (a.id)}
            {@render alatCard(a)}
          {/each}
        </ul>
      {/if}

      {#if alatArsip.length}
        <!-- Arsip: default-sembunyi (Q27), toggle sesi; tanpa hapus fisik. -->
        <div class="mt-8 border-t border-rw-border-gray/40 pt-4">
          <button class="text-body-sm underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => (showArsip = !showArsip)} data-arsip-toggle>
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
        <button class="rounded-rw-control bg-rw-accent px-5 py-2.5 text-body-sm text-rw-white max-md:py-3" onclick={bukaPaketBuilder} data-paket-toggle>
          + Paket baru
        </button>
      </div>

      {#if !paket.length}
        <!-- Empty state: satu baris + CTA (Q34). -->
        <p class="mt-4 text-body-sm text-rw-light-gray">Belum ada paket. Mulai lewat tombol “+ Paket baru” di atas.</p>
      {:else}
        <ul class="mt-4 grid gap-4">
          {#each paket as p (p.id)}
            <li class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4" data-paket-card data-paket-id={p.id}>
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <p class="text-body font-normal">{p.nama}</p>
                <p class="text-body-sm tabular-nums">{rupiah(p.total)}</p>
              </div>
              {#if p.deskripsi}<p class="mt-1 text-caption text-rw-light-gray">{p.deskripsi}</p>{/if}
              <div class="mt-2 flex flex-wrap gap-4 text-body-sm">
                <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => (openPaketId = openPaketId === p.id ? null : p.id)}>
                  {openPaketId === p.id ? 'Tutup rincian' : `Lihat ${p.baris.length} baris`}
                </button>
                <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => bukaEditPaket(p)}>Ubah</button>
                <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => dariPaket(p)}>Buat RAB</button>
              </div>
              {#if openPaketId === p.id}
                <div class="mt-3 border-t border-rw-border-gray/40 pt-3">
                  {#each paketGrup(p) as g (g.kategori)}
                    <p class="mt-2 text-caption uppercase text-rw-light-gray">{g.kategori}: subtotal {rupiah(g.subtotal)}</p>
                    <ul class="grid gap-1 text-body-sm">
                      {#each g.baris as b (b.id)}
                        <li class="flex justify-between gap-2">
                          <span>{b.nama} × {b.qty} {b.satuan} <span class="text-rw-light-gray">[{b.jenis}]</span></span>
                          <span class="tabular-nums">{rupiah(b.qty * b.harga_satuan)}</span>
                        </li>
                      {/each}
                    </ul>
                  {/each}
                  <p class="mt-2 text-body-sm font-normal">Total {rupiah(p.total)}</p>
                </div>
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
        <p class="mt-4 text-body-sm text-rw-light-gray">Belum ada invoice. Terbitkan dari Transaksi lewat tombol “Terbitkan invoice”.</p>
      {:else}
      <div class="mt-4 flex flex-wrap gap-3">
        <input class="min-w-40 flex-1 rounded-rw-control border border-rw-border-gray/40 bg-rw-charcoal px-3 py-2 text-body-sm placeholder:text-rw-light-gray max-md:py-3" placeholder="Cari nomor / client" bind:value={invSearch} data-inv-search />
        <select class="rounded-rw-control border border-rw-border-gray/40 bg-rw-charcoal px-3 py-2 text-body-sm max-md:py-3" bind:value={invStatusFilter} data-inv-status>
          <option value="semua">semua status</option>
          {#each INV_STATUSES as s (s)}<option value={s}>{s}</option>{/each}
          <option value="overdue">overdue</option>
        </select>
      </div>

      {#if !invFiltered.length}
        <!-- Filter-miss beda dari empty: tawarkan reset (Q34). -->
        <p class="mt-4 text-body-sm text-rw-light-gray">Tidak ada yang cocok dengan pencarian/filter. <button class="underline" onclick={() => { invSearch = ''; invStatusFilter = 'semua'; }}>Reset</button></p>
      {:else}
      <!-- Rail table (ticket 06): dense on desktop, comfortable on mobile, money
           columns right-aligned with tabular-nums. Same pattern as Transaksi/RAB. -->
      <div class="mt-4 overflow-x-auto rounded-rw-card border border-rw-border-gray/40">
        <table class="w-full min-w-[720px] border-collapse text-body-sm">
          <thead class="bg-rw-charcoal md:sticky md:top-0">
            <tr class="border-b border-rw-border-gray/40 text-left text-rw-light-gray">
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
            onclick={() => lompatKeInvoice()}
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
            <button class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 text-left transition-colors hover:border-rw-border-gray" onclick={() => lompatKeInvoice('unpaid')} data-card-piutang>
              <p class="text-caption uppercase tracking-wide text-rw-light-gray">Outstanding</p>
              <p class="mt-2 text-subheading font-normal">{rupiah(ringkasan.piutang)}</p>
            </button>
            <button class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 text-left transition-colors hover:border-rw-border-gray" onclick={() => go('alat')} data-card-alat>
              <p class="text-caption uppercase tracking-wide text-rw-light-gray">Alat balik modal</p>
              <p class="mt-2 text-subheading font-normal">{alatBalikModal}/{ringkasan.per_alat.length}</p>
            </button>
            <button class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 text-left transition-colors hover:border-rw-border-gray max-md:col-span-2" onclick={() => lompatKeTransaksi('terjadwal')} data-card-job>
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
                <button class="flex w-full justify-between gap-2 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-3 text-left text-body-sm transition-colors hover:border-rw-border-gray" onclick={() => lompatKeInvoice(b.isOverdue ? 'overdue' : 'unpaid', b.id)} data-perhatian-item>
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
                <button class="flex w-full justify-between gap-2 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-3 text-left text-body-sm transition-colors hover:border-rw-border-gray" onclick={() => lompatKeTransaksi('semua', t.id)} data-recent-item>
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
    <section class="mt-8" data-view="settings">
      <h2 class="text-subheading font-normal">Settings</h2>
      <p class="mt-2 text-body-sm text-rw-light-gray">Identitas + rekening untuk kop dokumen. Nilai ini mengisi otomatis kop RAB/Brief dan blok DARI/TRANSFER KE di Invoice baru (invoice lama menyimpan snapshot bank-nya sendiri).</p>
      <!-- Q29: sebut path file logo yang ditunggu kop cetak, ganti logo = taruh file + deploy. -->
      <div class="mt-4 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4" data-logo-note>
        <p class="text-caption uppercase text-rw-light-gray">Logo kop cetak</p>
        <p class="mt-1 text-body-sm">Kop cetak memakai file <code class="rounded-rw-badge bg-rw-ground px-1 font-mono text-body-sm">public/img/logo-red.png</code> (path URL <code class="rounded-rw-badge bg-rw-ground px-1 font-mono text-body-sm">img/logo-red.png</code>). Sampai file itu disuplai, kop memakai teks nama studio. Ganti logo = taruh file lalu deploy.</p>
      </div>
      <form class="mt-4 grid gap-4 max-md:grid-cols-1 md:grid-cols-2" onsubmit={simpanSettings}>
        {#each [['nama', 'Nama studio'], ['hp', 'No. HP'], ['email', 'Email'], ['bank', 'Bank'], ['norek', 'No. rekening'], ['atas_nama', 'Atas nama']] as [f, label] (f)}
          <label class="grid gap-1 text-body-sm">{label}<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={setForm[f]} /></label>
        {/each}
        <button class="rounded-rw-control bg-rw-accent px-6 py-2.5 text-body-sm text-rw-white justify-self-start md:col-span-2 max-md:w-full" type="submit">Simpan settings</button>
      </form>
    </section>
    {/if}
  </main>
</div>
