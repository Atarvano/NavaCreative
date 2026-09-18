<script>
  // Topbar (spec: ticket 09). Extracted from DashboardApp.svelte's mobile
  // topbar header: hamburger + Nava + user. Owns no state.
  let { me, onBukaDrawer, MenuIcon, UserIcon } = $props();
</script>

<header class="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-rw-border-gray/40 bg-rw-charcoal px-4 md:hidden">
  <button class="-ml-2 rounded-rw-control p-2 text-rw-off-white" aria-label="Buka menu" onclick={onBukaDrawer}>
    <MenuIcon size={20} strokeWidth={1.75} aria-hidden="true" />
  </button>
  <p class="font-rw-serif text-subheading">Nava</p>
  <span class="flex items-center gap-2 text-body-sm text-rw-light-gray">
    <UserIcon size={16} strokeWidth={1.75} aria-hidden="true" />
    {me}
  </span>
</header>
