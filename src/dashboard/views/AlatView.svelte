<script>
  // AlatView (spec: ticket 09). Extracted from DashboardApp.svelte's
  // `{#if view === 'alat'}` block plus its `alatCard` row snippet, moved as a
  // unit so the view owns both. Markup unchanged byte-for-byte.
  //
  // Owns its UI state (the add form buffer, which card is expanded, the servis
  // form) per ADR-0014: views keep UI state, the store keeps data + actions.
  import { rupiah, tgl, balikModalBadge } from '../lib/format.js';

  let { alat, busy, onAdd, onArsipkan, onAktifkan, onMuatServis, onAddServis } = $props();

  // --- UI state (per-view) ---
  let nama = $state('');
  let hargaBeli = $state('');
  let tarifEvent = $state('');
  let alatBuilderOpen = $state(false);
  let openId = $state(null);
  let servisRows = $state([]);
  let svTanggal = $state('');
  let svKeterangan = $state('');
  let svBiaya = $state('');
  let servisFormId = $state(null);
  let showArsip = $state(false);

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

  async function submitAlat(e) {
    e.preventDefault();
    const ok = await onAdd({ nama, harga_beli: Number(hargaBeli), tarif_event: Number(tarifEvent) });
    if (ok) {
      nama = '';
      hargaBeli = '';
      tarifEvent = '';
      alatBuilderOpen = false;
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
    servisRows = await onMuatServis(a.id);
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

  async function submitServis(a, e) {
    e.preventDefault();
    const data = await onAddServis(a, { tanggal: svTanggal, keterangan: svKeterangan, biaya: Number(svBiaya) });
    if (!data) return;
    servisRows = [...servisRows, data];
    servisFormId = null;
  }

  // Arsip = satu-satunya aksi Alat yang selalu confirm (Q45), dan confirm-nya
  // beda-bobot dari aksi lain: tiga kalimat berurutan. Tanpa hapus fisik (B4).
  async function arsipkan(a) {
    if (!confirm(`Arsipkan ${a.nama}? Kartu pindah ke daftar arsip (default tersembunyi).\n\nRiwayat servis, modal, dan pendapatan tetap tersimpan — tidak ada yang dihapus.\n\nAktifkan lagi kapan saja lewat toggle “Tampilkan arsip”.`)) return;
    await onArsipkan(a);
  }

</script>

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
        <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onAktifkan(a)} data-alat-aktifkan>Aktifkan kembali</button>
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
          <form class="mt-4 grid gap-3 border-t border-rw-border-gray/40 pt-4 max-md:grid-cols-1 md:grid-cols-[1fr_2fr_1fr_auto] md:items-end" onsubmit={(e) => submitServis(a, e)} data-servis-form>
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
  <form class="mt-4 grid gap-4 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 max-md:grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end" onsubmit={submitAlat} data-alat-form>
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
