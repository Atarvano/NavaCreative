<!-- Ember Gear Drawer: extracted from prototype buildGearForm.
     Omit category and serial numbers as API only accepts nama, harga_beli, and tarif_event. -->
<script>
  import { addAlat } from "../../lib/store.svelte.js";
  import { closeDrawer } from "../../lib/ui.svelte.js";

  let nama = $state("");
  let harga_beli = $state("");
  let tarif_event = $state("");
  let busy = $state(false);

  async function simpan(e) {
    e.preventDefault();
    busy = true;
    try {
      const data = await addAlat({
        nama: nama.trim(),
        harga_beli: Number(harga_beli) || 0,
        tarif_event: Number(tarif_event) || 0,
      });
      if (data) closeDrawer();
    } finally {
      busy = false;
    }
  }
</script>

<form class="space-y-4" onsubmit={simpan}>
  <div>
    <label class="block text-xs font-semibold text-stone-700 mb-1" for="gear-nama">Nama Alat Multimedia *</label>
    <input id="gear-nama" type="text" required bind:value={nama} placeholder="Contoh: Sony NXR-100" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="gear-beli">Harga Beli Modal Awal (Rp) *</label>
      <input id="gear-beli" type="number" required min="0" step="100000" bind:value={harga_beli} placeholder="15000000" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    </div>
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="gear-tarif">Tarif Sewa per Event (Rp) *</label>
      <input id="gear-tarif" type="number" required min="0" step="50000" bind:value={tarif_event} placeholder="500000" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    </div>
  </div>

  <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-stone-200">
    <button type="button" onclick={closeDrawer} class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded border border-stone-300">Batal</button>
    <button type="submit" disabled={busy} class="w-full sm:w-auto text-center px-5 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded shadow transition-colors disabled:opacity-50">
      {busy ? "Menyimpan..." : "Simpan Alat ke Inventaris"}
    </button>
  </div>
</form>
