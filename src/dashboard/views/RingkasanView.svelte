<!-- View Ringkasan Ember: comot struktur index.html.
     Data dari /api/ringkasan (kas bulan ini, piutang, per_alat, job_aktif,
     overdue + belum_lunas, recent), bukan hitungan localStorage.
     Bendanya: pendingFilter untuk lompatan terfilter, pendingExpand untuk
     membuka baris dari Perhatian/Transaksi terbaru, bentrok dari helper. -->
<script>
  import { state as store } from "../lib/store.svelte.js";
  import { pendingFilter, pendingExpand, go } from "../lib/nav.svelte.js";
  import { rupiah, tgl, bulanLabel, isOverdue } from "../lib/format.js";
  import { semuaBentrok } from "../lib/bentrok.js";

  const ringkasan = $derived(store.ringkasan);
  const bulan = $derived(bulanLabel(ringkasan?.kas_bulan));

  // Perhatian = overdue + bentrok jadwal (ikut prototipe: dua sumber).
  const bentroks = $derived(semuaBentrok(store.transaksi, store.alat));
  const overdueList = $derived(
    (ringkasan?.belum_lunas ?? []).filter((b) => isOverdue(b.jatuh_tempo, b.sisa)),
  );

  function keInvoice(status, expandId = null) {
    pendingFilter.invoice = status;
    if (expandId != null) pendingExpand.invoice = expandId;
    go("invoice");
  }

  function keTransaksi(status, expandId = null) {
    pendingFilter.transaksi = status;
    if (expandId != null) pendingExpand.transaksi = expandId;
    go("transaksi");
  }
</script>

<section id="view-ringkasan" class="view-panel space-y-6" aria-label="Ringkasan operasional">
  {#if !ringkasan}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="status" aria-label="Memuat ringkasan">
      {#each [1, 2, 3, 4] as i (i)}
        <div class="bg-white rounded-xl border border-stone-200 p-5"><div class="skeleton-bar h-6 w-2/3 rounded"></div><div class="skeleton-bar h-8 w-full rounded mt-3"></div></div>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <button type="button" onclick={() => keInvoice("paid")} class="text-left cursor-pointer bg-white rounded-xl border border-stone-200 p-5 hover:shadow-md hover:border-[#C2410C]/40 transition-all group border-t-4 border-t-[#C2410C]">
        <div class="flex items-center justify-between text-stone-500 mb-1">
          <span class="text-[11px] font-bold uppercase tracking-wider text-stone-600">Kas Masuk {bulan}</span>
          <span class="p-1 rounded bg-orange-50 text-[#C2410C] group-hover:translate-x-0.5 transition-transform" aria-hidden="true">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </span>
        </div>
        <span class="block text-2xl font-bold font-mono text-stone-900 mt-1">{rupiah(ringkasan.kas_bulan_ini)}</span>
        <span class="text-[11px] text-stone-500 mt-1.5 block">Klik untuk lihat invoice lunas</span>
      </button>

      <button type="button" onclick={() => keInvoice("partial")} class="text-left cursor-pointer bg-white rounded-xl border border-stone-200 p-5 hover:shadow-md hover:border-amber-400 transition-all group border-t-4 border-t-amber-500">
        <div class="flex items-center justify-between text-stone-500 mb-1">
          <span class="text-[11px] font-bold uppercase tracking-wider text-stone-600">Outstanding (Piutang)</span>
          <span class="p-1 rounded bg-amber-50 text-amber-600 group-hover:translate-x-0.5 transition-transform" aria-hidden="true">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </span>
        </div>
        <span class="block text-2xl font-bold font-mono text-stone-900 mt-1">{rupiah(ringkasan.piutang)}</span>
        <span class="text-[11px] text-stone-500 mt-1.5 block">Klik untuk tagihan tertunggak</span>
      </button>

      <button type="button" onclick={() => go("alat")} class="text-left cursor-pointer bg-white rounded-xl border border-stone-200 p-5 hover:shadow-md hover:border-emerald-400 transition-all group border-t-4 border-t-emerald-600">
        <div class="flex items-center justify-between text-stone-500 mb-1">
          <span class="text-[11px] font-bold uppercase tracking-wider text-stone-600">Alat Balik Modal</span>
          <span class="p-1 rounded bg-emerald-50 text-emerald-600 group-hover:translate-x-0.5 transition-transform" aria-hidden="true">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </span>
        </div>
        <span class="block text-2xl font-bold font-mono text-stone-900 mt-1">{ringkasan.per_alat.filter((a) => a.balik_modal).length} / {ringkasan.per_alat.length} Alat</span>
        <span class="text-[11px] text-stone-500 mt-1.5 block">Klik untuk cek ROI inventaris</span>
      </button>

      <button type="button" onclick={() => keTransaksi("aktif")} class="text-left cursor-pointer bg-white rounded-xl border border-stone-200 p-5 hover:shadow-md hover:border-stone-400 transition-all group border-t-4 border-t-stone-700">
        <div class="flex items-center justify-between text-stone-500 mb-1">
          <span class="text-[11px] font-bold uppercase tracking-wider text-stone-600">Job Aktif Sewa</span>
          <span class="p-1 rounded bg-stone-100 text-stone-700 group-hover:translate-x-0.5 transition-transform" aria-hidden="true">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </span>
        </div>
        <span class="block text-2xl font-bold font-mono text-stone-900 mt-1">{ringkasan.job_aktif} Job Aktif</span>
        <span class="text-[11px] text-stone-500 mt-1.5 block">Klik untuk operasional event</span>
      </button>
    </div>

    <div class="bg-white rounded-xl border border-stone-200 p-5 shadow-sm space-y-3">
      <div class="flex items-center justify-between border-b border-stone-100 pb-2">
        <div>
          <h3 class="text-sm font-bold uppercase tracking-wider text-stone-900">Perlu Perhatian Tim</h3>
          <p class="text-xs text-stone-500">Invoice melewati jatuh tempo dan deteksi bentrok jadwal</p>
        </div>
        <span class="text-[11px] text-stone-600 font-medium font-mono bg-stone-50 px-2 py-0.5 rounded border border-stone-200">Real-time Scan</span>
      </div>

      <div class="space-y-2">
        {#each overdueList as o (o.id)}
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-lg border border-stone-200 hover:border-stone-300 transition-colors">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border bg-red-100 text-red-800 border-red-200">Overdue</span>
                <h4 class="text-sm font-semibold text-stone-900">Invoice Jatuh Tempo: {o.nomor}</h4>
              </div>
              <p class="text-xs text-stone-600">Sisa tagihan {rupiah(o.sisa)} melewati tempo {tgl(o.jatuh_tempo)}.</p>
            </div>
            <button type="button" onclick={() => keInvoice("unpaid", o.id)} class="text-xs font-semibold text-[#C2410C] hover:text-[#9A3412] px-3 py-1.5 rounded border border-stone-300 hover:border-[#C2410C] transition-colors shrink-0 self-start sm:self-auto">Buka Invoice</button>
          </div>
        {/each}
        {#each bentroks as c (`${c.a.id}-${c.b.id}-${c.alat_id}`)}
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-lg border border-stone-200 hover:border-stone-300 transition-colors">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border bg-amber-100 text-amber-800 border-amber-200">Bentrok Jadwal</span>
                <h4 class="text-sm font-semibold text-stone-900">Bentrok Jadwal Alat: {c.alatNama}</h4>
              </div>
              <p class="text-xs text-stone-600">Disewa ganda pada proyek "{c.a.nama_project}" dan "{c.b.nama_project}".</p>
            </div>
            <button type="button" onclick={() => keTransaksi("semua", c.a.id)} class="text-xs font-semibold text-[#C2410C] hover:text-[#9A3412] px-3 py-1.5 rounded border border-stone-300 hover:border-[#C2410C] transition-colors shrink-0 self-start sm:self-auto">Cek Transaksi</button>
          </div>
        {/each}
        {#if !overdueList.length && !bentroks.length}
          <div class="py-6 text-center text-stone-500 bg-stone-50 rounded-lg border border-stone-200">
            <svg class="w-8 h-8 mx-auto text-emerald-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p class="text-sm font-semibold text-stone-700">Semua Terkendali</p>
            <p class="text-xs text-stone-500">Tidak ada tagihan tertunggak atau bentrok jadwal saat ini.</p>
          </div>
        {/if}
      </div>
    </div>

    <div class="bg-white rounded-xl border border-stone-200 p-5 shadow-sm space-y-4">
      <div class="flex items-center justify-between border-b border-stone-100 pb-2">
        <div>
          <h3 class="text-sm font-bold uppercase tracking-wider text-stone-900">Transaksi Terbaru</h3>
          <p class="text-xs text-stone-500">Daftar reservasi sewa dan job multimedia terkini</p>
        </div>
        <button type="button" onclick={() => go("transaksi")} class="text-xs font-semibold text-[#C2410C] hover:underline">Lihat Semua Transaksi &rarr;</button>
      </div>

      {#if ringkasan.recent.length}
        <div class="overflow-x-auto">
          <table class="w-full min-w-[560px] text-left text-xs">
            <thead class="text-stone-600 border-b border-stone-200 bg-stone-50">
              <tr>
                <th class="py-2.5 px-4 font-semibold">ID Job</th>
                <th class="py-2.5 px-4 font-semibold">Proyek & Klien</th>
                <th class="py-2.5 px-4 font-semibold">Status</th>
                <th class="py-2.5 px-4 font-semibold text-right">Total Nilai</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100">
              {#each ringkasan.recent as t (t.id)}
                <tr class="border-b border-stone-200 hover:bg-stone-50/80 transition-colors">
                  <td class="py-3 px-4 font-mono text-xs text-stone-600">#{t.id}</td>
                  <td class="py-3 px-4">
                    <button type="button" onclick={() => keTransaksi("semua", t.id)} class="text-left hover:underline">
                      <span class="block text-sm font-semibold text-stone-900">{t.nama_project}</span>
                      <span class="block text-xs text-stone-500">{t.nama_client}</span>
                    </button>
                  </td>
                  <td class="py-3 px-4 text-xs text-stone-600">{t.status}</td>
                  <td class="py-3 px-4 font-mono text-xs font-semibold text-stone-800 text-right">{rupiah(t.total)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-xs text-stone-500 italic py-1">Belum ada transaksi sewa.</p>
      {/if}
    </div>
  {/if}
</section>
