<!-- Ember Brief Drawer: extracted from prototype buildBriefForm.
     Maps API fields not present in prototype (dos/donts/lokasi/style/notes) to existing classes. -->
<script>
  import { onMount, onDestroy } from "svelte";
  import { state as store, muatBrief, simpanBrief } from "../../lib/store.svelte.js";
  import { setLiveReader, clearLiveReader } from "../../lib/liveDraft.js";
  import { hapusDraft } from "../../lib/draft.js";
  import { closeDrawer, showPrint } from "../../lib/ui.svelte.js";
  import { lembarBrief } from "../../lib/print-ember.js";

  let { data, prefill = null } = $props();

  let form = $state({
    objective: prefill?.objective ?? "",
    audience: prefill?.audience ?? "",
    style: prefill?.style ?? "",
    mood: prefill?.mood ?? "",
    dos: prefill?.dos ?? prefill?.doList ?? "",
    donts: prefill?.donts ?? prefill?.dontList ?? "",
    lokasi: prefill?.lokasi ?? prefill?.location ?? data?.lokasi ?? "",
    talent: prefill?.talent ?? "",
    deliverables: prefill?.deliverables ?? "",
    deadline: prefill?.deadline ?? data?.tanggal_selesai ?? "",
    notes: prefill?.notes ?? "",
  });
  let loaded = $state(!!prefill);
  let busy = $state(false);

  onMount(async () => {
    setLiveReader("brief", () => {
      const filled = Object.values(form).some((v) => String(v ?? "").trim());
      return filled ? { transaksi_id: data.id, form: { ...form } } : null;
    });
    if (!prefill) {
      const b = await muatBrief(data.id);
      if (b) form = { ...form, ...b };
      loaded = true;
    }
  });
  onDestroy(() => clearLiveReader("brief"));

  async function simpan(e) {
    e.preventDefault();
    busy = true;
    try {
      const r = await simpanBrief(data.id, { ...form });
      if (r.ok) {
        hapusDraft("brief");
        closeDrawer();
      }
    } finally {
      busy = false;
    }
  }

  function cetakBrief() {
    showPrint("Cetak Dokumen Brief Pra-Produksi", lembarBrief(data, form, store.settings));
  }
</script>

<form class="space-y-4" onsubmit={simpan}>
  <div class="p-3 bg-stone-100 rounded text-xs text-stone-600 border border-stone-200">
    <p class="font-semibold text-stone-800">Dokumen Kerja Pra-Produksi</p>
    <p>Dokumen ini murni memuat arahan teknis dan kreatif untuk kru lapangan, tanpa menyentuh rincian biaya atau uang.</p>
  </div>

  {#if !loaded}
    <p class="text-xs text-stone-500">Memuat brief...</p>
  {/if}

  <div>
    <label class="block text-xs font-semibold text-stone-700 mb-1" for="brief-objective">Objective / Tujuan Utama Proyek</label>
    <textarea id="brief-objective" rows="2" required bind:value={form.objective} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]"></textarea>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="brief-audience">Target Audience</label>
      <input id="brief-audience" type="text" bind:value={form.audience} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    </div>
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="brief-mood">Style / Mood Visual</label>
      <input id="brief-mood" type="text" bind:value={form.mood} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    </div>
  </div>

  <div>
    <label class="block text-xs font-semibold text-stone-700 mb-1" for="brief-style">Style Produksi</label>
    <input id="brief-style" type="text" bind:value={form.style} placeholder="Misal: sinematik warm, korporat formal" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-semibold text-emerald-800 mb-1" for="brief-dos">Hal yang Harus Dilakukan (DO)</label>
      <textarea id="brief-dos" rows="2" bind:value={form.dos} class="w-full text-xs p-2 border border-emerald-300 rounded focus:border-emerald-600 bg-emerald-50/40"></textarea>
    </div>
    <div>
      <label class="block text-xs font-semibold text-red-800 mb-1" for="brief-donts">Hal yang Dilarang (DON'T)</label>
      <textarea id="brief-donts" rows="2" bind:value={form.donts} class="w-full text-xs p-2 border border-red-300 rounded focus:border-red-600 bg-red-50/40"></textarea>
    </div>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="brief-lokasi">Lokasi Produksi / Set</label>
      <input id="brief-lokasi" type="text" bind:value={form.lokasi} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    </div>
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="brief-talent">Talent / Kru yang Bertugas</label>
      <input id="brief-talent" type="text" bind:value={form.talent} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    </div>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="brief-deliver">Deliverables (Hasil Akhir)</label>
      <input id="brief-deliver" type="text" bind:value={form.deliverables} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    </div>
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="brief-deadline">Deadline Penyerahan</label>
      <input id="brief-deadline" type="date" bind:value={form.deadline} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    </div>
  </div>

  <div>
    <label class="block text-xs font-semibold text-stone-700 mb-1" for="brief-notes">Catatan Tambahan</label>
    <textarea id="brief-notes" rows="2" bind:value={form.notes} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]"></textarea>
  </div>

  <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-4 border-t border-stone-200">
    <button type="button" onclick={cetakBrief} class="w-full sm:w-auto text-center px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300">Cetak Brief Dokumen</button>
    <div class="flex items-center gap-2 w-full sm:w-auto">
      <button type="button" onclick={closeDrawer} class="flex-1 sm:flex-none text-center px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded border border-stone-300">Tutup</button>
      <button type="submit" disabled={busy} class="flex-1 sm:flex-none text-center px-5 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded shadow transition-colors disabled:opacity-50">{busy ? "Menyimpan..." : "Simpan Brief"}</button>
    </div>
  </div>
</form>
