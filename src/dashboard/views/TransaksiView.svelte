<!-- View Transaksi Ember: comot struktur index.html.
     Mapping backend: nama_project/nama_client/tanggal_mulai/tanggal_selesai/
     lokasi + baris backend; invoice_terbit mengunci tombol terbitkan;
     tombol Brief buka drawer. Search + filter status + sort ikut prototipe
     (tambah opsi aktif = terjadwal+berjalan untuk lompatan kartu Ringkasan). -->
<script>
  import { onMount } from "svelte";
  import { state as store, statusTransaksi, terbitkan } from "../lib/store.svelte.js";
  import { pendingFilter, pendingExpand } from "../lib/nav.svelte.js";
  import { subtotal, subJenis, rupiah, tgl } from "../lib/format.js";
  import { cariBentrok } from "../lib/bentrok.js";
  import { openDrawer } from "../lib/ui.svelte.js";

  let search = $state("");
  let status = $state("semua");
  let sort = $state("newest");
  let expanded = $state({});
  let busyId = $state(null);

  const ALAT = $derived(store.alat);
  const list = $derived.by(() => {
    let rows = [...store.transaksi];
    const q = search.trim().toLowerCase();
    if (q)
      rows = rows.filter((t) =>
        [t.nama_project, t.nama_client, `#${t.id}`].filter(Boolean).join(" ").toLowerCase().includes(q),
      );
    if (status === "aktif") rows = rows.filter((t) => t.status === "terjadwal" || t.status === "berjalan");
    else if (status !== "semua") rows = rows.filter((t) => t.status === status);
    if (sort === "highest") rows.sort((a, b) => b.total - a.total);
    else if (sort === "lowest") rows.sort((a, b) => a.total - b.total);
    else rows.sort((a, b) => b.id - a.id);
    return rows;
  });

  // Terima titipan filter + expand dari Ringkasan (kartu + item perhatian).
  onMount(() => {
    if (pendingFilter.transaksi) {
      search = "";
      status = pendingFilter.transaksi === "semua" ? "semua" : pendingFilter.transaksi;
      pendingFilter.transaksi = null;
    }
    if (pendingExpand.transaksi != null) {
      expanded = { ...expanded, [pendingExpand.transaksi]: true };
      pendingExpand.transaksi = null;
    }
  });

  const badge = (s) =>
    ({
      terjadwal: "bg-amber-100 text-amber-900 border-amber-200",
      berjalan: "bg-orange-100 text-[#C2410C] border-orange-200",
      selesai: "bg-emerald-100 text-emerald-800 border-emerald-200",
      batal: "bg-stone-200 text-stone-700 border-stone-300",
    })[s] ?? "bg-stone-100 text-stone-700 border-stone-200";

  const bentrokUntuk = (t) => {
    const out = [];
    for (const b of t.baris ?? []) {
      if (b.jenis !== "alat" || !b.alat_id) continue;
      for (const l of cariBentrok(store.transaksi, t.id, b.alat_id, t.tanggal_mulai, t.tanggal_selesai))
        out.push({ alat: ALAT.find((a) => a.id === b.alat_id)?.nama ?? b.nama, l });
    }
    return out;
  };

  async function gantiStatus(t, s) {
    busyId = t.id;
    try {
      await statusTransaksi(t, s);
    } finally {
      busyId = null;
    }
  }

  async function terbitkanInv(t) {
    busyId = t.id;
    try {
      await terbitkan(t);
    } finally {
      busyId = null;
    }
  }
</script>

<section id="view-transaksi" class="view-panel space-y-4" aria-label="Transaksi sewa">
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
    <div class="relative flex-1 max-w-md w-full">
      <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400" aria-hidden="true">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </span>
      <input type="text" bind:value={search} placeholder="Cari nama proyek, klien, atau ID transaksi..." aria-label="Cari transaksi" class="w-full text-xs pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C] focus:bg-white transition-all" />
    </div>

    <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
      <select bind:value={status} aria-label="Filter status transaksi" class="flex-1 sm:flex-none text-xs p-2 border border-stone-300 rounded-lg focus:border-[#C2410C] bg-white min-w-[120px]">
        <option value="semua">Semua Status</option>
        <option value="aktif">Aktif</option>
        <option value="terjadwal">Terjadwal</option>
        <option value="berjalan">Berjalan</option>
        <option value="selesai">Selesai</option>
        <option value="batal">Batal</option>
      </select>

      <select bind:value={sort} aria-label="Urut transaksi" class="flex-1 sm:flex-none text-xs p-2 border border-stone-300 rounded-lg focus:border-[#C2410C] bg-white min-w-[120px]">
        <option value="newest">Terbaru</option>
        <option value="highest">Total Tertinggi</option>
        <option value="lowest">Total Terendah</option>
      </select>

      <button type="button" onclick={() => openDrawer("walkin")} class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded-lg shadow-sm transition-colors whitespace-nowrap">+ Walk-in Job</button>
    </div>
  </div>

  <div class="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full min-w-[720px] text-left text-xs">
        <thead class="bg-stone-50 border-b border-stone-200 text-stone-600">
          <tr>
            <th class="py-3 px-3 w-8"><span class="sr-only">Rincian</span></th>
            <th class="py-3 px-3 font-semibold">Proyek & Klien</th>
            <th class="py-3 px-3 font-semibold">Jadwal Sewa & Lokasi</th>
            <th class="py-3 px-3 font-semibold">Total Nilai</th>
            <th class="py-3 px-3 font-semibold">Lifecycle Status</th>
            <th class="py-3 px-3 font-semibold text-right">Aksi Operasional</th>
          </tr>
        </thead>
        <tbody>
          {#each list as t (t.id)}
            {@const bentrok = bentrokUntuk(t)}
            {@const sj = subJenis(t.baris)}
            <tr class="border-b border-stone-200 hover:bg-stone-50/50 transition-colors">
              <td class="py-3 px-3 text-center">
                <button
                  type="button"
                  onclick={() => (expanded = { ...expanded, [t.id]: !expanded[t.id] })}
                  aria-label="Lihat rincian komponen sewa untuk {t.nama_project}"
                  aria-expanded={!!expanded[t.id]}
                  class="text-stone-500 hover:text-stone-900 p-1.5 rounded hover:bg-stone-200"
                >
                  <svg class="w-4 h-4 transform transition-transform {expanded[t.id] ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
              </td>
              <td class="py-3 px-3">
                <div class="font-mono text-xs text-stone-500">#{t.id}</div>
                <div class="text-sm font-semibold text-stone-900">{t.nama_project}</div>
                <div class="text-xs text-stone-600">{t.nama_client}</div>
                {#if bentrok.length}
                  <span class="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                    <svg class="w-3.5 h-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Bentrok Jadwal
                  </span>
                {/if}
              </td>
              <td class="py-3 px-3 text-xs text-stone-700">
                <div>{t.tanggal_mulai ? `${tgl(t.tanggal_mulai)} s/d ${tgl(t.tanggal_selesai)}` : "-"}</div>
                {#if t.lokasi}<div class="text-[11px] text-stone-500 mt-0.5">{t.lokasi}</div>{/if}
              </td>
              <td class="py-3 px-3 font-mono tabular-nums text-xs font-semibold text-stone-900">{rupiah(t.total)}</td>
              <td class="py-3 px-3">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border {badge(t.status)}">{t.status}</span>
                  <select
                    value={t.status}
                    disabled={busyId === t.id}
                    onchange={(e) => gantiStatus(t, e.target.value)}
                    aria-label="Ubah status transaksi #{t.id}"
                    class="text-xs bg-white border border-stone-300 rounded px-1.5 py-0.5 focus:border-[#C2410C]"
                  >
                    <option value="terjadwal">Terjadwal</option>
                    <option value="berjalan">Berjalan</option>
                    <option value="selesai">Selesai</option>
                    <option value="batal">Batal</option>
                  </select>
                </div>
              </td>
              <td class="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                {#if t.invoice_terbit}
                  <span class="inline-flex items-center gap-1 text-xs text-stone-600 bg-stone-100 px-2 py-1 rounded border border-stone-300" title="Invoice sudah terbit">
                    <svg class="w-3.5 h-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Terkunci
                  </span>
                {:else}
                  <button type="button" disabled={busyId === t.id} onclick={() => terbitkanInv(t)} class="text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] px-2.5 py-1.5 rounded transition-colors disabled:opacity-50">Terbitkan Invoice</button>
                {/if}
                <button type="button" onclick={() => openDrawer("brief", t)} class="text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded border border-stone-300 transition-colors">Brief</button>
              </td>
            </tr>
            {#if expanded[t.id]}
              <tr class="bg-stone-50 border-b border-stone-200">
                <td colspan="6" class="p-3 sm:p-4 pl-4 sm:pl-12">
                  <div class="space-y-3">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-2">
                      <h5 class="text-xs font-bold uppercase tracking-wider text-stone-600">Rincian Komponen Sewa</h5>
                      <div class="flex flex-wrap gap-2 sm:gap-4 text-xs font-medium text-stone-700">
                        <span>Subtotal Alat: <strong class="font-mono text-stone-900">{rupiah(sj.Alat)}</strong></span>
                        <span>Subtotal Jasa: <strong class="font-mono text-stone-900">{rupiah(sj.Jasa)}</strong></span>
                        <span>Subtotal Biaya: <strong class="font-mono text-stone-900">{rupiah(sj.Biaya)}</strong></span>
                      </div>
                    </div>
                    <div class="overflow-x-auto">
                      <table class="w-full min-w-[500px] text-xs">
                        <thead>
                          <tr class="text-stone-500 text-left border-b border-stone-200">
                            <th class="py-1">Kategori</th>
                            <th class="py-1">Nama Item</th>
                            <th class="py-1 text-center">Qty / Satuan</th>
                            <th class="py-1 text-right">Tarif Satuan</th>
                            <th class="py-1 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-stone-100">
                          {#each t.baris as b (b.id)}
                            <tr>
                              <td class="py-1.5 font-semibold text-stone-600">{b.jenis}</td>
                              <td class="py-1.5 text-stone-800">{b.nama}</td>
                              <td class="py-1.5 text-center font-mono">{b.qty} {b.satuan}</td>
                              <td class="py-1.5 text-right font-mono">{rupiah(b.harga_satuan)}</td>
                              <td class="py-1.5 text-right font-mono font-semibold text-stone-900">{rupiah(Number(b.qty) * Number(b.harga_satuan))}</td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                    {#if !t.baris?.length}<p class="text-xs text-stone-500 italic">Tanpa baris.</p>{/if}
                    <p class="text-xs text-stone-600">Subtotal {rupiah(subtotal(t.baris))}{t.diskon ? ` · Diskon -{rupiah(t.diskon)}` : ""} · Total {rupiah(t.total)}</p>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    {#if !list.length}
      <div class="py-12 text-center text-stone-500">
        <p class="text-sm font-semibold text-stone-700">Tidak ada transaksi yang cocok.</p>
        <p class="text-xs mt-1">Coba sesuaikan kata kunci pencarian atau ubah filter status.</p>
      </div>
    {/if}
  </div>
</section>
