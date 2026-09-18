<!-- Ember DashboardApp: layout extracted from agyfdashboard index.html.
     Uses API data instead of localStorage, header title follows active view. -->
<script>
  import { onMount, onDestroy } from "svelte";
  import { state as store, load, logout, muatRingkasan, pulihkanDraft401 } from "./lib/store.svelte.js";
  import { VIEW_KEYS, view as navView, pendingExpand, go, viewDariHash } from "./lib/nav.svelte.js";
  import { ui, openDrawer, closeDrawer, closePrint, showToast } from "./lib/ui.svelte.js";
  import { cetak } from "./lib/print-ember.js";
  import Sidebar from "./shell/Sidebar.svelte";
  import RingkasanView from "./views/RingkasanView.svelte";
  import TransaksiView from "./views/TransaksiView.svelte";
  import RabView from "./views/RabView.svelte";
  import InvoiceView from "./views/InvoiceView.svelte";
  import PaketView from "./views/PaketView.svelte";
  import AlatView from "./views/AlatView.svelte";
  import SettingsView from "./views/SettingsView.svelte";
  import WalkinForm from "./shell/forms/WalkinForm.svelte";
  import RabForm from "./shell/forms/RabForm.svelte";
  import BriefForm from "./shell/forms/BriefForm.svelte";
  import PayForm from "./shell/forms/PayForm.svelte";
  import TempoForm from "./shell/forms/TempoForm.svelte";
  import CorrectionForm from "./shell/forms/CorrectionForm.svelte";
  import PackageForm from "./shell/forms/PackageForm.svelte";
  import GearForm from "./shell/forms/GearForm.svelte";

  const view = $derived(navView.current);
  const me = $derived(store.me);

  const JUDUL = {
    ringkasan: ["Dasbor Operasional", "Kelola sewa alat multimedia, jadwal, penawaran, dan penagihan kas"],
    transaksi: ["Transaksi Sewa", "Reservasi job multimedia, jadwal, dan brief pra-produksi"],
    rab: ["RAB (Estimasi)", "Susun penawaran biaya, setujui jadi transaksi sekali klik"],
    invoice: ["Invoice & Penagihan", "Terbitkan tagihan, catat bayar, pantau tempo"],
    paket: ["Paket Template", "Template baris siap salin ke RAB tanpa ubah dokumen lama"],
    alat: ["Alat & Servis", "Inventaris, modal, balik modal, dan riwayat servis"],
    settings: ["Pengaturan Studio", "Identitas dan rekening untuk kop dokumen"],
  };

  const DRAWER_JUDUL = {
    walkin: "Buat Job Sewa Langsung (Walk-in)",
    rab: null, // Dynamic: edit vs new
    brief: null, // Dynamic: project name
    pay: null,
    tempo: null,
    correction: null,
    package: null, // Dynamic
    gear: "Tambah Unit Alat Multimedia Baru",
  };

  function judulDrawer() {
    const d = ui.drawer;
    if (d.type === "rab") return d.data ? "Ubah Rencana Anggaran Biaya (RAB)" : "Buat RAB Baru";
    if (d.type === "brief") return `Dokumen Brief Pra-Produksi (${d.data?.nama_project ?? ""})`;
    if (d.type === "pay") return `Pencatatan Pembayaran: ${d.data?.nomor ?? ""}`;
    if (d.type === "tempo") return `Ubah Jatuh Tempo: ${d.data?.nomor ?? ""}`;
    if (d.type === "correction") return `Koreksi Nilai Invoice: ${d.data?.nomor ?? ""}`;
    if (d.type === "package") return d.data ? "Ubah Template Paket" : "Tambah Paket Baru";
    return DRAWER_JUDUL[d.type] ?? "Form Builder";
  }

  function syncHash() {
    const h = viewDariHash();
    if (h && VIEW_KEYS.includes(h)) navView.current = h;
  }

  function pilih(v) {
    ui.mobileNav = false;
    if (navView.current === v) {
      closeDrawer();
      return;
    }
    closeDrawer();
    go(v);
  }

  async function keluar() {
    await logout();
  }

  function onKey(e) {
    if (e.key === "Escape") {
      if (ui.drawer.open) closeDrawer();
      else if (ui.print.open) closePrint();
      else ui.mobileNav = false;
    }
  }

  // Toast mapped from store.error/notice (display once, then clear).
  $effect(() => {
    if (store.error) {
      const msg = store.error;
      store.error = "";
      showToast(msg, "error");
    }
  });
  $effect(() => {
    if (store.notice) {
      const msg = store.notice;
      store.notice = "";
      showToast(msg, "success");
    }
  });

  onMount(async () => {
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("keydown", onKey);
    try {
      const meRes = await fetch("/api/auth/me");
      if (meRes.status === 401) {
        // pi-lens-ignore: no-open-redirect, no-open-redirect-js
        location.href = "login.html";
        return;
      }
      store.me = (await meRes.json()).username;
      await load();
      await muatRingkasan();
      const h = viewDariHash();
      navView.current = h && VIEW_KEYS.includes(h) ? h : "ringkasan";
      // Rescued 401 drafts reopen in their respective drawers.
      const { tx, rb, br } = pulihkanDraft401();
      if (tx) openDrawer("walkin", null, tx);
      else if (rb) openDrawer("rab", null, rb);
      else if (br?.transaksi_id) {
        const t = store.transaksi.find((x) => x.id === br.transaksi_id);
        if (t) {
          pendingExpand.transaksi = t.id;
          openDrawer("brief", t, br.form);
        }
      }
    } catch {
      showToast("Tidak bisa menghubungi server. Coba lagi.", "error");
    }
  });

  onDestroy(() => {
    window.removeEventListener("hashchange", syncHash);
    window.removeEventListener("keydown", onKey);
  });
</script>

<div id="app-layout" class="min-h-screen flex flex-col md:flex-row">
  <a href="#page-title" class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#C2410C] focus:text-white focus:font-semibold focus:rounded-lg focus:shadow-lg focus:outline-none">Lewati ke konten utama</a>

  {#if ui.mobileNav}
    <div id="sidebar-backdrop" class="fixed inset-0 z-30 bg-stone-900/40 backdrop-blur-sm md:hidden" role="presentation" onclick={() => (ui.mobileNav = false)} onkeydown={(e) => e.key === "Enter" && (ui.mobileNav = false)}></div>
  {/if}

  <Sidebar {view} {me} mobileOpen={ui.mobileNav} onPilih={pilih} onLogout={keluar} />

  <div class="flex-1 flex flex-col md:pl-64 min-w-0">
    <header class="min-h-[4rem] py-2 bg-white border-b border-stone-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 gap-2">
      <div class="flex items-center gap-2.5 min-w-0">
        <button type="button" aria-label="Buka menu navigasi" aria-expanded={ui.mobileNav} onclick={() => (ui.mobileNav = !ui.mobileNav)} class="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-stone-600 hover:text-stone-900 rounded-lg md:hidden shrink-0">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div class="min-w-0">
          <h2 id="page-title" class="text-sm sm:text-base md:text-lg font-bold font-display text-stone-900 truncate">{JUDUL[view]?.[0] ?? "Dasbor Operasional"}</h2>
          <p class="text-[11px] text-stone-500 hidden sm:block truncate">{JUDUL[view]?.[1] ?? ""}</p>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <span class="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span class="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true"></span>
          Sistem Aktif
        </span>
      </div>
    </header>

    <main class="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
      {#if view === "ringkasan"}
        <RingkasanView />
      {:else if view === "transaksi"}
        <TransaksiView />
      {:else if view === "rab"}
        <RabView />
      {:else if view === "invoice"}
        <InvoiceView />
      {:else if view === "paket"}
        <PaketView />
      {:else if view === "alat"}
        <AlatView />
      {:else if view === "settings"}
        <SettingsView />
      {/if}
    </main>
  </div>
</div>

{#if ui.drawer.open}
  <div id="drawer-backdrop" class="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm transition-opacity duration-200" role="presentation" onclick={closeDrawer}></div>
{/if}
<div id="slide-drawer" class="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl border-l border-stone-200 transform transition-transform duration-300 ease-in-out flex flex-col {ui.drawer.open ? '' : 'translate-x-full'}" aria-hidden={!ui.drawer.open} inert={!ui.drawer.open}>
  <div class="h-16 px-4 sm:px-6 border-b border-stone-200 flex items-center justify-between bg-stone-50 shrink-0">
    <h3 id="drawer-title" class="text-sm font-bold font-display text-stone-900 truncate pr-2">{judulDrawer()}</h3>
    <button type="button" onclick={closeDrawer} aria-label="Tutup panel formulir" class="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded-lg transition-colors shrink-0">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  </div>

  <div id="drawer-body" class="flex-1 overflow-y-auto p-4 sm:p-6">
    {#if ui.drawer.open}
      {#if ui.drawer.type === "walkin"}
        <WalkinForm prefill={ui.drawer.prefill} />
      {:else if ui.drawer.type === "rab"}
        <RabForm data={ui.drawer.data} prefill={ui.drawer.prefill} />
      {:else if ui.drawer.type === "brief"}
        <BriefForm data={ui.drawer.data} prefill={ui.drawer.prefill} />
      {:else if ui.drawer.type === "pay"}
        <PayForm data={ui.drawer.data} />
      {:else if ui.drawer.type === "tempo"}
        <TempoForm data={ui.drawer.data} />
      {:else if ui.drawer.type === "correction"}
        <CorrectionForm data={ui.drawer.data} />
      {:else if ui.drawer.type === "package"}
        <PackageForm data={ui.drawer.data} />
      {:else if ui.drawer.type === "gear"}
        <GearForm />
      {/if}
    {/if}
  </div>
</div>

{#if ui.print.open}
  <div id="print-modal" class="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center">
    <div class="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-stone-300 flex flex-col max-h-[90vh]">
      <div class="h-14 px-6 border-b border-stone-200 flex items-center justify-between bg-stone-50 shrink-0">
        <h4 id="print-modal-title" class="text-sm font-bold text-stone-900 font-display">{ui.print.title}</h4>
        <div class="flex items-center gap-2">
          <button type="button" onclick={() => cetak(ui.print.title, ui.print.html)} class="px-4 py-1.5 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded-lg transition-colors flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            <span>Cetak / Simpan PDF</span>
          </button>
          <button type="button" onclick={closePrint} aria-label="Tutup pratinjau cetak" class="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded-lg">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div id="print-modal-content" class="flex-1 overflow-y-auto p-4 sm:p-6 bg-stone-100/50">
        {@html ui.print.html}
      </div>
    </div>
  </div>
{/if}

<div id="app-toast" role="status" aria-live="polite" class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all duration-300 {ui.toast.visible ? '' : 'hidden'} {ui.toast.type === 'error' ? 'bg-red-700 text-white' : ui.toast.type === 'warning' ? 'bg-amber-600 text-white' : 'bg-stone-900 text-white'}">
  <span id="toast-message">{ui.toast.msg}</span>
</div>
