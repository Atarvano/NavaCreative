<!-- Ember Invoice View: extracted from index.html structure.
     Maps backend fields and joins client name from parent transaction. Void requires confirmation. -->
<script>
  import { onMount } from "svelte";
  import { state as store, muatInvoice, voidInvoice } from "../lib/store.svelte.js";
  import { pendingFilter, pendingExpand } from "../lib/nav.svelte.js";
  import { rupiah, tgl, isOverdue } from "../lib/format.js";
  import { lembarInvoice } from "../lib/print-ember.js";
  import { openDrawer, showPrint } from "../lib/ui.svelte.js";

  let search = $state("");
  let status = $state("semua");
  let sort = $state("newest");
  let expanded = $state({});
  let detail = $state({});
  let busyId = $state(null);

  const clientOf = (i) =>
    store.transaksi.find((t) => t.id === i.transaksi_id)?.nama_client ?? "-";

  const list = $derived.by(() => {
    let rows = [...store.invoices];
    const q = search.trim().toLowerCase();
    if (q)
      rows = rows.filter((i) =>
        [i.nomor, clientOf(i)].filter(Boolean).join(" ").toLowerCase().includes(q),
      );
    if (status === "overdue") rows = rows.filter((i) => i.overdue);
    else if (status === "paid" || status === "partial") rows = rows.filter((i) => i.status === status);
    else if (status === "unpaid") rows = rows.filter((i) => i.status === "unpaid" || i.status === "partial");
    else if (status !== "semua") rows = rows.filter((i) => i.status === status);
    if (sort === "highest") rows.sort((a, b) => b.total - a.total);
    else if (sort === "lowest") rows.sort((a, b) => a.total - b.total);
    else rows.sort((a, b) => b.id - a.id);
    return rows;
  });

  // Dashboard Summary handoff: apply filters and expand relevant rows (e.g., overdue).
  onMount(() => {
    if (pendingFilter.invoice) {
      search = "";
      status = pendingFilter.invoice === "all" ? "semua" : pendingFilter.invoice;
      pendingFilter.invoice = null;
    }
    if (pendingExpand.invoice != null) {
      toggleExpand(pendingExpand.invoice);
      pendingExpand.invoice = null;
    }
  });

  const badge = (s) =>
    ({
      unpaid: "bg-red-100 text-red-800 border-red-200",
      partial: "bg-amber-100 text-amber-800 border-amber-200",
      paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
      batal: "bg-stone-200 text-stone-700 border-stone-300",
    })[s] ?? "bg-stone-100 text-stone-700 border-stone-200";

  async function toggleExpand(id) {
    expanded = { ...expanded, [id]: !expanded[id] };
    if (expanded[id] && !detail[id]) {
      detail = { ...detail, [id]: await muatInvoice(id) };
    }
  }

  async function batal(i) {
    if (!confirm(`Apakah Anda yakin ingin membatalkan (void) Invoice ${i.nomor}? Catatan riwayat pembayaran masa lalu akan tetap disimpan.`)) return;
    busyId = i.id;
    try {
      await voidInvoice(i);
    } finally {
      busyId = null;
    }
  }

  function cetakInv(i) {
    const d = detail[i.id];
    if (d) showPrint("Cetak Dokumen Invoice", lembarInvoice(d, store.settings));
  }

  const koreksi = (d) => (d?.bayar ?? []).filter((p) => Number(p.jumlah) < 0);
  const bayarMasuk = (d) => (d?.bayar ?? []).filter((p) => Number(p.jumlah) >= 0);
</script>

<section id="view-invoice" class="view-panel space-y-4" aria-label="Invoice dan penagihan">
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
    <div class="relative flex-1 max-w-md w-full">
      <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400" aria-hidden="true">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </span>
      <input type="text" bind:value={search} placeholder="Cari nomor invoice, klien, proyek..." aria-label="Cari invoice" class="w-full text-xs pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C] focus:bg-white transition-all" />
    </div>

    <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
      <select bind:value={status} aria-label="Filter status invoice" class="flex-1 sm:flex-none text-xs p-2 border border-stone-300 rounded-lg focus:border-[#C2410C] bg-white min-w-[130px]">
        <option value="semua">Semua Status</option>
        <option value="unpaid">Belum Lunas</option>
        <option value="partial">Sebagian (DP)</option>
        <option value="paid">Lunas</option>
        <option value="overdue">Overdue</option>
        <option value="batal">Batal (Void)</option>
      </select>

      <select bind:value={sort} aria-label="Urut invoice" class="flex-1 sm:flex-none text-xs p-2 border border-stone-300 rounded-lg focus:border-[#C2410C] bg-white min-w-[120px]">
        <option value="newest">Terbaru</option>
        <option value="highest">Total Tertinggi</option>
        <option value="lowest">Total Terendah</option>
      </select>
    </div>
  </div>

  <div class="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full min-w-[780px] text-left text-xs">
        <thead class="bg-stone-50 border-b border-stone-200 text-stone-600">
          <tr>
            <th class="py-3 px-3 w-8"><span class="sr-only">Rincian</span></th>
            <th class="py-3 px-3 font-semibold">Nomor & Klien</th>
            <th class="py-3 px-3 font-semibold">Total Tagihan</th>
            <th class="py-3 px-3 font-semibold">Terbayar</th>
            <th class="py-3 px-3 font-semibold">Sisa Tagihan</th>
            <th class="py-3 px-3 font-semibold">Jatuh Tempo</th>
            <th class="py-3 px-3 font-semibold">Status</th>
            <th class="py-3 px-3 font-semibold text-right">Aksi Kas & Cetak</th>
          </tr>
        </thead>
        <tbody>
          {#each list as i (i.id)}
            {@const d = detail[i.id]}
            <tr class="border-b border-stone-200 hover:bg-stone-50/50 transition-colors">
              <td class="py-3 px-3 text-center">
                <button
                  type="button"
                  onclick={() => toggleExpand(i.id)}
                  aria-label="Lihat riwayat pembayaran invoice {i.nomor}"
                  aria-expanded={!!expanded[i.id]}
                  class="text-stone-500 hover:text-stone-900 p-1.5 rounded hover:bg-stone-200"
                >
                  <svg class="w-4 h-4 transform transition-transform {expanded[i.id] ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
              </td>
              <td class="py-3 px-3">
                <div class="font-mono text-xs text-stone-600">{i.nomor}</div>
                <div class="text-sm font-semibold text-stone-900">{clientOf(i)}</div>
              </td>
              <td class="py-3 px-3 font-mono tabular-nums text-xs font-semibold text-stone-900">{rupiah(i.total)}</td>
              <td class="py-3 px-3 font-mono tabular-nums text-xs text-emerald-700 font-semibold">{rupiah(i.dibayar)}</td>
              <td class="py-3 px-3 font-mono tabular-nums text-xs {i.sisa > 0 ? 'text-red-700 font-bold' : 'text-stone-500'}">{rupiah(i.sisa)}</td>
              <td class="py-3 px-3 text-xs text-stone-700">
                <div>{tgl(i.jatuh_tempo)}</div>
                {#if i.overdue && i.status !== "batal"}
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">Overdue</span>
                {/if}
              </td>
              <td class="py-3 px-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border {badge(i.status)}">{i.status}</span>
              </td>
              <td class="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                {#if i.status !== "paid" && i.status !== "batal"}
                  <button type="button" onclick={() => openDrawer("pay", i)} class="text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] px-2.5 py-1.5 rounded transition-colors">Bayar Cepat</button>
                {/if}
                <button type="button" onclick={() => toggleExpand(i.id).then(() => cetakInv(i))} class="text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2 py-1.5 rounded border border-stone-300 transition-colors">Cetak</button>
                {#if i.status !== "batal"}
                  <button type="button" onclick={() => openDrawer("tempo", i)} class="text-xs text-stone-600 hover:text-stone-900 px-2 py-1.5 rounded hover:bg-stone-100" title="Ubah Jatuh Tempo">Tempo</button>
                {/if}
                {#if i.status !== "batal"}
                  <button type="button" disabled={busyId === i.id} onclick={() => batal(i)} class="text-xs text-red-700 hover:text-red-800 hover:bg-red-50 px-2 py-1.5 rounded disabled:opacity-50">Batal</button>
                {/if}
              </td>
            </tr>
            {#if expanded[i.id]}
              <tr class="bg-stone-50 border-b border-stone-200">
                <td colspan="8" class="p-3 sm:p-4 pl-4 sm:pl-12 space-y-4">
                  {#if !d}
                    <p class="text-xs text-stone-500">Memuat rincian...</p>
                  {:else}
                    <div>
                      <div class="flex items-center justify-between border-b border-stone-200 pb-1.5 mb-2">
                        <h5 class="text-xs font-bold uppercase tracking-wider text-stone-700">Riwayat Pembayaran Diterima</h5>
                        <span class="text-xs text-stone-500 font-mono">Total Terbayar: {rupiah(i.dibayar)}</span>
                      </div>
                      {#if bayarMasuk(d).length}
                        <div class="overflow-x-auto">
                          <table class="w-full min-w-[500px] text-xs">
                            <thead>
                              <tr class="text-stone-500 text-left border-b border-stone-200">
                                <th class="py-1">Tanggal</th>
                                <th class="py-1">Label Tagihan</th>
                                <th class="py-1">Metode</th>
                                <th class="py-1">Catatan</th>
                                <th class="py-1 text-right">Nominal</th>
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-stone-100">
                              {#each bayarMasuk(d) as p (p.id)}
                                <tr>
                                  <td class="py-1.5 font-mono text-stone-600">{tgl(p.tanggal)}</td>
                                  <td class="py-1.5 font-semibold text-stone-800">{p.label}</td>
                                  <td class="py-1.5 text-stone-600">{p.metode}</td>
                                  <td class="py-1.5 text-stone-500">{p.referensi || "-"}</td>
                                  <td class="py-1.5 text-right font-mono font-bold text-emerald-700">{rupiah(p.jumlah)}</td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {:else}
                        <p class="text-xs text-stone-500 italic py-1">Belum ada catatan pembayaran yang masuk.</p>
                      {/if}
                    </div>

                    <div>
                      <div class="flex items-center justify-between border-b border-stone-200 pb-1.5 mb-2">
                        <h5 class="text-xs font-bold uppercase tracking-wider text-stone-700">Koreksi & Penyesuaian Nilai (Baris Minus)</h5>
                        {#if i.status !== "batal"}
                          <button type="button" onclick={() => openDrawer("correction", i)} class="text-xs text-[#C2410C] hover:underline font-semibold">+ Tambah Baris Koreksi</button>
                        {/if}
                      </div>
                      {#if koreksi(d).length}
                        <div class="overflow-x-auto">
                          <table class="w-full min-w-[450px] text-xs">
                            <thead>
                              <tr class="text-stone-500 text-left border-b border-stone-200">
                                <th class="py-1">Tanggal</th>
                                <th class="py-1">Keterangan Koreksi</th>
                                <th class="py-1 text-right">Nominal Penyesuaian</th>
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-stone-100">
                              {#each koreksi(d) as p (p.id)}
                                <tr>
                                  <td class="py-1.5 font-mono text-stone-600">{tgl(p.tanggal)}</td>
                                  <td class="py-1.5 text-stone-800">{p.referensi || p.label}</td>
                                  <td class="py-1.5 text-right font-mono font-bold text-red-700">{rupiah(p.jumlah)}</td>
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {:else}
                        <p class="text-xs text-stone-500 italic py-1">Tidak ada baris koreksi minus pada invoice ini.</p>
                      {/if}
                    </div>

                    <div>
                      <h5 class="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Rincian Baris Terkunci dari Transaksi</h5>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded border border-stone-200">
                        {#each d.baris as b (b.nama)}
                          <div class="flex justify-between py-0.5 border-b border-stone-100">
                            <span class="text-stone-700">{b.nama} ({b.qty} {b.satuan})</span>
                            <span class="font-mono font-semibold text-stone-800">{rupiah(Number(b.qty) * Number(b.harga_satuan))}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    {#if !list.length}
      <div class="py-12 text-center text-stone-500">
        <p class="text-sm font-semibold text-stone-700">Tidak ada faktur invoice yang cocok.</p>
        <p class="text-xs mt-1">Invoice diterbitkan langsung dari menu Transaksi melalui tombol "Terbitkan Invoice".</p>
      </div>
    {/if}
  </div>
</section>
