<script>
  // Panel (spec: ticket 09, ADR-0012 amendment). Extracted from
  // DashboardApp.svelte's shared <dialog> block. Markup unchanged byte-for-byte.
  //
  // The native <dialog> gives Esc-to-close and top-layer stacking from the
  // platform (no custom focus trap); a backdrop click also closes. 480–560px
  // right drawer on desktop, full-screen sheet under md. Title + body are set
  // by whoever opens it; the panel owns only the drawer chrome.
  //
  // `panelEl` is bound back to the shell via bind:this so the shell's $effect
  // can drive showModal()/close().
  let { panelTitle, panelIsi, onClose, onBackdrop, CloseIcon, panelEl = $bindable(null) } = $props();
</script>

<dialog
  bind:this={panelEl}
  data-panel
  aria-labelledby="panel-judul"
  onclose={onClose}
  onclick={onBackdrop}
  class="panel inset-0 m-0 h-dvh w-screen max-h-none max-w-none border-0 bg-transparent p-0 text-rw-off-white"
>
  <div class="ml-auto flex h-dvh w-screen flex-col border-l border-rw-border-gray/40 bg-rw-charcoal md:w-[480px]">
    <div class="flex items-center justify-between gap-4 border-b border-rw-border-gray/40 px-5 py-4">
      <h2 id="panel-judul" class="text-subheading">{panelTitle}</h2>
      <button class="rounded-rw-control p-2 text-rw-light-gray hover:text-rw-off-white" aria-label="Tutup panel" onclick={onClose}>
        <CloseIcon size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
    <div class="flex-1 overflow-y-auto px-5 py-4">
      {@render panelIsi?.()}
    </div>
  </div>
</dialog>
