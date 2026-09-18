<!-- Ember RAB Drawer: extracted from prototype buildRABForm.
     Omit validUntil and clientContact (using perusahaan_client instead) per API limits. -->
<script>
  import { onMount, onDestroy } from "svelte";
  import { state as store, simpanRab, ubahRab, dariPaket } from "../../lib/store.svelte.js";
  import { subtotal, rupiah, hariIni } from "../../lib/format.js";
  import { setLiveReader, clearLiveReader } from "../../lib/liveDraft.js";
  import { closeDrawer } from "../../lib/ui.svelte.js";
  import BarisEditor from "./BarisEditor.svelte";

  let { data = null, prefill = null } = $props();

  const today = hariIni();
  let nama_project = $state(data?.nama_project ?? prefill?.nama_project ?? "");
  let nama_client = $state(data?.nama_client ?? prefill?.nama_client ?? "");
  let perusahaan_client = $state(data?.perusahaan_client ?? prefill?.perusahaan_client ?? "");
  let tanggal_rab = $state(data?.tanggal_rab ?? prefill?.tanggal_rab ?? today);
  let diskon = $state(data?.diskon ?? prefill?.diskon ?? 0);
  let catatan = $state(data?.catatan ?? prefill?.catatan ?? "");
  let baris = $state(
    data?.baris?.map((b) => ({ ...b })) ??
      prefill?.baris?.map((b) => ({ ...b })) ?? [
        { kategori: "PRODUCTION", jenis: "alat", alat_id: null, nama: "", qty: 1, satuan: "Hari", harga_satuan: 0 },
      ],
  );
  let paketPick = $state("");
  let busy = $state(false);

  const sub = $derived(subtotal(baris));
  const finalTotal = $derived(Math.max(0, sub - (Number(diskon) || 0)));

  const snapshot = () => ({ nama_project, nama_client, perusahaan_client, tanggal_rab, diskon, catatan, baris });
  onMount(() => setLiveReader("rab", snapshot));
  onDestroy(() => clearLiveReader("rab"));

  async function terapkanPaket() {
    if (!paketPick) return;
    const p = store.paket.find((x) => x.id === Number(paketPick));
    if (!p) return;
    const d = await dariPaket(p);
    if (!d) return;
    baris = d.baris.map((b) => ({ ...b }));
    if (!nama_project.trim()) nama_project = d.nama_project ?? nama_project;
  }

  function payload() {
    return {
      nama_project: nama_project.trim(),
      nama_client: nama_client.trim(),
      perusahaan_client: perusahaan_client.trim(),
      tanggal_rab,
      diskon: Number(diskon) || 0,
      catatan,
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
    };
  }

  async function simpan(e) {
    e.preventDefault();
    busy = true;
    try {
      const r = data ? await ubahRab(data.id, payload()) : await simpanRab(payload());
      if (r.ok) closeDrawer();
    } finally {
      busy = false;
    }
  }
</script>

<form class="space-y-4" onsubmit={simpan}>
  <div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <h5 class="text-xs font-bold uppercase tracking-wider text-stone-600">Template / Data Cepat</h5>
      <div class="flex items-center gap-2">
        <select bind:value={paketPick} class="text-xs p-1.5 border border-stone-300 rounded focus:border-[#C2410C]" aria-label="Salin dari paket">
          <option value="">-- Salin dari Paket --</option>
          {#each store.paket as p (p.id)}
            <option value={p.id}>{p.nama}</option>
          {/each}
        </select>
        <button type="button" onclick={terapkanPaket} class="text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] px-2.5 py-1.5 rounded">Terapkan</button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-semibold text-stone-700 mb-1" for="rab-project">Nama Proyek / Penawaran *</label>
        <input id="rab-project" type="text" required bind:value={nama_project} placeholder="Contoh: Paket Live Multicam Festival" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-stone-700 mb-1" for="rab-client">Klien / Lembaga *</label>
        <input id="rab-client" type="text" required bind:value={nama_client} placeholder="Nama klien atau instansi" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label class="block text-xs font-semibold text-stone-700 mb-1" for="rab-perusahaan">Perusahaan Klien</label>
        <input id="rab-perusahaan" type="text" bind:value={perusahaan_client} placeholder="Opsional" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-stone-700 mb-1" for="rab-tanggal">Tanggal RAB</label>
        <input id="rab-tanggal" type="date" bind:value={tanggal_rab} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-stone-700 mb-1" for="rab-diskon">Diskon (Rp)</label>
        <input id="rab-diskon" type="number" min="0" step="50000" bind:value={diskon} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C] text-right font-mono font-bold" />
      </div>
    </div>
  </div>

  <div class="space-y-3 pt-3 border-t border-stone-200">
    <div class="flex items-center justify-between">
      <h5 class="text-xs font-bold uppercase tracking-wider text-stone-600">Rincian Komponen RAB</h5>
    </div>

    <BarisEditor bind:value={baris} alat={store.alat} />

    <div class="p-3 bg-stone-100 rounded-lg space-y-2 text-xs border border-stone-200">
      <div class="flex justify-between items-center">
        <span>Subtotal Rincian:</span>
        <strong class="font-mono text-stone-900">{rupiah(sub)}</strong>
      </div>
      <div class="flex justify-between pt-1 border-t border-stone-300 text-sm font-bold text-stone-900">
        <span>Total Estimasi Akhir:</span>
        <span class="font-mono text-[#C2410C]">{rupiah(finalTotal)}</span>
      </div>
    </div>

    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="rab-catatan">Catatan Penawaran</label>
      <textarea id="rab-catatan" rows="2" bind:value={catatan} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]"></textarea>
    </div>
  </div>

  <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-stone-200">
    <button type="button" onclick={closeDrawer} class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded border border-stone-300">Batal</button>
    <button type="submit" disabled={busy} class="w-full sm:w-auto text-center px-5 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded shadow transition-colors disabled:opacity-50">
      {busy ? "Menyimpan..." : data ? "Simpan Perubahan RAB" : "Terbitkan Dokumen RAB"}
    </button>
  </div>
</form>
