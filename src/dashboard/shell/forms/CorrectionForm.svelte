<!-- Drawer Koreksi Ember: comot buildCorrectionForm prototipe.
     Mapping backend (bukan redesign): API tidak punya endpoint koreksi
     terpisah; koreksi = pembayaran minus (POST /bayar jumlah negatif, M1).
     Kolom keterangan prototipe dipetakan ke referensi. -->
<script>
  import { bayar } from "../../lib/store.svelte.js";
  import { hariIni } from "../../lib/format.js";
  import { closeDrawer } from "../../lib/ui.svelte.js";

  let { data } = $props();

  let note = $state("");
  let amount = $state("");
  let date = $state(hariIni());
  let busy = $state(false);

  async function simpan(e) {
    e.preventDefault();
    const raw = Number(amount) || 0;
    if (raw <= 0) return;
    busy = true;
    try {
      const r = await bayar(data, {
        tanggal: date,
        jumlah: -Math.abs(raw),
        metode: "transfer",
        referensi: note.trim(),
      });
      if (r.ok) closeDrawer();
    } finally {
      busy = false;
    }
  }
</script>

<form class="space-y-4" onsubmit={simpan}>
  <div class="p-3 bg-stone-100 rounded text-xs space-y-1 border border-stone-200">
    <p class="font-bold text-stone-800">Prinsip Integritas Keuangan</p>
    <p class="text-stone-600">Baris invoice yang sudah terbit dikunci dan tidak boleh dihapus fisik. Penyesuaian nilai dicatat melalui baris minus (koreksi nilai negatif).</p>
  </div>

  <div>
    <label class="block text-xs font-semibold text-stone-700 mb-1" for="cor-note">Keterangan Koreksi / Penyesuaian *</label>
    <input id="cor-note" type="text" required bind:value={note} placeholder="Contoh: Koreksi keterlambatan stand-by kru / Diskon retur" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="cor-amount">Nominal Pemotongan (Rp) *</label>
      <input id="cor-amount" type="number" required min="10000" step="50000" bind:value={amount} placeholder="250000" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
      <span class="text-[10px] text-stone-500">Akan otomatis dihitung sebagai pengurang (-).</span>
    </div>
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="cor-date">Tanggal Koreksi</label>
      <input id="cor-date" type="date" required bind:value={date} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    </div>
  </div>

  <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-stone-200">
    <button type="button" onclick={closeDrawer} class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded border border-stone-300">Batal</button>
    <button type="submit" disabled={busy} class="w-full sm:w-auto text-center px-5 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded shadow transition-colors disabled:opacity-50">
      {busy ? "Menyimpan..." : "Tambahkan Baris Koreksi"}
    </button>
  </div>
</form>
