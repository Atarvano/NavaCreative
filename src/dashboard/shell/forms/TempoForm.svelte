<!-- Ember Tempo Drawer: extracted from prototype buildTempoForm.
     Omit reason column as API only accepts jatuh_tempo. Overdue is derived from tempo. -->
<script>
  import { simpanTempo } from "../../lib/store.svelte.js";
  import { tgl } from "../../lib/format.js";
  import { closeDrawer } from "../../lib/ui.svelte.js";

  let { data } = $props();

  let jatuh_tempo = $state(data.jatuh_tempo);
  let busy = $state(false);

  async function simpan(e) {
    e.preventDefault();
    busy = true;
    try {
      const r = await simpanTempo(data, jatuh_tempo);
      if (r.ok) closeDrawer();
    } finally {
      busy = false;
    }
  }
</script>

<form class="space-y-4" onsubmit={simpan}>
  <div class="p-3 bg-stone-100 rounded text-xs space-y-1 border border-stone-200">
    <div class="flex justify-between"><span>Nomor Invoice:</span><strong class="font-mono">{data.nomor}</strong></div>
    <div class="flex justify-between"><span>Tempo Saat Ini:</span><strong class="font-mono">{tgl(data.jatuh_tempo)}</strong></div>
  </div>

  <div>
    <label class="block text-xs font-semibold text-stone-700 mb-1" for="tempo-baru">Tanggal Jatuh Tempo Baru *</label>
    <input id="tempo-baru" type="date" required bind:value={jatuh_tempo} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
  </div>

  <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-stone-200">
    <button type="button" onclick={closeDrawer} class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded border border-stone-300">Batal</button>
    <button type="submit" disabled={busy} class="w-full sm:w-auto text-center px-5 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded shadow transition-colors disabled:opacity-50">
      {busy ? "Menyimpan..." : "Perbarui Tempo"}
    </button>
  </div>
</form>
