<script>
  // DashboardApp: shell #54, tabel Transaksi #55 / RAB #56 / Invoice #57,
  // Ringkasan #58, Alat cards + servis lapis-dua + arsip toggle #59.
  import { onMount } from 'svelte';
  import { rupiah, subtotal, grupBaris, urutkan, eventKurang, balikModalBadge, statusKind, rwChip, tgl, hariIniPlus, tglCetak } from './lib/format.js';
  import { stashDraft, ambilDraft, hapusDraft, draftAda } from './lib/draft.js';
  import { LOGO_PATH, MERAH, kopDokumen as kopDokumenPure, CETAK_CSS as CETAK_CSS_PURE, cetakDokumen, printRab as printRabPure, printInvoice as printInvoicePure, printBrief as printBriefPure } from './lib/print.js';
  // Store (ticket 07, ADR-0014): data + actions live in a shared rune module.
  // This component consumes it and owns only UI state. The store exposes ONE
  // reactive `state` object (Svelte 5 makes imported bindings read-only, so a
  // bare `export let` could not be assigned from here). `s` is a local alias,
  // and the `$derived` bindings below keep the markup's bare names working.
  import * as store from './lib/store.svelte.js';
  import SettingsView from './views/SettingsView.svelte';
  import RingkasanView from './views/RingkasanView.svelte';
  import AlatView from './views/AlatView.svelte';
  import PaketView from './views/PaketView.svelte';
  import RabView from './views/RabView.svelte';
  import TransaksiView from './views/TransaksiView.svelte';
  import InvoiceView from './views/InvoiceView.svelte';
  import Sidebar from './shell/Sidebar.svelte';
  import Topbar from './shell/Topbar.svelte';
  import Panel from './shell/Panel.svelte';
  // Nav (ticket 08, ADR-0014): hash-based navigation + the pending-panel bridge.
  // The shell registers its Panel / per-view hooks below; nav never imports them.
  import { NAV, VIEW_KEYS, view as navView, setNavHooks, setPendingPanel, tampilkan, lompatInvoice, lompatTransaksi, go, viewDariHash } from './lib/nav.svelte.js';
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
  } from './lib/store.svelte.js';
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
  // --- Redesign 06 (#59): Alat cards ---
  // The Alat view's form buffers + expand state now live in AlatView.svelte
  // (ticket 09): they are view-local UI state.

  // Adapter: AlatView's add form calls this with the raw payload; it owns the
  // notice/error side effects via the store action.
  async function storeAddAlatAdapter(payload) {
    s.error = '';
    s.notice = '';
    s.busy = true;
    try {
      const data = await storeAddAlat(payload);
      return !!data;
    } finally {
      s.busy = false;
    }
  }

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
  // openTransaksiId / brief live in TransaksiView (ticket 09); the LISTS are in
  // the store.

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

  // Alat handlers (addAlat / arsipkan / aktifkan / toggle / bukaServisForm /
  // addServis) moved into AlatView.svelte (ticket 09): they act on that view's
  // own UI state. The store actions are passed in; `confirm` for arsip lives
  // with the button that triggers it.

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

  // statusRab moved to the store (ticket 07); passed to RabView directly.

  // Setujui tanpa confirm (Q45): 1 klik → Transaksi, auto-pindah #/transaksi
  // + notice. Void + koreksi-minus di Transaksi tetap jadi pengaman.
  // The store action does the request + reload; the VIEW SWITCH stays here
  // because navigation is a shell concern (nav.svelte.js).
  async function setujuiAdapter(r) {
    const transaksiId = await storeSetujui(r);
    if (transaksiId != null) go('transaksi');
  }

  // printRab needs the view's row grouper, which now lives in RabView. The view
  // calls print.js directly with its own grouper, so no shell wrapper is needed.

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
  // Transaksi's expand state + brief copy live in TransaksiView (ticket 09).
  let brForm = $state({});

  // --- Redesign 02 (#55): Transaksi table + walk-in + Brief ---
  // Ticket 04: walk-in and Brief both open in the shared Panel, so no inline-open
  // flag remains; `briefOpenId` still tracks the open Brief for the 401 stash.
  let briefOpenId = $state(null);
  let briefTx = $state(null); // transaksi whose brief is open in the Panel
  // Transaksi's table state (search / status / sort / expand) moved into
  // TransaksiView.svelte (ticket 09).

  const KATEGORI = ['PRODUCTION', 'LOGISTIK', 'MISC'];

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

  // --- Redesign 03 (#56): RAB table ---
  // RAB's search/status/sort/expand state moved into RabView.svelte (ticket 09).
  // The store still owns the `rabs` list; the view owns its filter UI state.

  // Expand Paket (#60): grup kategori + subtotal, plek dokumen (Q15).
  const paketGrup = (p) => grupBaris(p.baris);

  // --- Invoice (#45): terbit dari transaksi, bayar, void, cetak ---
  // invoices now lives in the store (ticket 07).

  let byTanggal = $state(new Date().toISOString().slice(0, 10));
  let byJumlah = $state('');
  let byMetode = $state('transfer');

  // --- Redesign 04 (#57): tabel Invoice — search + status(+overdue) + sort
  // + expand riwayat + form bayar lapis-dua + ubah tempo via PATCH. Pola
  // tabel meniru RAB (#56) / Transaksi (#55).
  // Invoice's search/filter/sort/expand state moved into InvoiceView.svelte
  // (ticket 09). What stays here: the bayar/tempo Panel forms, which the shell
  // owns (they open in the shared Panel).
  let invTempo = $state('');
  // Invoice whose bayar/tempo Panel is open (ticket 06). No-arg form snippets
  // read this, matching briefTx: a snippet passed to the Panel as a value must
  // not be pre-invoked with an argument (that yields a fragment, not a snippet).
  let invForm = $state(null);
  // The Panel's bayar / tempo actions call `load()` (which refreshes the LIST),
  // but the expanded row's DETAIL is fetched separately and lives in the view.
  // This counter is bumped after such a mutation so the view can re-fetch its
  // open detail, keeping the same "stale detail after edit" behaviour as before
  // the split (ticket 09).
  let invDetailEpoch = $state(0);
  const invDetailTouched = () => (invDetailEpoch += 1);

  // Terbitkan = primer sekali-klik (Q45: tanpa confirm — void + koreksi
  // minus tetap pengaman), tempo default H+7, auto-pindah #/invoice + notice.
  // statusTransaksi / terbitkan moved to the store (ticket 07). The view switch
  // after a successful terbitkan stays here (navigation is a shell concern).
  async function terbitkanAdapter(t) {
    const data = await storeTerbitkan(t);
    if (data) go('invoice');
  }

  // Print Invoice: delegates to print.js; the view passes its own detail copy.
  // Print Invoice: delegates to print.js with the view's loaded detail. The
  // detail is required (a list row lacks baris/bayar/transaksi); a missing
  // detail is a no-op, matching the old `if (!i) return` guard.
  const printInvoiceAdapter = (i, detail) => {
    if (detail) printInvoicePure(detail, settings);
  };

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
      invDetailTouched();
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
      invDetailTouched();
      tutupPanel();
      await load();
    } finally {
      s.busy = false;
    }
  }

  async function voidInvoice(i) {
    if (!confirm(`Batalkan ${i.nomor}? Riwayat tetap tersimpan.`)) return;
    await storeVoidInvoice(i);
  }

  // bukaTransaksi's expand logic lives in TransaksiView (ticket 09); the shell
  // only supplies the brief fetch, which the store owns.

  async function simpanBrief(t, e) {
    e.preventDefault();
    const res = await storeSimpanBrief(t.id, { ...brForm });
    if (!res.ok) return;
    s.notice = `Brief ${t.nama_project} tersimpan.`;
    hapusDraft('brief');
    tutupPanel();
  }

  // Print Brief removed: delegates to ./dashboard/lib/print.js (byte-identical).
  // printBrief now lives in TransaksiView, which owns the loaded `brief`.

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
        briefOpenId = null;
      }
      // RAB / Invoice / Paket / Alat expand state live in their views, which
      // unmount on view change and therefore reset themselves. Nothing to clear
      // here. Only the shell-owned Panel targets are reset.
      if (v !== 'paket') pkTarget = null;
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
  // nav.svelte.js (ticket 08). Only the shell-owned Brief tracker is cleared:
  // every view's expand + filter state lives inside the view, which unmounts
  // on navigation and resets itself (ticket 09). The filter one-shots reach
  // the views through their own `pendingFilter` effect.
  const navDeps = {
    clearTransaksiOpen: () => {
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

{#snippet sidebar()}
  <Sidebar
    nav={NAV}
    navIcons={NAV_ICONS}
    {view}
    {me}
    {invBelumLunas}
    {invOverdue}
    {txAktif}
    onPilih={pilih}
    onLogout={logout}
    SettingsIcon={Settings}
    UserIcon={User}
    LogoutIcon={LogOut}
  />
{/snippet}

<!-- Sidebar desktop, fixed ~260px (ADR-0012). Charcoal surface (#33323E) reads
     as chrome on the #13111C ground; hairline border separates the two. -->
<aside data-sidebar class="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-rw-border-gray/40 bg-rw-charcoal md:flex">
  {@render sidebar()}
</aside>

<Topbar {me} onBukaDrawer={bukaDrawer} MenuIcon={Menu} UserIcon={User} />

{#if drawerOpen}
  <div class="fixed inset-0 z-50 md:hidden">
    <button class="absolute inset-0 bg-rw-darker/70" aria-label="Tutup menu" onclick={tutupDrawer}></button>
    <div data-drawer class="absolute inset-y-0 left-0 flex w-[260px] flex-col bg-rw-charcoal">
      {@render sidebar()}
    </div>
  </div>
{/if}

<Panel {panelTitle} {panelIsi} bind:panelEl onClose={tutupPanel} onBackdrop={panelKlikLuar} CloseIcon={X} />

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
    <AlatView
      {alat}
      {busy}
      onAdd={storeAddAlatAdapter}
      onArsipkan={storeArsipkan}
      onAktifkan={storeAktifkan}
      onMuatServis={muatServis}
      onAddServis={storeAddServis}
    />
    {/if}
    {#if view === 'paket'}
    <PaketView {paket} onBukaBuilder={bukaPaketBuilder} onEdit={bukaEditPaket} onBuatRab={dariPaket} />
    {/if}
    {#if view === 'rab'}
    <RabView {rabs} {settings} onBukaBuilder={bukaRabBuilder} onStatus={storeStatusRab} onSetujui={setujuiAdapter} />
    {/if}
    {#if view === 'transaksi'}
    <TransaksiView
      {transaksi}
      {settings}
      onBukaWalkin={bukaWalkin}
      onBukaBrief={bukaBrief}
      onStatus={storeStatusTransaksi}
      onTerbitkan={terbitkanAdapter}
      onMuatBrief={muatBrief}
    />
    {/if}
    {#if view === 'invoice'}
    <InvoiceView
      {invoices}
      {transaksi}
      {skeleton}
      onBayarCepat={bayarCepat}
      onBukaTempo={bukaTempo}
      onPrint={printInvoiceAdapter}
      onVoid={voidInvoice}
      onMuatDetail={muatInvoice}
      detailEpoch={invDetailEpoch}
    />
    {/if}
    {#if view === 'ringkasan'}
    <RingkasanView
      {ringkasan}
      {perhatian}
      {alatBalikModal}
      {bulanIni}
      {skeleton}
      onLompatInvoice={lompatKeInvoice}
      onLompatTransaksi={lompatKeTransaksi}
      onGo={go}
    />
    {/if}
    {#if view === 'settings'}
    <SettingsView {setForm} onSimpan={simpanSettings} />
    {/if}
  </main>
</div>
