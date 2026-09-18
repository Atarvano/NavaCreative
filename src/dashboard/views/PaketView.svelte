<!-- View Paket Ember: comot struktur index.html.
     Data dari API (nama/deskripsi/baris/total). Buat RAB dari Paket via
     /ke-rab lalu buka drawer RAB terisi (ikut prototipe). -->
<script>
  import { state as store, dariPaket } from "../lib/store.svelte.js";
  import { subtotal, subJenis, rupiah } from "../lib/format.js";
  import { openDrawer } from "../lib/ui.svelte.js";

  let busyId = $state(null);

  async function buatRab(p) {
    busyId = p.id;
    try {
      const d = await dariPaket(p);
      if (d) openDrawer("rab", null, { nama_project: d.nama_project, baris: d.baris });
    } finally {
      busyId = null;
    }
  }
</script>

<section id="view-paket" class="view-panel space-y-4" aria-label="Paket template">
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
    <div>
      <h3 class="text-sm font-bold font-display text-stone-900">Template Paket Sewa Reusable</h3>
      <p class="text-xs text-stone-500">Template baris alat, jasa, dan biaya yang siap disalin ke RAB tanpa mengubah data lama.</p>
    </div>
    <button type="button" onclick={() => openDrawer("package")} class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded-lg shadow-sm transition-colors whitespace-nowrap">+ Paket Baru</button>
  </div>

  {#if store.paket.length}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each store.paket as p (p.id)}
        {@const sj = subJenis(p.baris)}
        <div class="bg-white rounded-xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <h4 class="text-base font-bold text-stone-900 font-display">{p.nama}</h4>
              <span class="font-mono text-sm font-bold text-[#C2410C] shrink-0">{rupiah(p.total ?? subtotal(p.baris))}</span>
            </div>
            {#if p.deskripsi}<p class="text-xs text-stone-600 mb-4">{p.deskripsi}</p>{/if}

            <div class="border-t border-stone-200 pt-3 mb-4 space-y-2">
              <div class="flex gap-3 text-[11px] text-stone-600 font-medium">
                <span>Alat: <strong class="text-stone-900">{rupiah(sj.Alat)}</strong></span>
                <span>Jasa: <strong class="text-stone-900">{rupiah(sj.Jasa)}</strong></span>
                <span>Biaya: <strong class="text-stone-900">{rupiah(sj.Biaya)}</strong></span>
              </div>
              <ul class="text-xs text-stone-700 space-y-1 divide-y divide-stone-100">
                {#each p.baris.slice(0, 4) as b (b.id)}
                  <li class="flex justify-between pt-1">
                    <span class="truncate pr-2">{b.nama}</span>
                    <span class="font-mono text-stone-500 shrink-0">{b.qty} {b.satuan}</span>
                  </li>
                {/each}
                {#if p.baris.length > 4}
                  <li class="pt-1 text-[11px] text-stone-500 italic">+ {p.baris.length - 4} baris komponen lainnya...</li>
                {/if}
              </ul>
            </div>
          </div>

          <div class="flex items-center gap-2 border-t border-stone-200 pt-3">
            <button type="button" disabled={busyId === p.id} onclick={() => buatRab(p)} class="flex-1 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] py-2 rounded-lg transition-colors text-center disabled:opacity-50">
              {busyId === p.id ? "Menyalin..." : "Buat RAB dari Paket"}
            </button>
            <button type="button" onclick={() => openDrawer("package", p)} class="text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-lg border border-stone-300 transition-colors">Ubah</button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="py-12 text-center text-stone-500 bg-white rounded-xl border border-stone-200">
      <p class="text-sm font-semibold text-stone-700">Belum ada template paket.</p>
      <p class="text-xs mt-1">Gunakan tombol + Paket Baru untuk menyusun template reusable.</p>
    </div>
  {/if}
</section>
