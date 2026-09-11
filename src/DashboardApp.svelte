<script>
  // DashboardApp: ticket #41 = Alat, #42 = Paket (read), #43 = RAB
  // (list + buat dari paket + status + setujui 1 klik + print).
  // Full multi-view shell lands in #46.
  import { onMount } from 'svelte';

  let me = $state(null);
  let alat = $state([]);
  let paket = $state([]);
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

  // Per-paket expandable rows (#42: read-only rows + subtotals).
  let openPaketId = $state(null);

  // Studio identity for document headers (Q23, auto-fill from settings).
  let settings = $state({});

  // RAB (#43): list + builder (header + rows, from paket or blank).
  let rabs = $state([]);
  let openRabId = $state(null);
  let rbProject = $state('');
  let rbTanggal = $state(new Date().toISOString().slice(0, 10));
  let rbClient = $state('');
  let rbPerusahaan = $state('');
  let rbDiskon = $state('');
  let rbCatatan = $state('');
  let rbBaris = $state([]);
  let nbNama = $state('');
  let nbQty = $state('1');
  let nbSatuan = $state('');
  let nbHarga = $state('');
  let nbJenis = $state('alat');
  let nbKategori = $state('PRODUCTION');

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
    const pr = await api('/api/paket');
    if (pr.res.ok) paket = pr.data.paket;
    const rr = await api('/api/rab');
    if (rr.res.ok) rabs = rr.data.rab;
    // Identity auto-fill source (Q23); print views read from here.
    const sr = await api('/api/settings');
    if (sr.res.ok) settings = sr.data.settings;
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

  // --- RAB builder (#43) ---
  function resetBuilder() {
    rbProject = '';
    rbTanggal = new Date().toISOString().slice(0, 10);
    rbClient = '';
    rbPerusahaan = '';
    rbDiskon = '';
    rbCatatan = '';
    rbBaris = [];
  }

  async function dariPaket(p) {
    error = '';
    const { res, data } = await api(`/api/paket/${p.id}/ke-rab`);
    if (!res.ok) {
      error = data.error ?? 'Gagal menyalin paket.';
      return;
    }
    rbProject = data.nama_project;
    rbBaris = data.baris.map((b) => ({ ...b }));
    notice = `Baris ${p.nama} disalin — lengkapi client lalu simpan.`;
  }

  function tambahBaris(e) {
    e.preventDefault();
    rbBaris = [
      ...rbBaris,
      {
        kategori: nbKategori || 'PRODUCTION',
        jenis: nbJenis,
        alat_id: null,
        nama: nbNama.trim(),
        qty: Number(nbQty) || 1,
        satuan: nbSatuan,
        harga_satuan: Number(nbHarga) || 0,
      },
    ];
    nbNama = '';
    nbQty = '1';
    nbSatuan = '';
    nbHarga = '';
  }

  function hapusBaris(i) {
    rbBaris = rbBaris.filter((_, j) => j !== i);
  }

  const rbSum = () => rbBaris.reduce((t, b) => t + b.qty * b.harga_satuan, 0);

  async function simpanRab(e) {
    e.preventDefault();
    error = '';
    notice = '';
    busy = true;
    try {
      const { res, data } = await api('/api/rab', {
        method: 'POST',
        body: JSON.stringify({
          nama_project: rbProject,
          tanggal_rab: rbTanggal,
          nama_client: rbClient,
          perusahaan_client: rbPerusahaan,
          diskon: Number(rbDiskon) || 0,
          catatan: rbCatatan,
          baris: rbBaris,
        }),
      });
      if (!res.ok) {
        error = data.error ?? 'Gagal menyimpan RAB.';
        return;
      }
      notice = `${data.nomor} tersimpan sebagai draft.`;
      resetBuilder();
      await load();
    } finally {
      busy = false;
    }
  }

  async function statusRab(r, status) {
    const { res, data } = await api(`/api/rab/${r.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) error = data.error ?? 'Gagal ubah status.';
    else {
      notice = `${r.nomor} → ${status}.`;
      await load();
    }
  }

  async function setujui(r) {
    if (!confirm(`Setujui ${r.nomor} menjadi Transaksi?`)) return;
    const { res, data } = await api(`/api/rab/${r.id}/setujui`, { method: 'POST' });
    if (!res.ok) error = data.error ?? 'Gagal menyetujui.';
    else {
      notice = `${r.nomor} disetujui → Transaksi #${data.transaksi_id}.`;
      await load();
    }
  }

  function printRab(r) {
    const rows = r.baris
      .map(
        (b) => `<tr><td>${b.nama}</td><td>${b.qty} ${b.satuan}</td><td style="text-align:right">${rupiah(b.qty * b.harga_satuan)}</td></tr>`,
      )
      .join('');
    const w = window.open('', '_blank');
    const ident = settings.nama ? `<p>${settings.nama}<br>${settings.hp ?? ''}<br>${settings.email ?? ''}</p>` : '';
    w.document.write(`<html lang="id"><head><title>${r.nomor}</title></head><body onload="print()" style="font-family:sans-serif;max-width:640px;margin:32px auto">
      <h1>RANCANGAN ANGGARAN BIAYA</h1>
      ${ident}
      <p>${r.nomor} · ${r.tanggal_rab}</p>
      <p><b>PROJECT</b><br>${r.nama_project}</p>
      <p><b>UNTUK</b><br>${r.nama_client}${r.perusahaan_client ? ' — ' + r.perusahaan_client : ''}</p>
      <table style="width:100%;border-collapse:collapse" border="1" cellpadding="8"><tr><th>ITEM</th><th>QTY</th><th>SUBTOTAL</th></tr>${rows}</table>
      <p><b>TOTAL: ${rupiah(r.total)}</b></p>
      ${r.catatan ? `<p>Catatan:<br>${r.catatan}</p>` : ''}
      <p><i>RAB bersifat estimasi; harga final dapat menyesuaikan scope project.</i></p>
      </body></html>`);
    w.document.close();
  }

  function waRab(r) {
    const lines = r.baris.map((b) => `- ${b.nama} × ${b.qty}: ${rupiah(b.qty * b.harga_satuan)}`).join('\n');
    const text = `RAB ${r.nomor}\n${r.nama_project} — ${r.nama_client}\n${lines}\nTOTAL: ${rupiah(r.total)}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
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
    <section class="mt-12">
      <h2 class="text-subheading font-normal">Paket live streaming</h2>
      {#if !paket.length}
        <p class="mt-4 text-body-sm text-graphite">Belum ada paket.</p>
      {:else}
        <ul class="mt-4 grid gap-4">
          {#each paket as p (p.id)}
            <li class="border border-ash bg-bone-white p-4">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <p class="text-body font-normal">{p.nama}</p>
                <p class="text-body-sm">{rupiah(p.total)}</p>
              </div>
              <div class="mt-2 flex gap-4 text-body-sm">
                <button class="underline" onclick={() => (openPaketId = openPaketId === p.id ? null : p.id)}>
                  {openPaketId === p.id ? 'Tutup rincian' : `Lihat ${p.baris.length} baris`}
                </button>
                <button class="underline" onclick={() => dariPaket(p)}>Buat RAB</button>
              </div>
              {#if openPaketId === p.id}
                <div class="mt-3 border-t border-ash pt-3">
                  <ul class="grid gap-1 text-body-sm">
                    {#each p.baris as b (b.id)}
                      <li class="flex justify-between gap-2">
                        <span>{b.nama} × {b.qty} {b.satuan} <span class="text-graphite">[{b.jenis}]</span></span>
                        <span>{rupiah(b.qty * b.harga_satuan)}</span>
                      </li>
                    {/each}
                  </ul>
                  <p class="mt-2 text-body-sm text-graphite">
                    {#each Object.entries(p.subtotal) as [k, v] (k)}
                      {k} {rupiah(v)} ·
                    {/each}
                  </p>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
    <section class="mt-12">
      <h2 class="text-subheading font-normal">RAB</h2>
      <form class="mt-4 grid gap-4 border border-ash bg-bone-white p-4" onsubmit={simpanRab}>
        <div class="grid gap-4 max-md:grid-cols-1 md:grid-cols-2">
          <label class="grid gap-1 text-body-sm">
            Nama project
            <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" name="rb_project" required bind:value={rbProject} placeholder="Paket Nikahan" />
          </label>
          <label class="grid gap-1 text-body-sm">
            Tanggal RAB
            <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" type="date" required bind:value={rbTanggal} />
          </label>
          <label class="grid gap-1 text-body-sm">
            Nama client
            <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" name="rb_client" required bind:value={rbClient} placeholder="Soleh Permana" />
          </label>
          <label class="grid gap-1 text-body-sm">
            Perusahaan (opsional)
            <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" bind:value={rbPerusahaan} />
          </label>
        </div>
        {#if rbBaris.length}
          <ul class="grid gap-1 text-body-sm">
            {#each rbBaris as b, i (i)}
              <li class="flex justify-between gap-2">
                <span>{b.nama} × {b.qty} {b.satuan} <span class="text-graphite">[{b.jenis}]</span></span>
                <span>{rupiah(b.qty * b.harga_satuan)} <button type="button" class="underline" onclick={() => hapusBaris(i)}>hapus</button></span>
              </li>
            {/each}
          </ul>
          <p class="text-body-sm">Subtotal {rupiah(rbSum())}</p>
        {:else}
          <p class="text-body-sm text-graphite">Belum ada baris — salin dari paket lewat tombol “Buat RAB”, atau tambah manual di bawah.</p>
        {/if}
        <div class="grid gap-3 max-md:grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-end">
          <label class="grid gap-1 text-body-sm">
            Item
            <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" bind:value={nbNama} placeholder="Live Streaming 2 camera" />
          </label>
          <label class="grid gap-1 text-body-sm">
            Jenis
            <select class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" bind:value={nbJenis}>
              <option value="alat">alat</option>
              <option value="jasa">jasa</option>
              <option value="biaya">biaya</option>
            </select>
          </label>
          <label class="grid gap-1 text-body-sm">
            Qty
            <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" type="number" min="1" step="1" bind:value={nbQty} />
          </label>
          <label class="grid gap-1 text-body-sm">
            Satuan
            <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" bind:value={nbSatuan} placeholder="Hari" />
          </label>
          <label class="grid gap-1 text-body-sm">
            Harga (Rp)
            <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" type="number" min="0" step="1" bind:value={nbHarga} />
          </label>
          <button type="button" class="rounded-pill border border-ash px-5 py-2 text-body-sm" onclick={tambahBaris}>+ Baris</button>
        </div>
        <div class="grid gap-4 max-md:grid-cols-1 md:grid-cols-[1fr_2fr_auto] md:items-end">
          <label class="grid gap-1 text-body-sm">
            Diskon (Rp)
            <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" type="number" min="0" step="1" bind:value={rbDiskon} placeholder="0" />
          </label>
          <label class="grid gap-1 text-body-sm">
            Catatan
            <input class="rounded-none border border-ash bg-bone-white px-3 py-2 text-body-sm" bind:value={rbCatatan} placeholder="Include file edit" />
          </label>
          <button class="rounded-pill bg-navy-ink px-6 py-2 text-body-sm text-bone-white disabled:opacity-50" type="submit" disabled={busy}>Simpan draft</button>
        </div>
      </form>
      {#if rabs.length}
        <ul class="mt-4 grid gap-4">
          {#each rabs as r (r.id)}
            <li class="border border-ash bg-bone-white p-4">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <p class="text-body font-normal">{r.nomor} — {r.nama_project}</p>
                <span class="rounded-pill border border-ash px-3 py-1 text-caption text-graphite">{r.status}</span>
              </div>
              <p class="mt-1 text-body-sm text-graphite">{r.nama_client} · {rupiah(r.total)}</p>
              <div class="mt-2 flex flex-wrap gap-4 text-body-sm">
                <button class="underline" onclick={() => (openRabId = openRabId === r.id ? null : r.id)}>{openRabId === r.id ? 'Tutup' : 'Rincian'}</button>
                {#if r.status === 'draft'}
                  <button class="underline" onclick={() => statusRab(r, 'sent')}>Kirim</button>
                {/if}
                {#if r.status === 'sent'}
                  <button class="underline" onclick={() => setujui(r)}>Setujui → Transaksi</button>
                  <button class="underline" onclick={() => statusRab(r, 'rejected')}>Tolak</button>
                  <button class="underline" onclick={() => statusRab(r, 'draft')}>Revisi</button>
                {/if}
                <button class="underline" onclick={() => printRab(r)}>Cetak</button>
                <button class="underline" onclick={() => waRab(r)}>WA</button>
              </div>
              {#if openRabId === r.id}
                <ul class="mt-3 grid gap-1 border-t border-ash pt-3 text-body-sm">
                  {#each r.baris as b (b.id)}
                    <li class="flex justify-between gap-2">
                      <span>{b.nama} × {b.qty} {b.satuan} <span class="text-graphite">[{b.jenis}]</span></span>
                      <span>{rupiah(b.qty * b.harga_satuan)}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</main>
