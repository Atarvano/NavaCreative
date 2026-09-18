<script>
  // RabView (spec: ticket 09). Extracted from DashboardApp.svelte's
  // `{#if view === 'rab'}` block plus its `rabRow` row snippet, moved as a unit.
  // Markup unchanged byte-for-byte.
  //
  // Owns its UI state (search, status filter, sort, expanded row). Data + the
  // mutation actions come from the store via the shell's props (ADR-0014).
  import { rupiah, grupBaris, urutkan, rwChip } from '../lib/format.js';
  import { printRab as printRabPure } from '../lib/print.js';

  let { rabs, settings, onBukaBuilder, onStatus, onSetujui } = $props();

  // --- UI state (per-view) ---
  let openRabId = $state(null);
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

  // Print needs the row grouper, which lives here; print.js stays store-free.
  const printRab = (r) => printRabPure(r, settings, rabGrup);
</script>

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
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onStatus(r, 'sent')}>Kirim</button>
        {:else if r.status === 'sent'}
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onSetujui(r)}>Setujui</button>
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
        <button class="underline" onclick={() => onStatus(r, 'rejected')}>Tolak</button>
        <button class="underline" onclick={() => onStatus(r, 'draft')}>Revisi</button>
      {:else if r.status === 'draft'}
        <button class="underline" onclick={() => onStatus(r, 'rejected')}>Tolak</button>
      {/if}
      {#if r.status === 'rejected'}
        <button class="underline" onclick={() => onStatus(r, 'draft')}>Revisi</button>
      {/if}
      <button class="underline" onclick={() => printRab(r)}>Cetak</button>
    </div>
  </td></tr>
  {/if}
{/snippet}

<section class="mt-8" data-view="rab">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h2 class="text-subheading font-normal">RAB</h2>
    <button class="rounded-rw-control bg-rw-accent px-5 py-2.5 text-body-sm text-rw-white max-md:py-3" onclick={onBukaBuilder} data-rab-toggle>
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
