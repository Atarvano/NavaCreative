<script>
  // SettingsView (spec: ticket 09). Extracted verbatim from DashboardApp.svelte's
  // `{#if view === 'settings'}` block; the markup is unchanged byte-for-byte.
  //
  // Owns only UI state (the settings form buffer). The settings DATA and the
  // save action come from the store; `onSimpan` is the shell's adapter so this
  // view does not import store internals directly.
  let { setForm, onSimpan } = $props();
</script>

<section class="mt-8" data-view="settings">
  <h2 class="text-subheading font-normal">Settings</h2>
  <p class="mt-2 text-body-sm text-rw-light-gray">Identitas + rekening untuk kop dokumen. Nilai ini mengisi otomatis kop RAB/Brief dan blok DARI/TRANSFER KE di Invoice baru (invoice lama menyimpan snapshot bank-nya sendiri).</p>
  <!-- Q29: sebut path file logo yang ditunggu kop cetak, ganti logo = taruh file + deploy. -->
  <div class="mt-4 rounded-rw-card border border-rw-border-gray/40 bg-rw-charcoal p-4" data-logo-note>
    <p class="text-caption uppercase text-rw-light-gray">Logo kop cetak</p>
    <p class="mt-1 text-body-sm">Kop cetak memakai file <code class="rounded-rw-badge bg-rw-ground px-1 font-mono text-body-sm">public/img/logo-red.png</code> (path URL <code class="rounded-rw-badge bg-rw-ground px-1 font-mono text-body-sm">img/logo-red.png</code>). Sampai file itu disuplai, kop memakai teks nama studio. Ganti logo = taruh file lalu deploy.</p>
  </div>
  <form class="mt-4 grid gap-4 max-md:grid-cols-1 md:grid-cols-2" onsubmit={onSimpan}>
    {#each [['nama', 'Nama studio'], ['hp', 'No. HP'], ['email', 'Email'], ['bank', 'Bank'], ['norek', 'No. rekening'], ['atas_nama', 'Atas nama']] as [f, label] (f)}
      <label class="grid gap-1 text-body-sm">{label}<input class="rounded-rw-control border border-rw-border-gray/40 bg-rw-ground px-3 py-2.5 text-body-sm" bind:value={setForm[f]} /></label>
    {/each}
    <button class="rounded-rw-control bg-rw-accent px-6 py-2.5 text-body-sm text-rw-white justify-self-start md:col-span-2 max-md:w-full" type="submit">Simpan settings</button>
  </form>
</section>
