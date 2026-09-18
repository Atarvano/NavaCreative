<script>
  // TransaksiView (spec: ticket 09). Extracted from DashboardApp.svelte's
  // `{#if view === 'transaksi'}` block plus its `txRow` row snippet, moved as a
  // unit. Markup unchanged byte-for-byte.
  //
  // Owns its UI state (search/filter/sort, expanded row, the loaded Brief).
  // Data + mutations come from the store; the walk-in and Brief forms open in
  // the shell's shared Panel, so those are passed in as callbacks.
  import { rupiah, tgl, grupBaris, urutkan, rwChip } from '../lib/format.js';
  import { printBrief as printBriefPure } from '../lib/print.js';
  import { pendingFilter } from '../lib/nav.svelte.js';

  let {
    transaksi,
    settings,
    onBukaWalkin,
    onBukaBrief,
    onStatus,
    onTerbitkan,
    onMuatBrief,
  } = $props();

  // --- UI state (per-view) ---
  let openTransaksiId = $state(null);
  let brief = $state(null);
  let txSearch = $state('');
  let txStatusFilter = $state('semua');
  let txSortKey = $state(null); // null = id desc (default terbaru)
  let txSortDesc = $state(true);

  // A cross-view or same-view jump carries its filter here (ticket 09). Applied
  // as an effect so both cases work: the mounted view reacts when nav sets it on
  // a same-view jump, and a fresh mount picks up whatever was left for it.
  $effect(() => {
    if (pendingFilter.transaksi != null) {
      txSearch = '';
      txStatusFilter = pendingFilter.transaksi;
      pendingFilter.transaksi = null;
    }
  });

  const TX_STATUSES = ['terjadwal', 'berjalan', 'selesai', 'batal'];

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

  // Expand seragam (Q25): single-open per view; lapis-dua Brief ikut ketutup.
  async function bukaTransaksi(t) {
    openTransaksiId = openTransaksiId === t.id ? null : t.id;
    brief = null;
    if (openTransaksiId) {
      brief = await onMuatBrief(t.id);
    }
  }

  // "Cetak brief" only makes sense once the row (and its brief) is expanded.
  const printBrief = (t) => printBriefPure(t, brief, settings);

  // Called by the shell when the shared Brief Panel saves, so the row's copy
  // of the brief stays in sync without a refetch.
  export function setBrief(next) {
    brief = next;
  }
</script>

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
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onStatus(t, 'berjalan')}>Mulai</button>
        {:else if t.status === 'berjalan'}
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onStatus(t, 'selesai')}>Selesai</button>
        {:else if t.status === 'selesai' && !t.invoice_terbit}
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onTerbitkan(t, bukaTransaksi)}>Terbitkan</button>
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
      <button class="underline" onclick={() => onBukaBrief(t)} data-brief-toggle>Brief</button>
      <button class="underline" onclick={() => printBrief(t)}>Cetak brief</button>
      {#if !t.invoice_terbit && t.status !== 'selesai' && t.status !== 'batal'}<button class="underline" onclick={() => onTerbitkan(t, bukaTransaksi)}>Terbitkan invoice</button>{/if}
      {#if t.status !== 'batal' && t.status !== 'selesai'}<button class="underline" onclick={() => onStatus(t, 'batal')}>Batal</button>{/if}
    </div>
  </td></tr>
  {/if}
{/snippet}

<section class="mt-8" data-view="transaksi">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h2 class="text-subheading font-normal">Transaksi</h2>
    <button class="rounded-rw-control bg-rw-accent px-5 py-2.5 text-body-sm text-rw-white max-md:py-3" onclick={onBukaWalkin} data-walkin-toggle>
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
