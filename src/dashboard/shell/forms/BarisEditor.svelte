<!-- Shared row editor for Walk-in, RAB, and Packages.
     Retains implicit backend categories (default: PRODUCTION) since they match prototype defaults. -->
<script>
  let { value = $bindable([]), alat = [] } = $props();

  const tarifAlat = (id) => alat.find((a) => a.id === id)?.tarif_event ?? 0;
  const namaAlat = (id) => alat.find((a) => a.id === id)?.nama ?? "";

  function tambahAlat() {
    const first = alat[0];
    value = [
      ...value,
      {
        kategori: "PRODUCTION",
        jenis: "alat",
        alat_id: first?.id ?? null,
        nama: first?.nama ?? "",
        qty: 1,
        satuan: "Hari",
        harga_satuan: first?.tarif_event ?? 0,
      },
    ];
  }

  function tambahKustom() {
    value = [
      ...value,
      {
        kategori: "PRODUCTION",
        jenis: "jasa",
        alat_id: null,
        nama: "",
        qty: 1,
        satuan: "Orang",
        harga_satuan: 0,
      },
    ];
  }

  function hapus(i) {
    value = value.filter((_, j) => j !== i);
  }

  function gantiAlat(i, id) {
    const idNum = id === "" ? null : Number(id);
    value = value.map((b, j) =>
      j === i
        ? {
            ...b,
            alat_id: idNum,
            nama: idNum ? namaAlat(idNum) : b.nama,
            harga_satuan: idNum ? tarifAlat(idNum) : b.harga_satuan,
          }
        : b,
    );
  }

  function gantiJenis(i, jenis) {
    value = value.map((b, j) => {
      if (j !== i) return b;
      if (jenis === "alat") {
        const first = alat[0];
        return {
          ...b,
          jenis,
          alat_id: first?.id ?? null,
          nama: first?.nama ?? b.nama,
          harga_satuan: first?.tarif_event ?? b.harga_satuan,
        };
      }
      return { ...b, jenis, alat_id: null };
    });
  }
</script>

<div class="space-y-2">
  {#each value as b, i (i)}
    <div class="flex flex-col sm:grid sm:grid-cols-12 gap-2 p-2.5 bg-stone-50 rounded border border-stone-200 text-xs">
      <div class="flex items-center gap-2 sm:col-span-5">
        <select
          class="w-24 p-1.5 border border-stone-300 rounded focus:border-[#C2410C] shrink-0"
          value={b.jenis}
          onchange={(e) => gantiJenis(i, e.target.value)}
          aria-label="Jenis baris {i + 1}"
        >
          <option value="alat">Alat</option>
          <option value="jasa">Jasa</option>
          <option value="biaya">Biaya</option>
        </select>
        {#if b.jenis === "alat"}
          <select
            class="flex-1 min-w-0 p-1.5 border border-stone-300 rounded focus:border-[#C2410C]"
            value={b.alat_id ?? ""}
            onchange={(e) => gantiAlat(i, e.target.value)}
            aria-label="Pilih alat baris {i + 1}"
          >
            <option value="">Pilih alat...</option>
            {#each alat.filter((a) => a.is_active) as a (a.id)}
              <option value={a.id}>{a.nama}</option>
            {/each}
          </select>
        {:else}
          <input
            type="text"
            class="flex-1 min-w-0 p-1.5 border border-stone-300 rounded focus:border-[#C2410C]"
            value={b.nama}
            oninput={(e) => (value = value.map((x, j) => (j === i ? { ...x, nama: e.target.value } : x)))}
            placeholder="Keterangan item/kru..."
            aria-label="Nama baris {i + 1}"
          />
        {/if}
        <button type="button" class="text-red-600 hover:text-red-800 p-1 sm:hidden shrink-0" onclick={() => hapus(i)} aria-label="Hapus baris {i + 1}">×</button>
      </div>
      <div class="grid grid-cols-3 sm:contents gap-2 items-center">
        <div class="sm:col-span-2">
          <span class="text-[10px] text-stone-500 sm:hidden block">Jumlah:</span>
          <input
            type="number"
            class="w-full p-1.5 border border-stone-300 rounded text-center"
            value={b.qty}
            min="1"
            step="1"
            oninput={(e) => (value = value.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) || 1 } : x)))}
            aria-label="Jumlah baris {i + 1}"
          />
        </div>
        <div class="sm:col-span-2">
          <span class="text-[10px] text-stone-500 sm:hidden block">Satuan:</span>
          <input
            type="text"
            class="w-full p-1.5 border border-stone-300 rounded text-center text-[11px]"
            value={b.satuan}
            oninput={(e) => (value = value.map((x, j) => (j === i ? { ...x, satuan: e.target.value } : x)))}
            aria-label="Satuan baris {i + 1}"
          />
        </div>
        <div class="sm:col-span-2 font-mono font-bold text-stone-800 text-right self-center">
          <span class="text-[10px] text-stone-500 font-sans font-normal sm:hidden block">Subtotal:</span>
          Rp {(Number(b.qty) * Number(b.harga_satuan)).toLocaleString("id-ID")}
        </div>
        <div class="hidden sm:block sm:col-span-1 text-right">
          <button type="button" class="text-red-600 hover:text-red-800 p-1" onclick={() => hapus(i)} aria-label="Hapus baris {i + 1}">×</button>
        </div>
      </div>
      <div class="sm:col-span-12 grid grid-cols-2 gap-2">
        {#if b.jenis === "alat"}
          <input
            type="text"
            class="p-1.5 border border-stone-300 rounded text-[11px]"
            value={b.nama}
            oninput={(e) => (value = value.map((x, j) => (j === i ? { ...x, nama: e.target.value } : x)))}
            placeholder="Nama alat (ikut master saat dipilih)"
            aria-label="Nama alat baris {i + 1}"
          />
        {/if}
        <div class={b.jenis === "alat" ? "" : "col-span-2"}>
          <span class="text-[10px] text-stone-500 sm:hidden block">Tarif (Rp):</span>
          <input
            type="number"
            class="w-full p-1.5 border border-stone-300 rounded text-right"
            value={b.harga_satuan}
            min="0"
            step="1000"
            oninput={(e) => (value = value.map((x, j) => (j === i ? { ...x, harga_satuan: Number(e.target.value) || 0 } : x)))}
            placeholder="Tarif"
            aria-label="Tarif baris {i + 1}"
          />
        </div>
      </div>
    </div>
  {:else}
    <p class="text-xs text-stone-500 italic py-1">Belum ada baris. Tambah alat atau jasa/biaya di bawah.</p>
  {/each}

  <div class="flex items-center gap-2 text-xs">
    <button type="button" class="font-semibold text-[#C2410C] hover:underline" onclick={tambahAlat}>+ Tambah Alat</button>
    <span class="text-stone-300">|</span>
    <button type="button" class="font-semibold text-stone-700 hover:underline" onclick={tambahKustom}>+ Jasa/Biaya Kustom</button>
  </div>
</div>
