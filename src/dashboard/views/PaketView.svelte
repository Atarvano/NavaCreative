<script>
  // PaketView (spec: ticket 09). Extracted verbatim from DashboardApp.svelte's
  // `{#if view === 'paket'}` block; markup unchanged byte-for-byte.
  //
  // Owns its UI state (which paket is expanded). Data + actions come from the
  // store via the shell's props (ADR-0014).
  import { rupiah, grupBaris } from '../lib/format.js';

  let { paket, onBukaBuilder, onEdit, onBuatRab } = $props();

  // Per-paket expandable rows (#42: read-only rows + subtotals).
  let openPaketId = $state(null);

  // Expand grup kategori + subtotal, plek dokumen (Q15).
  const paketGrup = (p) => grupBaris(p.baris);

</script>

<section class="mt-8" data-view="paket">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h2 class="text-subheading font-normal">Paket</h2>
    <button class="rounded-rw-control bg-rw-accent px-5 py-2.5 text-body-sm text-rw-white max-md:py-3" onclick={onBukaBuilder} data-paket-toggle>
      + Paket baru
    </button>
  </div>

  {#if !paket.length}
    <!-- Empty state: satu baris + CTA (Q34). -->
    <p class="mt-4 text-body-sm text-rw-light-gray">Belum ada paket. Mulai lewat tombol “+ Paket baru” di atas.</p>
  {:else}
    <ul class="mt-4 grid gap-4">
      {#each paket as p (p.id)}
        <li class="rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4" data-paket-card data-paket-id={p.id}>
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="text-body font-normal">{p.nama}</p>
            <p class="text-body-sm tabular-nums">{rupiah(p.total)}</p>
          </div>
          {#if p.deskripsi}<p class="mt-1 text-caption text-rw-light-gray">{p.deskripsi}</p>{/if}
          <div class="mt-2 flex flex-wrap gap-4 text-body-sm">
            <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => (openPaketId = openPaketId === p.id ? null : p.id)}>
              {openPaketId === p.id ? 'Tutup rincian' : `Lihat ${p.baris.length} baris`}
            </button>
            <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onEdit(p)}>Ubah</button>
            <button class="underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center" onclick={() => onBuatRab(p)}>Buat RAB</button>
          </div>
          {#if openPaketId === p.id}
            <div class="mt-3 border-t border-rw-border-gray/40 pt-3">
              {#each paketGrup(p) as g (g.kategori)}
                <p class="mt-2 text-caption uppercase text-rw-light-gray">{g.kategori}: subtotal {rupiah(g.subtotal)}</p>
                <ul class="grid gap-1 text-body-sm">
                  {#each g.baris as b (b.id)}
                    <li class="flex justify-between gap-2">
                      <span>{b.nama} × {b.qty} {b.satuan} <span class="text-rw-light-gray">[{b.jenis}]</span></span>
                      <span class="tabular-nums">{rupiah(b.qty * b.harga_satuan)}</span>
                    </li>
                  {/each}
                </ul>
              {/each}
              <p class="mt-2 text-body-sm font-normal">Total {rupiah(p.total)}</p>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
