<!-- View RAB Ember: comot struktur index.html.
     Mapping backend: nomor/tanggal_rab/nama_project/nama_client + baris;
     tanpa validUntil (API tidak punya). Status via PATCH langsung (Ditolak
     dan Revisi ikut prototipe), approved terkunci lalu tombol Jadikan
     Transaksi. Cetak ikut lembar RAB Ember. -->
<script>
  import { state as store, statusRab, setujui } from "../lib/store.svelte.js";
  import { rupiah, tgl } from "../lib/format.js";
  import { lembarRab } from "../lib/print-ember.js";
  import { openDrawer, showPrint } from "../lib/ui.svelte.js";
  import { go } from "../lib/nav.svelte.js";

  let search = $state("");
  let status = $state("semua");
  let sort = $state("newest");
  let busyId = $state(null);

  const list = $derived.by(() => {
    let rows = [...store.rabs];
    const q = search.trim().toLowerCase();
    if (q)
      rows = rows.filter((r) =>
        [r.nomor, r.nama_project, r.nama_client].filter(Boolean).join(" ").toLowerCase().includes(q),
      );
    if (status !== "semua") rows = rows.filter((r) => r.status === status);
    if (sort === "highest") rows.sort((a, b) => b.total - a.total);
    else if (sort === "lowest") rows.sort((a, b) => a.total - b.total);
    else rows.sort((a, b) => b.id - a.id);
    return rows;
  });

  const badge = (s) =>
    ({
      draft: "bg-stone-100 text-stone-800 border-stone-200",
      sent: "bg-blue-100 text-blue-800 border-blue-200",
      approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
    })[s] ?? "bg-stone-100 text-stone-700 border-stone-200";

  async function gantiStatus(r, s) {
    busyId = r.id;
    try {
      await statusRab(r, s);
    } finally {
      busyId = null;
    }
  }

  async function setujuiRab(r) {
    busyId = r.id;
    try {
      const id = await setujui(r);
      if (id != null) go("transaksi");
    } finally {
      busyId = null;
    }
  }

  function cetakRab(r) {
    showPrint("Cetak Dokumen RAB", lembarRab(r, store.settings));
  }
</script>

<section id="view-rab" class="view-panel space-y-4" aria-label="RAB estimasi">
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
    <div class="relative flex-1 max-w-md w-full">
      <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400" aria-hidden="true">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </span>
      <input type="text" bind:value={search} placeholder="Cari nomor RAB, klien, proyek..." aria-label="Cari RAB" class="w-full text-xs pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C] focus:bg-white transition-all" />
    </div>

    <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
      <select bind:value={status} aria-label="Filter status RAB" class="flex-1 sm:flex-none text-xs p-2 border border-stone-300 rounded-lg focus:border-[#C2410C] bg-white min-w-[120px]">
        <option value="semua">Semua Status</option>
        <option value="draft">Draft</option>
        <option value="sent">Sent (Terkirim)</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>

      <select bind:value={sort} aria-label="Urut RAB" class="flex-1 sm:flex-none text-xs p-2 border border-stone-300 rounded-lg focus:border-[#C2410C] bg-white min-w-[120px]">
        <option value="newest">Terbaru</option>
        <option value="highest">Total Tertinggi</option>
        <option value="lowest">Total Terendah</option>
      </select>

      <button type="button" onclick={() => openDrawer("rab")} class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded-lg shadow-sm transition-colors whitespace-nowrap">+ RAB Baru</button>
    </div>
  </div>

  <div class="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full min-w-[680px] text-left text-xs">
        <thead class="bg-stone-50 border-b border-stone-200 text-stone-600">
          <tr>
            <th class="py-3 px-3 font-semibold">Nomor RAB</th>
            <th class="py-3 px-3 font-semibold">Proyek & Klien</th>
            <th class="py-3 px-3 font-semibold">Tanggal</th>
            <th class="py-3 px-3 font-semibold">Total Nilai</th>
            <th class="py-3 px-3 font-semibold">Status</th>
            <th class="py-3 px-3 font-semibold text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {#each list as r (r.id)}
            <tr class="border-b border-stone-200 hover:bg-stone-50/50 transition-colors">
              <td class="py-3 px-3 font-mono text-xs text-stone-600">{r.nomor}</td>
              <td class="py-3 px-3">
                <div class="text-sm font-semibold text-stone-900">{r.nama_project}</div>
                <div class="text-xs text-stone-500">{r.nama_client}</div>
              </td>
              <td class="py-3 px-3 text-xs text-stone-600">
                <div>Dibuat: {tgl(r.tanggal_rab)}</div>
              </td>
              <td class="py-3 px-3 font-mono text-xs font-semibold text-stone-900">
                {rupiah(r.total)}
                {#if r.diskon}<div class="text-[10px] text-emerald-700 font-sans">Disc: {rupiah(r.diskon)}</div>{/if}
              </td>
              <td class="py-3 px-3">
                <div class="flex items-center gap-1.5">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border {badge(r.status)}">{r.status}</span>
                  {#if r.status !== "approved"}
                    <select
                      value={r.status}
                      disabled={busyId === r.id}
                      onchange={(e) => gantiStatus(r, e.target.value)}
                      aria-label="Ubah status RAB {r.nomor}"
                      class="text-xs bg-white border border-stone-300 rounded px-1.5 py-0.5"
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  {/if}
                </div>
              </td>
              <td class="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                {#if r.status === "approved"}
                  <button type="button" disabled={busyId === r.id} onclick={() => setujuiRab(r)} class="text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1.5 rounded transition-colors disabled:opacity-50">Jadikan Transaksi</button>
                {/if}
                <button type="button" onclick={() => cetakRab(r)} class="text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded border border-stone-300 transition-colors">Cetak RAB</button>
                {#if r.status !== "approved"}
                  <button type="button" onclick={() => openDrawer("rab", r)} class="text-xs font-semibold text-[#C2410C] hover:text-[#9A3412] px-2 py-1.5 rounded border border-stone-200 hover:border-[#C2410C]">Ubah</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if !list.length}
      <div class="py-12 text-center text-stone-500">
        <p class="text-sm font-semibold text-stone-700">Tidak ada dokumen RAB yang ditemukan.</p>
        <p class="text-xs mt-1">Gunakan tombol + RAB Baru untuk menyusun estimasi penawaran biaya.</p>
      </div>
    {/if}
  </div>
</section>
