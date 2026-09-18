<!-- View Alat Ember: comot struktur index.html.
     Mapping backend: nama/modal/pendapatan/tarif_event/balik_modal dari API
     (modal turunan harga_beli+servis, bukan kolom). Tanpa kategori dan nomor
     seri (kolomnya tidak ada di DB); tanpa revenue manual (dihitung dari
     baris transaksi jenis alat). Servis: muat + catat ikut prototipe. -->
<script>
  import { state as store, addServis, arsipkan, aktifkan, muatServis } from "../lib/store.svelte.js";
  import { rupiah, tgl, breakEven, hariIni } from "../lib/format.js";
  import { openDrawer } from "../lib/ui.svelte.js";

  let search = $state("");
  let showArchived = $state(false);
  let expanded = $state({});
  let servis = $state({});
  let busyId = $state(null);

  // Buffer form servis inline per alat (ikut prototipe: form di kartu).
  let svTeknisi = $state("");
  let svTanggal = $state(hariIni());
  let svKeterangan = $state("");
  let svBiaya = $state("");

  const list = $derived.by(() => {
    let rows = [...store.alat];
    if (!showArchived) rows = rows.filter((a) => a.is_active);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((a) => a.nama.toLowerCase().includes(q));
    return rows;
  });

  async function toggle(id) {
    expanded = { ...expanded, [id]: !expanded[id] };
    if (expanded[id] && !servis[id]) {
      servis = { ...servis, [id]: await muatServis(id) };
      svTanggal = hariIni();
      svTeknisi = "";
      svKeterangan = "";
      svBiaya = "";
    }
  }

  async function simpanServis(a, e) {
    e.preventDefault();
    busyId = a.id;
    try {
      const d = await addServis(a, {
        tanggal: svTanggal,
        keterangan: svKeterangan.trim() || (svTeknisi.trim() ? `Teknisi: ${svTeknisi.trim()}` : ""),
        biaya: Number(svBiaya) || 0,
      });
      if (d) {
        servis = { ...servis, [a.id]: [...(servis[a.id] ?? []), d] };
        svTeknisi = "";
        svKeterangan = "";
        svBiaya = "";
      }
    } finally {
      busyId = null;
    }
  }

  async function toggleArsip(a) {
    if (a.is_active) {
      if (!confirm(`Konfirmasi: Apakah Anda yakin ingin mengarsipkan alat "${a.nama}"? Data tidak akan dihapus fisik.`)) return;
      await arsipkan(a);
    } else {
      await aktifkan(a);
    }
  }
</script>

<section id="view-alat" class="view-panel space-y-4" aria-label="Alat dan servis">
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
    <div class="relative flex-1 max-w-md w-full">
      <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400" aria-hidden="true">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </span>
      <input type="text" bind:value={search} placeholder="Cari nama alat..." aria-label="Cari alat" class="w-full text-xs pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C] focus:bg-white transition-all" />
    </div>

    <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
      <label class="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer select-none py-1 px-1">
        <input type="checkbox" bind:checked={showArchived} class="rounded border-stone-300 text-[#C2410C] focus:ring-[#C2410C]" />
        <span class="whitespace-nowrap">Tampilkan Arsip</span>
      </label>

      <button type="button" onclick={() => openDrawer("gear")} class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded-lg shadow-sm transition-colors whitespace-nowrap">+ Tambah Alat</button>
    </div>
  </div>

  {#if list.length}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each list as a (a.id)}
        {@const be = breakEven(a.modal, a.pendapatan)}
        {@const rows = servis[a.id] ?? []}
        <div class="bg-white rounded-xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between {a.is_active ? '' : 'opacity-60 bg-stone-50'}">
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <div>
                <h4 class="text-sm font-bold text-stone-900">{a.nama}</h4>
              </div>
              <span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border {be.cls} shrink-0">{be.label}</span>
            </div>

            <div class="grid grid-cols-3 gap-2 my-3 p-2.5 bg-stone-50 rounded-lg border border-stone-200 text-xs">
              <div>
                <span class="text-stone-500 text-[10px] block uppercase">Modal (Derived)</span>
                <strong class="font-mono text-stone-900 font-semibold">{rupiah(a.modal)}</strong>
                <span class="text-[10px] text-stone-500 block">Beli + Servis</span>
              </div>
              <div>
                <span class="text-stone-500 text-[10px] block uppercase">Pendapatan</span>
                <strong class="font-mono text-emerald-700 font-bold">{rupiah(a.pendapatan)}</strong>
              </div>
              <div>
                <span class="text-stone-500 text-[10px] block uppercase">Tarif Sewa</span>
                <strong class="font-mono text-stone-900 font-semibold">{rupiah(a.tarif_event)}</strong>
                <span class="text-[10px] text-stone-500 block">/ event</span>
              </div>
            </div>
          </div>

          <div class="border-t border-stone-200 pt-3">
            <div class="flex items-center justify-between">
              <button type="button" onclick={() => toggle(a.id)} aria-expanded={!!expanded[a.id]} class="text-xs font-semibold text-stone-700 hover:text-stone-900 flex items-center gap-1">
                <span>Riwayat Servis ({rows.length})</span>
                <svg class="w-3.5 h-3.5 transform transition-transform {expanded[a.id] ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
              </button>

              <button type="button" onclick={() => toggleArsip(a)} class="text-xs px-2 py-1 rounded border border-stone-200 hover:bg-stone-100 text-stone-600">
                {a.is_active ? "Arsipkan" : "Aktifkan"}
              </button>
            </div>

            {#if expanded[a.id]}
              <div class="mt-3 pt-3 border-t border-stone-200 space-y-3">
                <div class="flex items-center justify-between">
                  <h6 class="text-[11px] font-bold uppercase text-stone-600">Catatan Servis Terdaftar</h6>
                  <span class="text-[10px] text-stone-500">Biaya servis menambah modal</span>
                </div>
                {#if rows.length}
                  <ul class="space-y-1.5 text-xs">
                    {#each rows as s (s.id)}
                      <li class="p-2 bg-stone-100 rounded text-stone-800 flex justify-between items-start">
                        <div>
                          <div class="font-semibold">{s.keterangan || "(tanpa keterangan)"}</div>
                          <div class="text-[10px] text-stone-500">{tgl(s.tanggal)}</div>
                        </div>
                        <span class="font-mono font-bold text-red-700 shrink-0">+{rupiah(s.biaya)}</span>
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p class="text-xs text-stone-500 italic">Belum ada riwayat servis untuk alat ini.</p>
                {/if}

                <form class="bg-white p-2.5 rounded border border-stone-300 space-y-2 mt-2" onsubmit={(e) => simpanServis(a, e)}>
                  <div class="text-xs font-bold text-stone-800">Catat Servis Baru</div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input type="text" bind:value={svTeknisi} placeholder="Bengkel / Teknisi" class="text-xs p-1.5 border border-stone-300 rounded focus:border-[#C2410C]" />
                    <input type="date" required bind:value={svTanggal} class="text-xs p-1.5 border border-stone-300 rounded focus:border-[#C2410C]" />
                  </div>
                  <input type="text" required bind:value={svKeterangan} placeholder="Deskripsi kendala / sparepart" class="w-full text-xs p-1.5 border border-stone-300 rounded focus:border-[#C2410C]" />
                  <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input type="number" bind:value={svBiaya} placeholder="Biaya servis (Rp)" min="0" step="50000" required class="flex-1 text-xs p-1.5 border border-stone-300 rounded focus:border-[#C2410C]" />
                    <button type="submit" disabled={busyId === a.id} class="w-full sm:w-auto text-center text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] px-3 py-1.5 rounded transition-colors shrink-0 disabled:opacity-50">
                      {busyId === a.id ? "Menyimpan..." : "Simpan Servis"}
                    </button>
                  </div>
                </form>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="py-12 text-center text-stone-500 bg-white rounded-xl border border-stone-200">
      <p class="text-sm font-semibold text-stone-700">Tidak ada alat yang cocok dengan filter.</p>
      <p class="text-xs text-stone-500 mt-1">Coba sesuaikan kata kunci pencarian.</p>
    </div>
  {/if}
</section>
