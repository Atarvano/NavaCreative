<!-- Ember Payment Drawer: extracted from prototype buildPaymentForm.
     Added reference column; Payment labels (DP/Installment) are server-calculated. -->
<script>
  import { bayar } from "../../lib/store.svelte.js";
  import { rupiah, hariIni } from "../../lib/format.js";
  import { closeDrawer } from "../../lib/ui.svelte.js";

  let { data } = $props();

  let jumlah = $state(data.sisa > 0 ? data.sisa : "");
  let tanggal = $state(hariIni());
  let metode = $state("transfer");
  let referensi = $state("");
  let busy = $state(false);

  async function simpan(e) {
    e.preventDefault();
    busy = true;
    try {
      const r = await bayar(data, {
        tanggal,
        jumlah: Number(jumlah),
        metode,
        referensi: referensi.trim(),
      });
      if (r.ok) closeDrawer();
    } finally {
      busy = false;
    }
  }
</script>

<form class="space-y-4" onsubmit={simpan}>
  <div class="p-3 bg-stone-100 rounded text-xs space-y-1 border border-stone-200">
    <div class="flex justify-between"><span>Nomor Invoice:</span><strong class="font-mono">{data.nomor}</strong></div>
    <div class="flex justify-between"><span>Total Tagihan:</span><strong class="font-mono">{rupiah(data.total)}</strong></div>
    <div class="flex justify-between"><span>Sisa Tagihan:</span><strong class="font-mono text-red-700">{rupiah(data.sisa)}</strong></div>
  </div>

  <div>
    <label class="block text-xs font-semibold text-stone-700 mb-1" for="pay-jumlah">Nominal Pembayaran Masuk (Rp) *</label>
    <input id="pay-jumlah" type="number" required bind:value={jumlah} min="1" step="1000" placeholder="Minus = koreksi (misal -250000)" class="w-full text-sm font-mono font-bold p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    <span class="text-[10px] text-stone-500">Angka minus tercatat sebagai koreksi pengurang, bukan pembayaran.</span>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="pay-tanggal">Tanggal Terima</label>
      <input id="pay-tanggal" type="date" required bind:value={tanggal} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    </div>
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="pay-metode">Metode Bayar</label>
      <select id="pay-metode" bind:value={metode} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]">
        <option value="transfer">Transfer Bank</option>
        <option value="cash">Tunai / Cash</option>
      </select>
    </div>
  </div>

  <div>
    <label class="block text-xs font-semibold text-stone-700 mb-1" for="pay-referensi">Catatan / Bukti Transfer</label>
    <input id="pay-referensi" type="text" bind:value={referensi} placeholder="Misal: Mutasi BCA a.n PT Klien" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
  </div>

  <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-stone-200">
    <button type="button" onclick={closeDrawer} class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded border border-stone-300">Batal</button>
    <button type="submit" disabled={busy} class="w-full sm:w-auto text-center px-5 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded shadow transition-colors disabled:opacity-50">
      {busy ? "Menyimpan..." : "Konfirmasi Pembayaran"}
    </button>
  </div>
</form>
