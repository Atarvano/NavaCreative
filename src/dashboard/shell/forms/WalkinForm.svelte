<!-- Ember Walk-in Drawer: extracted from prototype buildWalkinForm.
     Maps explicit backend fields and retains realtime conflict warnings. Diskon defaults to 0. -->
<script>
  import { onMount, onDestroy } from "svelte";
  import { state as store, simpanTransaksi } from "../../lib/store.svelte.js";
  import { subtotal, rupiah, hariIni } from "../../lib/format.js";
  import { cariBentrok } from "../../lib/bentrok.js";
  import { setLiveReader, clearLiveReader } from "../../lib/liveDraft.js";
  import { closeDrawer } from "../../lib/ui.svelte.js";
  import BarisEditor from "./BarisEditor.svelte";

  let { prefill = null } = $props();

  const today = hariIni();
  let nama_project = $state(prefill?.nama_project ?? "");
  let nama_client = $state(prefill?.nama_client ?? "");
  let perusahaan_client = $state(prefill?.perusahaan_client ?? "");
  let tanggal_mulai = $state(prefill?.tanggal_mulai ?? today);
  let tanggal_selesai = $state(prefill?.tanggal_selesai ?? today);
  let lokasi = $state(prefill?.lokasi ?? "");
  let baris = $state(
    prefill?.baris ?? [
      { kategori: "PRODUCTION", jenis: "alat", alat_id: null, nama: "", qty: 1, satuan: "Hari", harga_satuan: 0 },
    ],
  );
  let busy = $state(false);

  const alat = $derived(store.alat);
  const total = $derived(subtotal(baris));

  // Realtime conflict warnings for gear rows (before save).
  const bentrokList = $derived(
    baris.flatMap((b) =>
      b.jenis === "alat" && b.alat_id
        ? cariBentrok(store.transaksi, "new", b.alat_id, tanggal_mulai, tanggal_selesai).map((t) => ({
            alat: alat.find((a) => a.id === b.alat_id)?.nama ?? b.nama,
            t,
          }))
        : [],
    ),
  );

  const snapshot = () => ({ nama_project, nama_client, perusahaan_client, tanggal_mulai, tanggal_selesai, lokasi, baris });

  onMount(() => setLiveReader("tx", snapshot));
  onDestroy(() => clearLiveReader("tx"));

  async function simpan(e) {
    e.preventDefault();
    if (!baris.length) return;
    busy = true;
    try {
      const r = await simpanTransaksi({
        nama_project: nama_project.trim(),
        nama_client: nama_client.trim(),
        perusahaan_client: perusahaan_client.trim(),
        tanggal_mulai: tanggal_mulai || undefined,
        tanggal_selesai: tanggal_selesai || undefined,
        lokasi: lokasi.trim(),
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
      });
      if (r.ok) closeDrawer();
    } finally {
      busy = false;
    }
  }
</script>

<form class="space-y-4" onsubmit={simpan}>
  <div class="space-y-3">
    <h5 class="text-xs font-bold uppercase tracking-wider text-stone-600">Informasi Proyek & Klien</h5>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-semibold text-stone-700 mb-1" for="walkin-project">Nama Proyek Event *</label>
        <input id="walkin-project" type="text" required bind:value={nama_project} placeholder="Contoh: Live Streaming Seminar" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-stone-700 mb-1" for="walkin-client">Nama Klien / Perusahaan *</label>
        <input id="walkin-client" type="text" required bind:value={nama_client} placeholder="Contoh: PT Kreasi Bangsa" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label class="block text-xs font-semibold text-stone-700 mb-1" for="walkin-perusahaan">Perusahaan Klien</label>
        <input id="walkin-perusahaan" type="text" bind:value={perusahaan_client} placeholder="Opsional" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-stone-700 mb-1" for="walkin-mulai">Mulai Sewa *</label>
        <input id="walkin-mulai" type="date" required bind:value={tanggal_mulai} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-stone-700 mb-1" for="walkin-selesai">Selesai Sewa *</label>
        <input id="walkin-selesai" type="date" required bind:value={tanggal_selesai} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
      </div>
    </div>
    <div>
      <label class="block text-xs font-semibold text-stone-700 mb-1" for="walkin-lokasi">Lokasi Produksi / Venue</label>
      <input id="walkin-lokasi" type="text" bind:value={lokasi} placeholder="Gedung / Hotel / Alamat Acara" class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
    </div>
  </div>

  {#if bentrokList.length}
    <div class="p-3 bg-amber-50 border border-amber-300 rounded text-amber-900 text-xs space-y-1" role="alert">
      <p class="font-bold">Deteksi Peringatan Bentrok Jadwal!</p>
      {#each bentrokList as c (c.t.id)}
        <div>* {c.alat} sudah dijadwalkan pada {c.t.tanggal_mulai} s/d {c.t.tanggal_selesai} untuk proyek "{c.t.nama_project}".</div>
      {/each}
    </div>
  {/if}

  <div class="space-y-3 pt-3 border-t border-stone-200">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
      <h5 class="text-xs font-bold uppercase tracking-wider text-stone-600">Rincian Komponen Sewa</h5>
    </div>

    <BarisEditor bind:value={baris} {alat} />

    <div class="p-3 bg-stone-100 rounded-lg space-y-1.5 text-xs text-stone-700 border border-stone-200">
      <div class="flex justify-between pt-1 border-t border-stone-300 text-sm font-bold text-stone-900">
        <span>Total Estimasi Transaksi:</span>
        <span class="font-mono text-[#C2410C]">{rupiah(total)}</span>
      </div>
    </div>
  </div>

  <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-stone-200">
    <button type="button" onclick={closeDrawer} class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded border border-stone-300">Batal</button>
    <button type="submit" disabled={busy || !baris.length} class="w-full sm:w-auto text-center px-5 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded shadow transition-colors disabled:opacity-50">
      {busy ? "Menyimpan..." : "Simpan Transaksi Walk-in"}
    </button>
  </div>
</form>
