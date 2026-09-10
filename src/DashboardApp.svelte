<script>
  // DashboardApp: ticket #41 scope = Alat view only. Full multi-view shell
  // (Ringkasan, Transaksi, RAB, Invoice, Paket, Brief, Settings) lands in
  // #46. Unauthenticated visits bounce to login.html via /api/auth/me.
  import { onMount } from 'svelte';

  let me = $state(null);
  let alat = $state([]);
  let error = $state('');
  let notice = $state('');
  let busy = $state(false);

  // Add-alat form (no manual modal field anywhere — G2).
  let nama = $state('');
  let hargaBeli = $state('');
  let tarifEvent = $state('');

  // Per-alat expandable detail: servis history + add-servis form.
  let openId = $state(null);
  let servisRows = $state([]);
  let svTanggal = $state('');
  let svKeterangan = $state('');
  let svBiaya = $state('');

  const rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
    });
    if (res.status === 401) {
      location.href = 'login.html';
      throw new Error('unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function load() {
    const { res, data } = await api('/api/alat');
    if (!res.ok) {
      error = data.error ?? 'Gagal memuat alat.';
      return;
    }
    alat = data.alat;
  }

  onMount(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.status === 401) {
        location.href = 'login.html';
        return;
      }
      me = (await meRes.json()).username;
      await load();
    } catch {
      error = 'Tidak bisa menghubungi server.';
    }
  });

  async function addAlat(e) {
    e.preventDefault();
    error = '';
    notice = '';
    busy = true;
    try {
      const { res, data } = await api('/api/alat', {
        method: 'POST',
        body: JSON.stringify({
          nama,
          harga_beli: Number(hargaBeli),
          tarif_event: Number(tarifEvent),
        }),
      });
      if (!res.ok) {
        error = data.error ?? 'Gagal menambah alat.';
        return;
      }
      notice = `${data.nama} ditambahkan. Modal awal ${rupiah(data.modal)}.`;
      nama = '';
      hargaBeli = '';
      tarifEvent = '';
      await load();
    } finally {
      busy = false;
    }
  }

  async function arsipkan(a) {
    if (!confirm(`Arsipkan ${a.nama}? Riwayat tetap tersimpan.`)) return;
    const { res, data } = await api(`/api/alat/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: false }),
    });
    if (!res.ok) error = data.error ?? 'Gagal mengarsipkan.';
    else {
      notice = `${a.nama} diarsipkan.`;
      await load();
    }
  }

  async function toggle(a) {
    if (openId === a.id) {
      openId = null;
      return;
    }
    openId = a.id;
    svTanggal = '';
    svKeterangan = '';
    svBiaya = '';
    const { res, data } = await api(`/api/alat/${a.id}/servis`);
    servisRows = res.ok ? data.servis : [];
  }

  async function addServis(a, e) {
    e.preventDefault();
    error = '';
    const { res, data } = await api(`/api/alat/${a.id}/servis`, {
      method: 'POST',
      body: JSON.stringify({
        tanggal: svTanggal,
        keterangan: svKeterangan,
        biaya: Number(svBiaya),
      }),
    });
    if (!res.ok) {
      error = data.error ?? 'Gagal mencatat servis.';
      return;
    }
    notice = `Servis ${rupiah(data.biaya)} tercatat. Modal ${a.nama} bertambah.`;
    await load();
    servisRows = [...servisRows, data];
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.href = 'login.html';
  }
</script>

<main class="min-h-dvh bg-canvas px-(--pad) py-8">
  <div class="mx-auto w-full max-w-3xl">
    <header class="flex items-baseline justify-between gap-4">
      <div>
        <p class="text-subheading font-normal">Nava Creative</p>
        <h1 class="mt-1 text-heading-sm font-light">Alat & modal</h1>
      </div>
      <div class="flex items-center gap-3 text-body-sm">
        {#if me}<span class="text-graphite">{me}</span>{/if}
        <button class="underline" onclick={logout}>Keluar</button>
      </div>
    </header>

    {#if error}<p role="alert" class="mt-4 text-body-sm text-magenta-bloom">{error}</p>{/if}
    {#if notice}<p role="status" class="mt-4 text-body-sm text-forest-teal">{notice}</p>{/if}

    <section class="mt-8">
      <h2 class="text-subheading font-normal">Tambah alat</h2>
      <form class="mt-4 grid gap-4 max-md:grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end" onsubmit={addAlat}>
        <label class="grid gap-1 text-body-sm">
          Nama
          <input class="rounded-none border border-ash bg-bone-white px-4 py-3 text-body" name="nama" required bind:value={nama} placeholder="Sony NXR-100" />
        </label>
        <label class="grid gap-1 text-body-sm">
          Harga beli (Rp)
          <input class="rounded-none border border-ash bg-bone-white px-4 py-3 text-body" name="harga_beli" type="number" min="0" step="1" required bind:value={hargaBeli} placeholder="10000000" />
        </label>
        <label class="grid gap-1 text-body-sm">
          Tarif/event (Rp)
          <input class="rounded-none border border-ash bg-bone-white px-4 py-3 text-body" name="tarif_event" type="number" min="0" step="1" required bind:value={tarifEvent} placeholder="350000" />
        </label>
        <button class="rounded-pill bg-navy-ink px-6 py-3 text-body-sm text-bone-white disabled:opacity-50" type="submit" disabled={busy}>
          {busy ? '…' : 'Tambah'}
        </button>
      </form>
    </section>

    <section class="mt-12">
      <h2 class="text-subheading font-normal">Daftar alat</h2>
      {#if !alat.length}
        <p class="mt-4 text-body-sm text-graphite">Belum ada alat. Tambahkan alat pertamamu di atas.</p>
      {:else}
        <ul class="mt-4 grid gap-4">
          {#each alat as a (a.id)}
            <li class="border border-ash bg-bone-white p-4">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <p class="text-body font-normal">
                  {a.nama}
                  {#if !a.is_active}<span class="ml-2 text-caption text-graphite uppercase">Arsip</span>{/if}
                </p>
                {#if a.balik_modal}
                  <span class="rounded-pill bg-forest-teal px-3 py-1 text-caption text-bone-white">Balik modal</span>
                {:else}
                  <span class="rounded-pill border border-ash px-3 py-1 text-caption text-graphite">Belum balik modal</span>
                {/if}
              </div>
              <p class="mt-2 text-body-sm text-graphite">
                Modal {rupiah(a.modal)} · Pendapatan {rupiah(a.pendapatan)} · Tarif {rupiah(a.tarif_event)}/event
              </p>
              <div class="mt-3 flex gap-4 text-body-sm">
                <button class="underline" onclick={() => toggle(a)}>
                  {openId === a.id ? 'Tutup servis' : 'Servis & riwayat'}
                </button>
                {#if a.is_active}
                  <button class="underline" onclick={() => arsipkan(a)}>Arsipkan</button>
                {/if}
              </div>
              {#if openId === a.id}
                <div class="mt-4 border-t border-ash pt-4">
                  {#if !servisRows.length}
                    <p class="text-body-sm text-graphite">Belum ada servis tercatat.</p>
                  {:else}
                    <ul class="grid gap-2 text-body-sm">
                      {#each servisRows as s (s.id)}
                        <li>{s.tanggal} — {s.keterangan || '(tanpa keterangan)'} — {rupiah(s.biaya)}</li>
                      {/each}
                    </ul>
                  {/if}
                  <form class="mt-4 grid gap-3 max-md:grid-cols-1 md:grid-cols-[1fr_2fr_1fr_auto] md:items-end" onsubmit={(e) => addServis(a, e)}>
                    <label class="grid gap-1 text-body-sm">
                      Tanggal
                      <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" type="date" required bind:value={svTanggal} />
                    </label>
                    <label class="grid gap-1 text-body-sm">
                      Keterangan
                      <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" bind:value={svKeterangan} placeholder="Ganti kabel" />
                    </label>
                    <label class="grid gap-1 text-body-sm">
                      Biaya (Rp)
                      <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" type="number" min="0" step="1" required bind:value={svBiaya} />
                    </label>
                    <button class="rounded-pill bg-navy-ink px-5 py-2 text-body-sm text-bone-white" type="submit">Catat</button>
                  </form>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</main>
