<script>
  // InvoiceView (spec: ticket 09). Extracted from DashboardApp.svelte's
  // `{#if view === 'invoice'}` block plus its `invRow` row snippet, moved as a
  // unit. Markup unchanged byte-for-byte.
  //
  // Owns its UI state (search/filter/sort, expanded row, the loaded detail).
  // Data + mutations come from the store; the payment/tempo forms open in the
  // shell's shared Panel, so those are passed in as callbacks. `skeleton` is the
  // shell's shared loading placeholder.
  import { rupiah, tgl, urutkan, rwChip } from '../lib/format.js';
  import { pendingFilter } from '../lib/nav.svelte.js';

  let {
    invoices,
    transaksi,
    skeleton,
    detailEpoch,
    onBayarCepat,
    onBukaTempo,
    onPrint,
    onVoid,
    onMuatDetail,
  } = $props();

  // --- UI state (per-view) ---
  let openInvoiceId = $state(null);
  let invDetail = $state(null);
  let invSearch = $state('');
  let invStatusFilter = $state('semua');
  let invSortKey = $state(null); // null = id desc (default terbaru)
  let invSortDesc = $state(true);

  const INV_STATUSES = ['unpaid', 'partial', 'paid', 'batal'];

  // A cross-view jump carries its filter here (ticket 09); see TransaksiView.
  $effect(() => {
    if (pendingFilter.invoice != null) {
      invSearch = '';
      invStatusFilter = pendingFilter.invoice;
      pendingFilter.invoice = null;
    }
  });

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

  // Expand seragam (Q25): single-open; isi ulang detail saat buka.
  async function bukaInvoice(i) {
    openInvoiceId = openInvoiceId === i.id ? null : i.id;
    invDetail = null;
    if (openInvoiceId) {
      invDetail = await onMuatDetail(i.id);
    }
  }

  // Re-fetch the open detail after the Panel mutates an invoice (ticket 09):
  // the list refreshes via load(), but the expanded detail is fetched here.
  $effect(() => {
    const _epoch = detailEpoch;
    if (openInvoiceId != null) {
      onMuatDetail(openInvoiceId).then((d) => {
        if (d) invDetail = d;
      });
    }
  });

  // Called by the shell when the shared Panel mutates an invoice.
  export function setDetail(next) {
    invDetail = next;
  }
</script>

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
          <button class="underline scroll-mt-32 max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onBayarCepat(i)} data-inv-bayar>Bayar</button>
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
          <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onBayarCepat(i)} data-inv-bayar-detail>Catat bayar</button>
        {/if}
        {#if i.status !== 'batal'}
          <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onBukaTempo(i)} data-inv-tempo-toggle>Ubah tempo</button>
        {/if}
        <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onPrint(i, invDetail)}>Cetak</button>
        {#if i.status !== 'paid' && i.status !== 'batal'}
          <button class="underline text-rw-danger-text max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onVoid(i)}>Batalkan</button>
        {/if}
      </div>
    {:else}
      {@render skeleton(2)}
    {/if}
  </td></tr>
  {/if}
{/snippet}

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
