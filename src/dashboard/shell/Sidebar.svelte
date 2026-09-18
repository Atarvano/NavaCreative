<script>
  // Sidebar (spec: ticket 09). Extracted from DashboardApp.svelte's `sidebar`
  // snippet + `navItem` snippet, moved as a unit. Markup unchanged byte-for-byte.
  //
  // Rendered twice by the shell: inside the desktop <aside> and inside the
  // mobile drawer. Receives everything it renders as props; owns no state.
  let {
    nav,
    navIcons,
    view,
    me,
    invBelumLunas,
    invOverdue,
    txAktif,
    onPilih,
    onLogout,
    SettingsIcon,
    UserIcon,
    LogoutIcon,
  } = $props();
</script>

{#snippet navItem(v, label, Icon)}
  <!-- Active item: purple text + a thin purple tint on charcoal, so location is
       marked by the one accent (antislop: purple is the dashboard's single
       deliberate accent) rather than a heavy solid block. -->
  <button
    class="flex min-h-11 w-full items-center justify-between gap-2 rounded-rw-control px-3 py-2 text-left text-body-sm transition-colors {view === v
      ? 'bg-rw-accent/15 text-rw-accent'
      : 'text-rw-light-gray hover:bg-rw-off-white/5 hover:text-rw-off-white'}"
    aria-current={view === v ? 'page' : undefined}
    onclick={() => onPilih(v)}
  >
    <span class="flex items-center gap-3">
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </span>
    {#if v === 'invoice' && invBelumLunas.length}
      <span data-badge-invoice class="rounded-rw-badge px-2 py-0.5 text-caption {invOverdue ? 'bg-rw-danger/20 text-rw-danger-text' : 'bg-rw-off-white/10 text-rw-off-white'}">{invBelumLunas.length}</span>
    {:else if v === 'transaksi' && txAktif}
      <span data-badge-transaksi class="rounded-rw-badge bg-rw-off-white/10 px-2 py-0.5 text-caption text-rw-off-white">{txAktif}</span>
    {/if}
  </button>
{/snippet}

<p class="px-3 pt-5 pb-2 font-rw-serif text-subheading">Nava</p>
<nav class="flex-1 overflow-y-auto px-2 pb-4" aria-label="Dashboard">
  {#each nav as [group, items] (group)}
    <p class="px-3 pt-4 pb-1 text-caption uppercase tracking-wide text-rw-mid-gray">{group}</p>
    {#each items as [v, label] (v)}
      {@render navItem(v, label, navIcons[v])}
    {/each}
  {/each}
  <div class="mx-3 mt-4 border-t border-rw-border-gray/40"></div>
  {@render navItem('settings', 'Settings', SettingsIcon)}
</nav>
<div class="flex items-center justify-between gap-3 border-t border-rw-border-gray/40 px-3 py-3">
  <span class="flex min-w-0 items-center gap-2 text-body-sm text-rw-light-gray">
    <UserIcon size={16} strokeWidth={1.75} aria-hidden="true" />
    {#if me}<span class="truncate">{me}</span>{/if}
  </span>
  <button class="flex shrink-0 items-center gap-2 text-body-sm text-rw-light-gray hover:text-rw-off-white" onclick={onLogout}>
    <LogoutIcon size={16} strokeWidth={1.75} aria-hidden="true" />
    Keluar
  </button>
</div>
