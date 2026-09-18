<script>
  // RingkasanView (spec: ticket 09). Extracted verbatim from DashboardApp.svelte's
  // `{#if view === 'ringkasan'}` block; markup unchanged byte-for-byte.
  //
  // Consumes derived data + nav callbacks from the shell. The `skeleton` snippet
  // is passed in because it is the shell's shared loading placeholder.
  import { rupiah, tgl, rwChip } from '../lib/format.js';

  let { ringkasan, perhatian, alatBalikModal, bulanIni, skeleton, onLompatInvoice, onLompatTransaksi, onGo } =
    $props();
</script>

<section class="mt-8" data-view="ringkasan">
  <h2 class="text-subheading font-normal">Ringkasan</h2>
  {#if !ringkasan}
    <div class="mt-4">{@render skeleton(4)}</div>
  {:else}
    <div class="mt-4 grid gap-4">
      <!-- Hero: satu angka terpenting, selebar grid. Label kecil di atas,
           nominal besar serif di bawah. Klik → Invoice (label bulan statis,
           bukan filter tanggal — mapping #58 tak berubah). -->
      <button
        class="group flex flex-wrap items-end justify-between gap-4 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-6 text-left transition-colors hover:border-rw-border-gray"
        onclick={() => onLompatInvoice()}
        data-card-kas
      >
        <span class="grid gap-3">
          <span class="text-caption uppercase tracking-wide text-rw-light-gray">Kas masuk {bulanIni}</span>
          <span class="font-rw-serif text-heading-sm leading-none">{rupiah(ringkasan.kas_bulan_ini)}</span>
        </span>
        <span class="text-body-sm text-rw-light-gray transition-colors group-hover:text-rw-off-white" aria-hidden="true">Lihat Invoice →</span>
      </button>

      <!-- Grid metrik pendamping: label kecil, angka medium. -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
        <button class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 text-left transition-colors hover:border-rw-border-gray" onclick={() => onLompatInvoice('unpaid')} data-card-piutang>
          <p class="text-caption uppercase tracking-wide text-rw-light-gray">Outstanding</p>
          <p class="mt-2 text-subheading font-normal">{rupiah(ringkasan.piutang)}</p>
        </button>
        <button class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 text-left transition-colors hover:border-rw-border-gray" onclick={() => onGo('alat')} data-card-alat>
          <p class="text-caption uppercase tracking-wide text-rw-light-gray">Alat balik modal</p>
          <p class="mt-2 text-subheading font-normal">{alatBalikModal}/{ringkasan.per_alat.length}</p>
        </button>
        <button class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4 text-left transition-colors hover:border-rw-border-gray max-md:col-span-2" onclick={() => onLompatTransaksi('terjadwal')} data-card-job>
          <p class="text-caption uppercase tracking-wide text-rw-light-gray">Job aktif</p>
          <p class="mt-2 text-subheading font-normal">{ringkasan.job_aktif}</p>
        </button>
      </div>
    </div>

    <!-- Perlu perhatian (Q7): overdue + belum-lunas saja, tanpa
         clash-math. Semua-lunas = pesan all-clear eksplisit (Q9). -->
    <h3 class="mt-8 text-body font-normal">Perlu perhatian</h3>
    {#if perhatian.length}
      <ul class="mt-2 grid gap-2">
        {#each perhatian as b (b.id)}
          <li>
            <button class="flex w-full justify-between gap-2 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-3 text-left text-body-sm transition-colors hover:border-rw-border-gray" onclick={() => onLompatInvoice(b.isOverdue ? 'overdue' : 'unpaid', b.id)} data-perhatian-item>
              <span class="flex items-center gap-2">
                {b.nomor} · tempo {tgl(b.jatuh_tempo)}
                {#if b.isOverdue}<span class="rounded-rw-badge px-2 py-0.5 text-caption {rwChip(b.status, true)}">overdue</span>{/if}
              </span>
              <span>{rupiah(b.sisa)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="mt-2 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-3 text-body-sm text-rw-light-gray" data-all-clear>Semua invoice lunas, tidak ada yang perlu perhatian.</p>
    {/if}

    <h3 class="mt-8 text-body font-normal">Transaksi terbaru</h3>
    {#if ringkasan.recent.length}
      <ul class="mt-2 grid gap-2">
        {#each ringkasan.recent as t (t.id)}
          <li>
            <button class="flex w-full justify-between gap-2 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-3 text-left text-body-sm transition-colors hover:border-rw-border-gray" onclick={() => onLompatTransaksi('semua', t.id)} data-recent-item>
              <span class="flex items-center gap-2">{t.nama_project} · {t.nama_client} <span class="rounded-rw-badge px-2 py-0.5 text-caption {rwChip(t.status)}">{t.status}</span></span>
              <span>{rupiah(t.total)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="mt-2 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-3 text-body-sm text-rw-light-gray">Belum ada transaksi. Mulai lewat tombol “+ Walk-in” di Transaksi.</p>
    {/if}
  {/if}
</section>
