<!-- Ember Settings View: extracted from index.html structure.
     Maps basic fields (no address or data reset). Logo follows static path pattern. -->
<script>
  import { state as store, simpanSettings } from "../lib/store.svelte.js";
  import { LOGO_URL } from "../lib/print-ember.js";

  let busy = $state(false);

  // Form buffer copies store data so cancellation just closes without saving (single save button per prototype).
  let f = $state({ nama: "", hp: "", email: "", bank: "", norek: "", atas_nama: "" });
  let seeded = $state(false);

  $effect(() => {
    if (!seeded && store.settings && Object.keys(store.settings).length) {
      f = {
        nama: store.settings.nama ?? "",
        hp: store.settings.hp ?? "",
        email: store.settings.email ?? "",
        bank: store.settings.bank ?? "",
        norek: store.settings.norek ?? "",
        atas_nama: store.settings.atas_nama ?? "",
      };
      seeded = true;
    }
  });

  async function simpan(e) {
    e.preventDefault();
    busy = true;
    try {
      await simpanSettings({ ...f });
    } finally {
      busy = false;
    }
  }
</script>

<section id="view-settings" class="view-panel space-y-6" aria-label="Pengaturan studio">
  <form class="space-y-6" onsubmit={simpan}>
    <div class="bg-white rounded-xl border border-stone-200 p-6 shadow-sm space-y-4">
      <div class="border-b border-stone-100 pb-2">
        <h3 class="text-base font-bold font-display text-stone-900">Identitas Studio Multimedia</h3>
        <p class="text-xs text-stone-500">Informasi ini otomatis mengisi kop pada dokumen RAB, Brief, dan Faktur Invoice.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-stone-700 mb-1" for="set-nama">Nama Studio / Perusahaan *</label>
          <input id="set-nama" type="text" required bind:value={f.nama} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-stone-700 mb-1" for="set-hp">Nomor Telepon / WhatsApp Resmi *</label>
          <input id="set-hp" type="text" required bind:value={f.hp} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-stone-700 mb-1" for="set-email">Alamat Email Korespondensi *</label>
          <input id="set-email" type="email" required bind:value={f.email} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-stone-200 p-6 shadow-sm space-y-4">
      <div class="border-b border-stone-100 pb-2">
        <h3 class="text-base font-bold font-display text-stone-900">Rekening Bank Pembayaran</h3>
        <p class="text-xs text-stone-500">Nomor rekening tujuan transfer resmi yang dicantumkan pada lembar Invoice cetak.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-semibold text-stone-700 mb-1" for="set-bank">Nama Bank *</label>
          <input id="set-bank" type="text" required bind:value={f.bank} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-stone-700 mb-1" for="set-norek">Nomor Rekening *</label>
          <input id="set-norek" type="text" required bind:value={f.norek} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C] font-mono" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-stone-700 mb-1" for="set-an">Atas Nama Pemilik Rekening *</label>
          <input id="set-an" type="text" required bind:value={f.atas_nama} class="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#C2410C]" />
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-stone-200 p-6 shadow-sm space-y-4">
      <div class="border-b border-stone-100 pb-2">
        <h3 class="text-base font-bold font-display text-stone-900">Logo Kop Cetak Dokumen</h3>
        <p class="text-xs text-stone-500">Spesifikasi dan file gambar yang digunakan untuk kepala surat dokumen cetak.</p>
      </div>

      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div class="p-3 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-center">
          <img src={LOGO_URL} alt="Logo Kop" class="h-14 w-auto object-contain" onerror={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
        <div class="space-y-1.5 flex-1">
          <p class="block text-xs font-semibold text-stone-700">Jalur File Logo (Logo Path)</p>
          <p class="w-full text-xs p-2 border border-stone-300 rounded font-mono bg-stone-50">{LOGO_URL}</p>
          <p class="text-[11px] text-stone-500">Lokasi file logo standar: <span class="font-mono text-stone-700">public/img/logo-red.png</span>. Ganti logo = taruh file lalu deploy.</p>
        </div>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
      <button type="submit" disabled={busy} class="w-full sm:w-auto text-center px-6 py-2.5 text-xs font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded-lg shadow-sm transition-colors disabled:opacity-50">
        {busy ? "Menyimpan..." : "Simpan Seluruh Pengaturan"}
      </button>
    </div>
  </form>
</section>
