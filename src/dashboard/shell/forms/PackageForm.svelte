<!-- Ember Package Drawer: extracted from prototype buildPackageForm.
     Implicit backend category defaults to PRODUCTION. -->
<script>
  import { simpanPaket } from "../../lib/store.svelte.js";
  import { closeDrawer } from "../../lib/ui.svelte.js";
  import BarisEditor from "./BarisEditor.svelte";

  let { data = null } = $props();

  let nama = $state(data?.nama ?? "");
  let deskripsi = $state(data?.deskripsi ?? "");
  let baris = $state(
    data?.baris?.map((b) => ({ ...b })) ?? [
      { kategori: "PRODUCTION", jenis: "alat", alat_id: null, nama: "", qty: 1, satuan: "Hari", harga_satuan: 0 },
    ],
  );
  let busy = $state(false);

  async function simpan(e) {
    e.preventDefault();
    busy = true;
    try {
      const r = await simpanPaket({
        editing: !!data,
        targetId: data?.id,
        payload: {
          nama: nama.trim(),
          deskripsi: deskripsi.trim(),
          baris: baris
            .filter((b) => b.nama.trim())
            .map((b) => ({
              kategori: b.kategori || "PRODUCTION",
              jenis: b.jenis,
              alat_id: b.jenis === "alat" ? b.alat_id : null,
              nama: b.nama.trim(),
              qty: Number(b.qty) || 1,
              satuan: b.satuan || "",
              harga_satuan: Number(b.harga_satuan) || 0,
            })),
        },
      });
      if (r.ok) closeDrawer();
    } finally {
      busy = false;
    }
  }
</script>

<form class="space-y-4" onsubmit={simpan}>
  <div>
    <label class="block text-xs font-semibold text-stone-700 mb-1" for="pkg-nama">Nama Paket Template *</label>
    <input id="pkg-nama" type="text" required bind:value={nama} placeholder="Contoh: Paket Live Streaming 2 Kamera" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
  </div>
  <div>
    <label class="block text-xs font-semibold text-stone-700 mb-1" for="pkg-desk">Deskripsi Singkat</label>
    <textarea id="pkg-desk" rows="2" bind:value={deskripsi} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]"></textarea>
  </div>

  <div class="space-y-3 pt-3 border-t border-stone-200">
    <div class="flex items-center justify-between">
      <h5 class="text-xs font-bold uppercase tracking-wider text-stone-600">Komponen Paket (Bebas Kategori)</h5>
    </div>
    <BarisEditor bind:value={baris} alat={[]} />
  </div>

  <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-stone-200">
    <button type="button" onclick={closeDrawer} class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded border border-stone-300">Batal</button>
    <button type="submit" disabled={busy} class="w-full sm:w-auto text-center px-5 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded shadow transition-colors disabled:opacity-50">
      {busy ? "Menyimpan..." : "Simpan Template Paket"}
    </button>
  </div>
</form>
