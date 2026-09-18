<!-- Ember Sidebar: extracted from agyfdashboard index.html.
     Uses original Nava branding (R-38) and retains original navigation styles. -->
<script>
  import { NAV } from "../lib/nav.svelte.js";

  let { view, me, mobileOpen, onPilih, onLogout } = $props();

  // Active style follows prototype navigate(): adds 4 classes, removes 3.
  const itemCls = (v) =>
    v === view
      ? "bg-stone-200/70 text-[#C2410C] font-semibold border-l-[3px] border-[#C2410C]"
      : "text-[#57534E] hover:bg-stone-100 border-transparent";
</script>

<aside
  id="app-sidebar"
  class="fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-stone-200 flex flex-col justify-between transform transition-transform duration-200 ease-in-out md:translate-x-0 {mobileOpen
    ? ''
    : '-translate-x-full'}"
>
  <div>
    <div class="h-16 flex items-center px-5 border-b border-stone-200 gap-3">
      <div class="w-9 h-9 rounded-xl bg-[#C2410C] flex items-center justify-center text-white shrink-0 shadow-sm">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polygon points="12 2 22 12 12 22 2 12" fill="white" stroke="none" />
          <circle cx="12" cy="12" r="3" fill="#C2410C" />
        </svg>
      </div>
      <div>
        <h1 class="text-sm font-extrabold font-display tracking-tight text-stone-900 leading-tight">NAVA CREATIVE</h1>
        <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Multimedia Rental</p>
      </div>
    </div>

    <nav class="p-4 space-y-7" aria-label="Navigasi dashboard">
      {#each NAV as [group, items] (group)}
        <div>
          <span class="px-3 text-xs font-bold uppercase tracking-wider text-stone-500 block mb-2">{group}</span>
          <ul class="space-y-1 text-sm">
            {#each items as [v, label] (v)}
              <li>
                <button
                  type="button"
                  data-view-nav={v}
                  onclick={() => onPilih(v)}
                  aria-current={v === view ? "page" : undefined}
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors {itemCls(v)}"
                >
                  {#if v === "ringkasan"}
                    <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  {:else if v === "transaksi"}
                    <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                  {:else if v === "rab"}
                    <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  {:else if v === "invoice"}
                    <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  {:else if v === "paket"}
                    <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  {:else if v === "alat"}
                    <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  {/if}
                  <span class="font-medium">{label}</span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/each}

      <div>
        <span class="px-3 text-xs font-bold uppercase tracking-wider text-stone-500 block mb-2">Sistem</span>
        <ul class="space-y-1 text-sm">
          <li>
            <button
              type="button"
              data-view-nav="settings"
              onclick={() => onPilih("settings")}
              aria-current={view === "settings" ? "page" : undefined}
              class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors {itemCls('settings')}"
            >
              <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span class="font-medium">Pengaturan Studio</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>
  </div>

  <div class="p-4 border-t border-stone-200 bg-stone-50">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-stone-200 border border-stone-300 flex items-center justify-center font-bold text-sm text-stone-700" aria-hidden="true">
          {(me ?? "AD").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p class="text-sm font-semibold text-stone-900 leading-tight">{me ?? "Admin Rental"}</p>
          <p class="text-xs text-stone-500">Sesi Cookie Aktif</p>
        </div>
      </div>
      <button
        type="button"
        onclick={onLogout}
        title="Keluar"
        aria-label="Keluar dari akun admin"
        class="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-stone-500 hover:text-red-700 hover:bg-stone-200 rounded-lg transition-colors"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
      </button>
    </div>
  </div>
</aside>
