// verify-rental-browser.mjs: browser verification for the rental dashboard.
// Serves dist/ locally with a minimal /api/* stub (production serves /api/*
// from the Worker; the static preview has no API), loads login + dashboard
// at desktop + mobile widths, fails on console errors / pageerrors.
// Usage: node scripts/verify-rental-browser.mjs
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";

const DIST = resolve("dist");
const CHROME =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

// Stub: logged in as admin; per-alat rows cover all three balik-modal badge
// tiers (#59) — pendapatan counts only jenis=alat rows per Q13; transaksi
// tables land in #44, stub fakes it.
const STUB = {
  "/api/auth/me": { username: "admin" },
  "/api/settings": {
    settings: {
      nama: "Nava Production",
      hp: "085817999140",
      email: "navaproduction9@gmail.com",
      // Sengaja beda dari bank_snapshot invoice (#61): print lama harus
      // tetap memakai snapshot terbit, bukan settings live.
      bank: "Mandiri",
      norek: "8854012345678903",
      atas_nama: "Nava Production",
    },
  },
  "/api/invoice": {
    invoice: [
      {
        id: 1,
        transaksi_id: 1,
        nomor: "INV-2026-0001",
        tanggal_terbit: "2026-08-17",
        jatuh_tempo: "2026-08-24",
        total: 5500000,
        bank_snapshot: "BCA 8335463109 Luthfi Ahmad Zaidan",
        status: "partial",
        dibayar: 2000000,
        sisa: 3500000,
        overdue: false,
      },
      // Overdue: cabang badge merah + chip merah 'overdue' (Q29).
      {
        id: 2,
        transaksi_id: 2,
        nomor: "INV-2026-0002",
        tanggal_terbit: "2026-08-01",
        jatuh_tempo: "2026-08-07",
        total: 900000,
        bank_snapshot: "BCA 8335463109 Luthfi Ahmad Zaidan",
        status: "unpaid",
        dibayar: 0,
        sisa: 900000,
        overdue: true,
      },
    ],
  },
  // Detail untuk expand Invoice (redesign 04, #57): riwayat bayar berlabel.
  "/api/invoice/1": {
    id: 1,
    transaksi_id: 1,
    nomor: "INV-2026-0001",
    tanggal_terbit: "2026-08-17",
    jatuh_tempo: "2026-08-24",
    total: 5500000,
    bank_snapshot: "BCA 8335463109 Luthfi Ahmad Zaidan",
    status: "partial",
    dibayar: 2000000,
    sisa: 3500000,
    overdue: false,
    bayar: [
      {
        id: 1,
        tanggal: "2026-08-18",
        jumlah: 2000000,
        metode: "transfer",
        referensi: "",
        label: "DP",
      },
    ],
    transaksi: {
      id: 1,
      nama_project: "Drone Bandar Baru",
      nama_client: "Pak Suhaimi",
    },
    baris: [],
  },
  "/api/invoice/2": {
    id: 2,
    transaksi_id: 2,
    nomor: "INV-2026-0002",
    tanggal_terbit: "2026-08-01",
    jatuh_tempo: "2026-08-07",
    total: 900000,
    bank_snapshot: "BCA 8335463109 Luthfi Ahmad Zaidan",
    status: "unpaid",
    dibayar: 0,
    sisa: 900000,
    overdue: true,
    bayar: [],
    transaksi: { id: 2, nama_project: "Nikahan Sinta", nama_client: "Sinta" },
    baris: [],
  },
  "/api/transaksi": {
    transaksi: [
      // API asli `ORDER BY id DESC` — terbaru dulu (default newest-first).
      {
        id: 3,
        rab_id: null,
        nama_project: "Dokumentasi Wisuda",
        nama_client: "Kampus ABC",
        perusahaan_client: "",
        tanggal_mulai: "2026-09-10",
        tanggal_selesai: "2026-09-10",
        lokasi: "Batam",
        status: "selesai",
        diskon: 0,
        total: 750000,
        baris: [
          {
            id: 4,
            kategori: "PRODUCTION",
            jenis: "jasa",
            nama: "Jasa Dokumentasi",
            qty: 1,
            satuan: "Hari",
            harga_satuan: 750000,
          },
        ],
      },
      {
        id: 2,
        rab_id: null,
        nama_project: "Nikahan Sinta",
        nama_client: "Sinta",
        perusahaan_client: "",
        tanggal_mulai: "2026-09-05",
        tanggal_selesai: "2026-09-05",
        lokasi: "Batam Center",
        status: "berjalan",
        diskon: 0,
        total: 500000,
        baris: [
          {
            id: 3,
            kategori: "PRODUCTION",
            jenis: "jasa",
            nama: "Jasa Live 1 Camera",
            qty: 1,
            satuan: "Sesi",
            harga_satuan: 500000,
          },
        ],
      },
      {
        id: 1,
        rab_id: null,
        nama_project: "Drone Bandar Baru",
        nama_client: "Pak Suhaimi",
        perusahaan_client: "",
        tanggal_mulai: "2026-08-17",
        tanggal_selesai: "2026-08-17",
        lokasi: "Bandar Baru",
        status: "terjadwal",
        diskon: 0,
        total: 600000,
        baris: [
          {
            id: 1,
            kategori: "PRODUCTION",
            jenis: "jasa",
            nama: "Jasa Drone",
            qty: 1,
            satuan: "Sesi",
            harga_satuan: 350000,
          },
          {
            id: 2,
            kategori: "PRODUCTION",
            jenis: "jasa",
            nama: "Jasa Edit",
            qty: 1,
            satuan: "Sesi",
            harga_satuan: 250000,
          },
        ],
      },
    ],
  },
  "/api/transaksi/1/brief": { brief: null },
  "/api/transaksi/3/brief": { brief: null },
  "/api/transaksi/3/invoice": {
    id: 3,
    nomor: "INV-2026-0003",
    jatuh_tempo: "2026-09-17",
    total: 750000,
    dibayar: 0,
    sisa: 750000,
    status: "unpaid",
    overdue: false,
  },
  "/api/transaksi/2/brief": {
    brief: {
      transaksi_id: 2,
      objective: "Live 1 camera",
      audience: "",
      style: "",
      mood: "",
      dos: "",
      donts: "",
      lokasi: "Batam Center",
      talent: "",
      deliverables: "",
      deadline: "",
      notes: "",
    },
  },
  // Tiga alat menutup tiga tier badge Balik modal (#59): hijau (balik
  // modal), kuning (kurang ≤3 event), merah (jauh) + satu arsip untuk
  // toggle default-sembunyi. Tier diturunkan FE dari modal/pendapatan/
  // tarif_event — API tak berubah.
  "/api/alat": {
    alat: [
      {
        id: 1,
        nama: "Sony NXR-100",
        harga_beli: 10_000_000,
        tarif_event: 350_000,
        is_active: 1,
        modal: 12_000_000,
        pendapatan: 12_000_000,
        balik_modal: true,
      },
      // Kuning: sisa 400rb = kurang 2 event pada tarif 200rb/event.
      {
        id: 2,
        nama: "Sony FDR AX-40",
        harga_beli: 5_000_000,
        tarif_event: 200_000,
        is_active: 1,
        modal: 5_600_000,
        pendapatan: 5_200_000,
        balik_modal: false,
      },
      // Merah: pendapatan 0, kurang 10 event (>3).
      {
        id: 3,
        nama: "Tripod B-18",
        harga_beli: 500_000,
        tarif_event: 50_000,
        is_active: 1,
        modal: 500_000,
        pendapatan: 0,
        balik_modal: false,
      },
      // Arsip: hanya muncul di balik toggle "Tampilkan arsip".
      {
        id: 4,
        nama: "Intercom Lama",
        harga_beli: 2_000_000,
        tarif_event: 200_000,
        is_active: 0,
        modal: 2_000_000,
        pendapatan: 3_000_000,
        balik_modal: true,
      },
    ],
  },
  "/api/alat/1/servis": {
    servis: [
      {
        id: 1,
        alat_id: 1,
        tanggal: "2026-09-01",
        keterangan: "Ganti kabel SDI",
        biaya: 2_000_000,
      },
      {
        id: 2,
        alat_id: 1,
        tanggal: "2026-08-10",
        keterangan: "Servis lensa",
        biaya: 500_000,
      },
    ],
  },
  "/api/paket": {
    paket: [
      {
        id: 1,
        nama: "Paket 1 Camera",
        deskripsi: "",
        total: 1415000,
        subtotal: { PRODUCTION: 1115000, LOGISTIK: 150000, MISC: 150000 },
        baris: [
          {
            id: 1,
            kategori: "PRODUCTION",
            jenis: "alat",
            nama: "SONY FDR AX-40",
            qty: 1,
            satuan: "Unit",
            harga_satuan: 100000,
          },
          {
            id: 6,
            kategori: "PRODUCTION",
            jenis: "jasa",
            nama: "OPERATOR",
            qty: 2,
            satuan: "Orang",
            harga_satuan: 250000,
          },
        ],
      },
      {
        id: 2,
        nama: "Paket 2 Camera",
        deskripsi: "",
        total: 2380000,
        subtotal: { PRODUCTION: 2080000, LOGISTIK: 150000, MISC: 150000 },
        baris: [
          {
            id: 9,
            kategori: "PRODUCTION",
            jenis: "alat",
            nama: "SONY NXR-100",
            qty: 1,
            satuan: "Unit",
            harga_satuan: 350000,
          },
        ],
      },
    ],
  },
  "/api/rab": {
    rab: [
      // API asli `ORDER BY id DESC` — terbaru (approved) di atas. Tiga status
      // menutup cabang aksi primer: draft→Kirim, sent→Setujui, approved→kunci.
      {
        id: 3,
        nomor: "RAB-2026-0003",
        nama_project: "Grand Opening Kafe",
        tanggal_rab: "2026-08-10",
        nama_client: "Kopi Sana",
        perusahaan_client: "PT Kopi",
        status: "approved",
        diskon: 0,
        total: 1500000,
        catatan: "",
        subtotal: { PRODUCTION: 1500000 },
        baris: [
          {
            id: 5,
            kategori: "PRODUCTION",
            jenis: "jasa",
            nama: "Dokumentasi Opening",
            qty: 1,
            satuan: "Sesi",
            harga_satuan: 1500000,
          },
        ],
      },
      {
        id: 2,
        nomor: "RAB-2026-0002",
        nama_project: "Akad Nikah Rina",
        tanggal_rab: "2026-08-05",
        nama_client: "Rina",
        perusahaan_client: "",
        status: "draft",
        diskon: 0,
        total: 600000,
        catatan: "",
        subtotal: { PRODUCTION: 600000 },
        baris: [
          {
            id: 4,
            kategori: "PRODUCTION",
            jenis: "jasa",
            nama: "Foto Akad",
            qty: 1,
            satuan: "Sesi",
            harga_satuan: 600000,
          },
        ],
      },
      {
        id: 1,
        nomor: "RAB-2026-0001",
        nama_project: "Nikahan Soleh",
        tanggal_rab: "2026-08-02",
        nama_client: "Soleh Permana",
        perusahaan_client: "",
        status: "sent",
        diskon: 50000,
        total: 3250000,
        catatan: "",
        subtotal: { PRODUCTION: 3200000, LOGISTIK: 100000 },
        baris: [
          {
            id: 1,
            kategori: "PRODUCTION",
            jenis: "alat",
            nama: "Live Streaming 2 camera",
            qty: 1,
            satuan: "Hari",
            harga_satuan: 3200000,
          },
          {
            id: 2,
            kategori: "LOGISTIK",
            jenis: "biaya",
            nama: "Transportasi",
            qty: 1,
            satuan: "Hari",
            harga_satuan: 100000,
          },
        ],
      },
    ],
  },
  // CRUD Paket (redesign 07, #60): PATCH balikin paket yang sudah diubah —
  // baris diganti wholesale + subtotal/total dihitung ulang, persis kontrak
  // api/paket.js. Dokumen lama tak disentuh (snapshot milik sendiri).
  "/api/paket/2": {
    id: 2,
    nama: "Paket 2 Camera v2",
    deskripsi: "",
    total: 1200000,
    subtotal: { PRODUCTION: 1050000, LOGISTIK: 150000 },
    baris: [
      {
        id: 90,
        kategori: "PRODUCTION",
        jenis: "alat",
        nama: "SONY NXR-100",
        qty: 3,
        satuan: "Unit",
        harga_satuan: 350000,
      },
      {
        id: 91,
        kategori: "LOGISTIK",
        jenis: "biaya",
        nama: "INTERNET",
        qty: 1,
        satuan: "Sesi",
        harga_satuan: 150000,
      },
    ],
  },
  // Buat RAB dari Paket (Q19): baris disalin ke builder di #/rab.
  "/api/paket/1/ke-rab": {
    nama_project: "Paket 1 Camera",
    baris: [
      {
        kategori: "PRODUCTION",
        jenis: "alat",
        alat_id: null,
        nama: "SONY FDR AX-40",
        qty: 1,
        satuan: "Unit",
        harga_satuan: 100000,
      },
      {
        kategori: "PRODUCTION",
        jenis: "jasa",
        alat_id: null,
        nama: "OPERATOR",
        qty: 2,
        satuan: "Orang",
        harga_satuan: 250000,
      },
    ],
  },
  // Setujui sekali-klik (Q45): RAB sent → Transaksi, auto-pindah #/transaksi.
  "/api/rab/1/setujui": {
    transaksi_id: 9,
    transaksi: {
      id: 9,
      rab_id: 1,
      nama_project: "Nikahan Soleh",
      nama_client: "Soleh Permana",
      perusahaan_client: "",
      status: "terjadwal",
      diskon: 50000,
      total: 3250000,
    },
  },
  "/api/ringkasan": {
    total_modal: 12500000,
    total_pendapatan: 12000000,
    piutang: 4400000,
    // #58: field aditif baru — kas bulan ini + job aktif (terjadwal+berjalan).
    kas_bulan_ini: 2000000,
    kas_bulan: "2026-09",
    job_aktif: 2,
    per_alat: [
      {
        id: 1,
        nama: "Sony NXR-100",
        modal: 12000000,
        pendapatan: 12000000,
        balik_modal: true,
      },
      {
        id: 2,
        nama: "Tripod B-18",
        modal: 500000,
        pendapatan: 0,
        balik_modal: false,
      },
    ],
    belum_lunas: [
      {
        id: 1,
        nomor: "INV-2026-0001",
        sisa: 3500000,
        jatuh_tempo: "2026-08-24",
        status: "partial",
      },
      {
        id: 2,
        nomor: "INV-2026-0002",
        sisa: 900000,
        jatuh_tempo: "2026-08-07",
        status: "unpaid",
      },
    ],
    overdue: [
      {
        id: 2,
        nomor: "INV-2026-0002",
        sisa: 900000,
        jatuh_tempo: "2026-08-07",
      },
    ],
    recent: [
      {
        id: 3,
        nama_project: "Dokumentasi Wisuda",
        nama_client: "Kampus ABC",
        total: 750000,
        status: "selesai",
      },
      {
        id: 1,
        nama_project: "Drone Bandar Baru",
        nama_client: "Pak Suhaimi",
        total: 600000,
        status: "terjadwal",
      },
    ],
  },
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  // Write-stub (redesign #59 Alat, #60 Paket): PATCH arsip + CRUD paket
  // dicatat supaya assert bisa memastikan kontrak terkirim — aksi tak no-op
  // sunyi. Write non-GET lain sengaja jatuh ke fallback 404 lama.
  if (req.method !== "GET" && urlPath.startsWith("/api/paket")) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      writes.push({ method: req.method, path: urlPath, body });
      if (req.method === "PATCH" && /^\/api\/paket\/\d+$/.test(urlPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(STUB[urlPath] ?? { ok: true }));
        return;
      }
      if (req.method === "POST" && urlPath === "/api/paket") {
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: 99, nama: "Paket Dokumentasi" }));
        return;
      }
      res.writeHead(404);
      res.end("nope");
    });
    return;
  }
  if (req.method !== "GET" && urlPath.startsWith("/api/alat")) {
    if (req.method === "PATCH" && /^\/api\/alat\/\d+$/.test(urlPath)) {
      writes.push({ path: urlPath });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: 99 }));
    return;
  }
  if (STUB[urlPath]) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(STUB[urlPath]));
    return;
  }
  // Slot logo (redesign 08, #61): file opsional belum disuplai → 204 No Content
  // supaya probe fetch/<img> tidak meninggalkan console error 404. Produksi:
  // 404 diabaikan onerror/fallback; statis stub meniru "belum ada file" tanpa
  // noise agar cek console-error tetap bermakna.
  if (urlPath === "/img/logo-red.png") {
    res.writeHead(204);
    res.end();
    return;
  }
  const path = join(DIST, urlPath);
  if (!existsSync(path)) {
    res.writeHead(404);
    res.end("nope");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(path)] || "text/plain" });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox"],
});
const writes = []; // arsip PATCH dicatat di handler server (assert #59)
let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`FAIL ${msg}`);
};
const ok = (msg) => console.log(`ok   ${msg}`);

for (const [label, w, h] of [
  ["desktop", 1280, 800],
  ["mobile", 390, 844],
]) {
  // Login page: form renders, no console errors.
  {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on("console", (m) => {
      if (m.type() === "error") errs.push(m.text());
    });
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(`${base}/login.html`);
    await page.waitForTimeout(800);
    const hasForm =
      (await page.locator("form").count()) >= 1 &&
      (await page.locator("input[name=username]").count()) === 1 &&
      (await page.locator("input[name=password]").count()) === 1;
    // Poles login (#61): slot brand + fallback teks, tanpa ubah flow 2-step.
    const loginBrand =
      (await page.locator("[data-login-brand]").textContent()) ?? "";
    if (!loginBrand.includes("Nava Creative"))
      fail(`${label} login: brand fallback hilang`);
    else if (!((await page.locator("#app").textContent()) ?? "").includes("Dashboard rental"))
      fail(`${label} login: label Dashboard rental hilang`);
    else if (!hasForm) fail(`${label} login: form incomplete`);
    else if (errs.length)
      fail(`${label} login: console errors: ${errs.join(" // ")}`);
    else ok(`${label} login renders + brand, 0 console errors`);
    await page.close();
  }
  // Dashboard: sidebar shell + hash nav + drawer, all views render.
  {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on("console", (m) => {
      if (m.type() === "error") errs.push(m.text());
    });
    page.on("pageerror", (e) => errs.push(String(e)));
    // Stub window.print di semua window (termasuk popup cetak) — print dialog
    // tak jalan headless dan akan menggantung document.write/onload=print.
    await page.addInitScript(() => {
      window.print = () => {};
    });
    const isDesktop = w >= 768;
    // Deep link: hash #/invoice lands on the Invoice view (Q35).
    await page.goto(`${base}/dashboard.html#/invoice`);
    await page.waitForTimeout(900);
    const sidebar = page.locator("[data-sidebar]");
    // Sidebar visible on desktop, hidden behind drawer on mobile (ADR-0012).
    if ((await sidebar.isVisible()) !== isDesktop)
      fail(
        `${label} sidebar: visibility wrong (visible=${await sidebar.isVisible()}, desktop=${isDesktop})`,
      );
    const invBody = (await page.locator("#app").textContent()) ?? "";
    if (!invBody.includes("INV-2026-0001") || !invBody.includes("24 Agu 2026"))
      fail(`${label} hash #/invoice: invoice view not shown`);
    else ok(`${label} hash #/invoice lands on Invoice (tanggal Indonesia)`);

    // --- Tabel Invoice (redesign 04, #57) ---
    const invTable = page.locator('[data-view="invoice"]');
    // Kolom sesuai kontrak: Nomor|Client|Total|Dibayar|Sisa|Tempo|Status|Aksi.
    const invHead = (await invTable.locator("table thead").textContent()) ?? "";
    for (const col of [
      "Nomor",
      "Client",
      "Total",
      "Dibayar",
      "Sisa",
      "Tempo",
      "Status",
      "Aksi",
    ])
      if (!invHead.includes(col))
        fail(`${label} invoice table: kolom ${col} hilang`);
    // Client join sisi-FE dari transaksi induk (INV-...-0001 → Pak Suhaimi).
    if (!invBody.includes("Pak Suhaimi"))
      fail(`${label} invoice table: client join hilang`);
    // Overdue menonjol (Q17): chip merah 'overdue' + sisa bold di baris INV-...-0002.
    const invOdRow = invTable
      .locator("table tbody tr", { hasText: "INV-2026-0002" })
      .first();
    const invOdText = (await invOdRow.textContent()) ?? "";
    if (!invOdText.includes("overdue"))
      fail(`${label} invoice table: chip overdue hilang`);
    if (
      !(await invOdRow.locator("td").nth(4).getAttribute("class")).includes(
        "font-medium",
      )
    )
      fail(`${label} invoice table: sisa overdue tidak bold`);
    // Bayar cepat primer ada di baris belum-lunas, hilang di baris lunas/batal.
    if ((await invTable.locator("[data-inv-bayar]").count()) !== 2)
      fail(
        `${label} invoice table: Bayar cepat harus ada di 2 baris belum-lunas`,
      );
    // Filter status 'overdue' menyisakan hanya baris overdue.
    await invTable.locator("[data-inv-status]").selectOption("overdue");
    await page.waitForTimeout(200);
    const invOdRows = await invTable.locator("table tbody tr").count();
    if (invOdRows !== 1)
      fail(`${label} invoice filter overdue: expected 1 row, got ${invOdRows}`);
    await invTable.locator("[data-inv-status]").selectOption("semua");
    await page.waitForTimeout(200);
    // Expand via Rincian: riwayat bayar + form bayar lapis-dua + form tempo muncul.
    await invTable
      .locator("table tbody tr", { hasText: "INV-2026-0001" })
      .first()
      .getByRole("button", { name: "Rincian" })
      .click();
    await page.waitForTimeout(350);
    const invExpand = (await invTable.textContent()) ?? "";
    if (
      !invExpand.includes("Riwayat pembayaran") ||
      !invExpand.includes("Catat pembayaran") ||
      !invExpand.includes("Jatuh tempo")
    )
      fail(`${label} invoice expand: riwayat/form bayar/form tempo hilang`);
    else ok(`${label} invoice table + overdue + filter + expand`);

    // --- Cetak plek dokumen asli (redesign 08, #61) ---
    // Cetak membuka window baru + document.write lalu auto print(). Print
    // dialog tak bisa jalan headless → stub window.print di semua window lewat
    // init-script, tangkap popup, baca HTML-nya, tutup.
    const bacaPrint = async (klik) => {
      const pop = page.waitForEvent("popup", { timeout: 4000 });
      await klik();
      const w = await pop;
      await w.waitForLoadState("domcontentloaded");
      await w.waitForTimeout(250);
      const html = (await w.content()) ?? "";
      await w.close();
      return html;
    };

    // Print Invoice (plek 181411): judul merah, DARI vs KEPADA, TOTAL merah,
    // seksi Pembayaran (dibayar + sisa bold + riwayat tanggal+label+metode) di
    // antara TOTAL dan TRANSFER KE, bank dari snapshot terbit, terms 7 hari.
    // invDetail invoice #1 masih terbuka dari blok expand di atas; tombol
    // Cetak ada di baris expand (bukan baris nomor), jadi cari se-view.
    let invPrint = "";
    try {
      invPrint = await bacaPrint(() =>
        invTable.getByRole("button", { name: "Cetak", exact: true }).click(),
      );
    } catch (e) {
      fail(`${label} print invoice: popup tak terbuka (${e.message})`);
    }
    if (invPrint) {
      const low = invPrint.toLowerCase();
      const iTot = low.indexOf("total");
      const iPay = low.indexOf("pembayaran");
      const iBank = low.indexOf("transfer ke");
      if (
        invPrint.includes("INVOICE") &&
        low.includes("dari") &&
        low.includes("kepada") &&
        low.includes("dibayar") &&
        low.includes("sisa") &&
        invPrint.includes("DP") && // label riwayat bayar (B3)
        invPrint.includes("BCA 8335463109 Luthfi Ahmad Zaidan") && // snapshot terbit
        !invPrint.includes("Mandiri 8854012345678903 Nava Production") && // bukan settings live
        iTot > -1 &&
        iPay > iTot &&
        iBank > iPay // seksi bayar di antara TOTAL dan TRANSFER KE
      )
        ok(`${label} print invoice plek + seksi bayar tengah + bank snapshot`);
      else
        fail(
          `${label} print invoice: struktur plek salah (total=${iTot},pay=${iPay},bank=${iBank})`,
        );
    }

    const go = async (navLabel, text) => {
      // Non-exact: badge count ikut nama aksesibel tombol (e.g. "Transaksi 1").
      if (isDesktop)
        await sidebar.getByRole("button", { name: navLabel }).click();
      else {
        await page.locator("button[aria-label='Buka menu']").click();
        await page.waitForTimeout(250);
        await page
          .locator("[data-drawer]")
          .getByRole("button", { name: navLabel })
          .click();
      }
      await page.waitForTimeout(450);
      const body = (await page.locator("#app").textContent()) ?? "";
      if (!body.includes(text))
        fail(`${label} view ${navLabel}: missing ${text}`);
    };
    // navRab dihoist ke sini (dipakai blok Ringkasan #58 di bawah + blok
    // RAB/PAKET lebih jauh): navigasi langsung tanpa verifikasi hash-balik.
    const navRab = async (navLabel, text) => {
      if (isDesktop)
        await sidebar.getByRole("button", { name: navLabel }).click();
      else {
        await page.locator("button[aria-label='Buka menu']").click();
        await page.waitForTimeout(250);
        await page
          .locator("[data-drawer]")
          .getByRole("button", { name: navLabel })
          .click();
      }
      await page.waitForTimeout(450);
      const body = (await page.locator("#app").textContent()) ?? "";
      if (!body.includes(text))
        fail(`${label} view ${navLabel}: missing ${text}`);
    };
    await go("Ringkasan", "Rp 2.000.000");
    await go("Alat", "Sony NXR-100");
    await go("Paket", "Paket 1 Camera");
    await go("RAB", "RAB-2026-0001");
    await go("Transaksi", "Drone Bandar Baru");

    // --- Alat cards + servis lapis-dua + arsip toggle (redesign 06, #59) ---
    // Kartu deskriptif (bukan tabel); tambah di balik +; badge 3-warna;
    // arsip confirm beda-bobot; arsip default-sembunyi di balik toggle.
    await navRab("Alat", "Sony NXR-100");
    const alatView = page.locator('[data-view="alat"]');
    // Judul kiri + aksi kanan (Q5); form tambah tersembunyi sampai + diklik.
    if ((await alatView.locator("[data-alat-form]").count()) !== 0)
      fail(`${label} alat: form tambah harus tersembunyi sebelum + diklik`);
    await alatView.locator("[data-alat-toggle]").click();
    await page.waitForTimeout(200);
    if ((await alatView.locator("[data-alat-form]").count()) === 1) {
      // HP tumpuk penuh (Q24): semua field lebar penuh viewport konten.
      if (!isDesktop) {
        const namaW = await alatView
          .locator("[data-alat-form] input[name=nama]")
          .evaluate((el) => el.getBoundingClientRect().width);
        const formW = await alatView
          .locator("[data-alat-form]")
          .evaluate((el) => el.getBoundingClientRect().width);
        if (namaW < formW * 0.8)
          fail(
            `${label} alat form mobile: field tidak tumpuk penuh (${namaW}/${formW})`,
          );
      }
      await alatView.locator("[data-alat-toggle]").click(); // tutup lagi
      ok(`${label} alat tambah di balik + (form tersembunyi default)`);
    } else fail(`${label} alat: form tambah tak terbuka di balik +`);

    // 3 kartu aktif (arsip ke-4 default-sembunyi), bukan tabel.
    if ((await alatView.locator("table").count()) !== 0)
      fail(`${label} alat: view harus kartu, bukan tabel`);
    if ((await alatView.locator("[data-alat-card]").count()) !== 3)
      fail(`${label} alat: expected 3 kartu aktif (arsip sembunyi)`);
    // Badge 3-warna: hijau balik modal; kuning kurang ≤3 event; merah jauh.
    {
      const badgeOf = (id) =>
        alatView.locator(
          `[data-alat-card][data-alat-id="${id}"] [data-balik-modal-badge]`,
        );
      const b1 = (await badgeOf(1).getAttribute("class")) ?? "";
      const b2 = await badgeOf(2).textContent();
      const b2c = (await badgeOf(2).getAttribute("class")) ?? "";
      const b3 = await badgeOf(3).textContent();
      const b3c = (await badgeOf(3).getAttribute("class")) ?? "";
      if (
        b1.includes("bg-forest-teal") &&
        b1.includes("text-bone-white") &&
        b2c.includes("bg-signal-yellow") &&
        (b2 ?? "").includes("Kurang 2 event") &&
        b3c.includes("bg-magenta-bloom") &&
        (b3 ?? "").includes("Belum balik modal")
      )
        ok(`${label} alat badge 3-warna (hijau/kuning ≤3 event/merah)`);
      else fail(`${label} alat badge: ${b1} | ${b2} [${b2c}] | ${b3} [${b3c}]`);
    }

    // Arsip default-sembunyi; toggle menampilkan + menyembunyikan lagi.
    {
      const alatTxt = () => alatView.textContent();
      if (((await alatTxt()) ?? "").includes("Intercom Lama"))
        fail(`${label} alat arsip: harus default-sembunyi`);
      else {
        await alatView.locator("[data-arsip-toggle]").first().click();
        await page.waitForTimeout(200);
        const tampil = ((await alatTxt()) ?? "").includes("Intercom Lama");
        await alatView.locator("[data-arsip-toggle]").first().click();
        await page.waitForTimeout(200);
        const sembunyi = !((await alatTxt()) ?? "").includes("Intercom Lama");
        if (tampil && sembunyi)
          ok(`${label} alat arsip toggle default-sembunyi`);
        else
          fail(
            `${label} alat arsip toggle: tampil=${tampil} sembunyi=${sembunyi}`,
          );
      }
    }

    // Expand servis: riwayat muncul; form catat = lapis-dua di balik tombol.
    await alatView
      .locator('[data-alat-card][data-alat-id="1"] [data-alat-servis-toggle]')
      .click();
    await page.waitForTimeout(350);
    {
      const exp = (await alatView.textContent()) ?? "";
      if (
        !exp.includes("Riwayat servis") ||
        !exp.includes("Ganti kabel SDI") ||
        !exp.includes("Rp 2.000.000")
      )
        fail(`${label} alat servis expand: riwayat hilang`);
      else if ((await alatView.locator("[data-servis-form]").count()) === 0) {
        await alatView.locator("[data-servis-form-toggle]").click();
        await page.waitForTimeout(200);
        if ((await alatView.locator("[data-servis-form]").count()) === 1)
          ok(`${label} alat servis riwayat + form lapis-dua`);
        else fail(`${label} alat servis: form lapis-dua tak terbuka`);
      } else
        fail(`${label} alat servis: form harus lapis-dua (sembunyi default)`);
    }

    // Arsip selalu confirm + beda-bobot (3 kalimat: arsip → riwayat aman →
    // cara aktifkan lagi). Tolak dulu — kartu bertahan, tanpa request.
    {
      let dialogPesan = "";
      page.once("dialog", async (d) => {
        dialogPesan = d.message();
        await d.dismiss();
      });
      await alatView
        .locator('[data-alat-card][data-alat-id="1"] [data-alat-arsip]')
        .click();
      await page.waitForTimeout(250);
      const masihAda =
        (await alatView
          .locator('[data-alat-card][data-alat-id="1"]')
          .count()) === 1;
      const bedaBobot =
        dialogPesan.includes(
          "Riwayat servis, modal, dan pendapatan tetap tersimpan",
        ) && dialogPesan.includes("Tampilkan arsip");
      if (masihAda && bedaBobot)
        ok(`${label} alat arsip confirm beda-bobot (tolak = kartu bertahan)`);
      else
        fail(
          `${label} alat arsip confirm: ada=${masihAda} pesan="${dialogPesan.slice(0, 80)}"`,
        );
      // Terima: PATCH is_active terkirim (assert via write-stub).
      page.once("dialog", async (d) => d.accept());
      await alatView
        .locator('[data-alat-card][data-alat-id="1"] [data-alat-arsip]')
        .click();
      await page.waitForTimeout(350);
      if (writes.some((w) => w.path === "/api/alat/1"))
        ok(`${label} alat arsip terkirim via PATCH (flag, tanpa hapus)`);
      else fail(`${label} alat arsip: PATCH /api/alat/1 tak tercatat`);
    }

    // --- Ringkasan 4 kartu klik-lompat (redesign 05, #58) ---
    // Kembali ke Ringkasan: semua kartu/item/baris melompat ke view target
    // dengan filter terpasang + expand sesuai mapping spec.
    await navRab("Ringkasan", "Perlu perhatian");
    const ring = page.locator('[data-view="ringkasan"]');
    const ringTxt = (await ring.textContent()) ?? "";
    // 4 kartu: kas bulan ini (label bulan statis), outstanding, alat x/y, job.
    // Label bulan statis dirender dari kas_bulan API (September 2026),
    // bukan tanggal browser — jadi bisa diasert deterministik.
    if (
      !ringTxt.includes("Kas masuk September 2026") ||
      !ringTxt.includes("Rp 2.000.000") ||
      !ringTxt.includes("Outstanding") ||
      !ringTxt.includes("Rp 4.400.000") ||
      !ringTxt.includes("Alat balik modal") ||
      !ringTxt.includes("1/2") ||
      !ringTxt.includes("Job aktif") ||
      !ringTxt.includes("2")
    )
      fail(`${label} ringkasan: 4 kartu tidak lengkap`);
    else ok(`${label} ringkasan 4 kartu (kas/outstanding/alat x/y/job)`);
    // Perhatian: overdue dulu (chip merah) lalu belum-lunas lain, tanpa duplikat.
    const perhatianItems = ring.locator("[data-perhatian-item]");
    if ((await perhatianItems.count()) !== 2)
      fail(
        `${label} ringkasan perhatian: expected 2 item, got ${await perhatianItems.count()}`,
      );
    const perhatianFirst = (await perhatianItems.first().textContent()) ?? "";
    if (
      !perhatianFirst.includes("INV-2026-0002") ||
      !perhatianFirst.includes("overdue")
    )
      fail(`${label} ringkasan perhatian: overdue harus di atas + chip merah`);
    else ok(`${label} ringkasan perhatian overdue-first + chip`);

    // Klik kartu Job aktif → Transaksi prefilter terjadwal (1 baris stub).
    await ring.locator("[data-card-job]").click();
    await page.waitForTimeout(500);
    if (page.url().split("#")[1] === "/transaksi") {
      const txRows = await page
        .locator('[data-view="transaksi"] table tbody tr')
        .count();
      const txSel = await page.locator("[data-tx-status]").inputValue();
      if (txSel === "terjadwal" && txRows === 1)
        ok(`${label} kartu job → Transaksi prefilter terjadwal (1 baris)`);
      else fail(`${label} kartu job: filter ${txSel}, rows ${txRows}`);
    } else fail(`${label} kartu job: hash is ${page.url()}`);

    // Klik kartu Outstanding → Invoice prefilter unpaid (1 baris: INV-...-0002).
    await navRab("Ringkasan", "Perlu perhatian");
    await ring.locator("[data-card-piutang]").click();
    await page.waitForTimeout(500);
    if (page.url().split("#")[1] === "/invoice") {
      const invRows = await page
        .locator('[data-view="invoice"] table tbody tr')
        .count();
      const invSel = await page.locator("[data-inv-status]").inputValue();
      if (invSel === "unpaid" && invRows === 1)
        ok(`${label} kartu piutang → Invoice prefilter unpaid (1 baris)`);
      else fail(`${label} kartu piutang: filter ${invSel}, rows ${invRows}`);
    } else fail(`${label} kartu piutang: hash is ${page.url()}`);

    // Klik item perhatian overdue → Invoice filter overdue + item ter-expand
    // (pengecualian reset-expand Q25).
    await navRab("Ringkasan", "Perlu perhatian");
    await ring.locator("[data-perhatian-item]").first().click();
    await page.waitForTimeout(600);
    {
      const invTxt =
        (await page.locator('[data-view="invoice"]').textContent()) ?? "";
      const invSel = await page.locator("[data-inv-status]").inputValue();
      if (
        page.url().split("#")[1] === "/invoice" &&
        invSel === "overdue" &&
        invTxt.includes("Riwayat pembayaran") &&
        invTxt.includes("INV-2026-0002")
      )
        ok(`${label} item perhatian → Invoice overdue + expand itemnya`);
      else
        fail(`${label} item perhatian: hash ${page.url()}, filter ${invSel}`);
    }

    // Klik recent → Transaksi + barisnya ter-expand.
    await navRab("Ringkasan", "Perlu perhatian");
    await ring.locator("[data-recent-item]").first().click();
    await page.waitForTimeout(600);
    {
      const txTxt =
        (await page.locator('[data-view="transaksi"]').textContent()) ?? "";
      if (
        page.url().split("#")[1] === "/transaksi" &&
        txTxt.includes("subtotal") &&
        txTxt.includes("Dokumentasi Wisuda")
      )
        ok(`${label} recent → Transaksi + expand barisnya`);
      else fail(`${label} recent: hash ${page.url()}`);
    }

    // Klik kartu Kas → Invoice tanpa prefilter; kartu Alat → view Alat.
    await navRab("Ringkasan", "Perlu perhatian");
    await ring.locator("[data-card-kas]").click();
    await page.waitForTimeout(500);
    if (page.url().split("#")[1] === "/invoice")
      ok(`${label} kartu kas → Invoice`);
    else fail(`${label} kartu kas: hash ${page.url()}`);
    await navRab("Ringkasan", "Perlu perhatian");
    await ring.locator("[data-card-alat]").click();
    await page.waitForTimeout(500);
    if (page.url().split("#")[1] === "/alat") ok(`${label} kartu alat → Alat`);
    else fail(`${label} kartu alat: hash ${page.url()}`);

    // Badge sidebar konsisten dengan angka Ringkasan: job_aktif 2 = badge
    // Transaksi 2; 0 = badge hilang (ditutup stub belum-lunas ≠ 0 di sini).
    const ringBadge = await page
      .locator("[data-badge-transaksi]")
      .first()
      .textContent();
    if (ringBadge === "2")
      ok(`${label} badge Transaksi konsisten dgn job_aktif`);
    else fail(`${label} badge Transaksi: expected 2, got ${ringBadge}`);

    // Bersihkan prefilter sisa lompat agar blok tabel Transaksi di bawah
    // (yang mengharap 3 baris) mulai dari state netral.
    await navRab("Transaksi", "Drone Bandar Baru");
    await page.locator("[data-tx-search]").fill("");
    await page.locator("[data-tx-status]").selectOption("semua");
    await page.waitForTimeout(300);

    // --- Tabel Transaksi (redesign 02, #55) ---
    const txTable = page.locator('[data-view="transaksi"]');
    // 3 baris stub; default urutan API id DESC → terbaru (Wisuda) di atas.
    if ((await txTable.locator("table tbody tr").count()) !== 3)
      fail(`${label} transaksi table: expected 3 rows`);
    const defaultFirst = await txTable
      .locator("table tbody tr")
      .first()
      .textContent();
    if (!(defaultFirst ?? "").includes("Dokumentasi Wisuda"))
      fail(`${label} transaksi table: default order not newest-first`);
    // Baris selesai belum-invoice tampilkan satu aksi primer: Terbitkan.
    const wisudaActions = await txTable
      .locator("table tbody tr")
      .first()
      .textContent();
    if ((wisudaActions ?? "").includes("Terbitkan"))
      ok(
        `${label} transaksi table newest-first + satu aksi primer (Terbitkan)`,
      );
    else fail(`${label} transaksi row: selesai row missing Terbitkan`);
    // Search: filter by project narrows to 1 row.
    await txTable.locator("[data-tx-search]").fill("Sinta");
    await page.waitForTimeout(300);
    let rows = await txTable.locator("table tbody tr").count();
    const sintaBody = (await txTable.textContent()) ?? "";
    if (
      rows !== 1 ||
      !sintaBody.includes("Nikahan Sinta") ||
      sintaBody.includes("Drone Bandar Baru")
    )
      fail(`${label} transaksi search: expected 1 row Sinta, got ${rows}`);
    else ok(`${label} transaksi search narrows to 1 row`);
    // Filter-miss empty state offers reset (Q31).
    await txTable.locator("[data-tx-search]").fill("zzz");
    await page.waitForTimeout(300);
    if (!(await txTable.textContent()).includes("Reset"))
      fail(`${label} transaksi filter-miss: no reset CTA`);
    await txTable.locator("[data-tx-search]").fill("");
    // Status filter: berjalan → 1 row.
    await txTable.locator("[data-tx-status]").selectOption("berjalan");
    await page.waitForTimeout(300);
    rows = await txTable.locator("table tbody tr").count();
    if (rows === 1) ok(`${label} transaksi status filter narrows to 1 row`);
    else fail(`${label} transaksi status filter: expected 1, got ${rows}`);
    await txTable.locator("[data-tx-status]").selectOption("semua");
    await page.waitForTimeout(300);
    // Sort: klik header Total sekali = desc (750.000 terbesar di atas).
    await txTable.getByRole("button", { name: /Total/ }).click();
    await page.waitForTimeout(300);
    const firstTotal = await txTable
      .locator("table tbody tr")
      .first()
      .textContent();
    if ((firstTotal ?? "").includes("Rp 750.000"))
      ok(`${label} transaksi sort desc by total`);
    else fail(`${label} transaksi sort desc: first row is not 750k`);
    // Sort cycle: klik kedua = asc (500.000 di atas), ketiga = kembali terbaru.
    await txTable.getByRole("button", { name: /Total/ }).click();
    await page.waitForTimeout(300);
    const ascTotal = await txTable
      .locator("table tbody tr")
      .first()
      .textContent();
    if (!(ascTotal ?? "").includes("Rp 500.000"))
      fail(`${label} transaksi sort asc: first row is not 500k`);
    await txTable.getByRole("button", { name: /Total/ }).click();
    await page.waitForTimeout(300);
    const newestTotal = await txTable
      .locator("table tbody tr")
      .first()
      .textContent();
    if ((newestTotal ?? "").includes("Rp 750.000"))
      ok(`${label} transaksi sort cycle desc→asc→newest`);
    else fail(`${label} transaksi sort reset: first row is not newest`);
    // Expand (Q25): Rincian → grup kategori + subtotal. scrollIntoView center
    // agar tombol tidak tertutup thead sticky di viewport sempit.
    const rincianBtns = txTable.getByRole("button", {
      name: "Rincian",
      exact: true,
    });
    await rincianBtns
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await rincianBtns.first().click();
    await page.waitForTimeout(400);
    const expBody = (await txTable.textContent()) ?? "";
    if (!expBody.includes("subtotal") || !expBody.includes("PRODUCTION"))
      fail(`${label} transaksi expand: no category group/subtotal`);
    // Single-open: tombol Rincian tersisa hanya satu (baris pertama jadi Tutup).
    await rincianBtns
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await rincianBtns.first().click();
    await page.waitForTimeout(400);
    const expCount = await txTable.locator("[data-brief-toggle]").count();
    if (expCount === 1)
      ok(`${label} transaksi expand single-open + subtotal grup`);
    else fail(`${label} transaksi expand: not single-open (${expCount})`);
    // Brief lapis-dua: buka → 11 field + Simpan brief.
    await txTable.locator("[data-brief-toggle]").click();
    await page.waitForTimeout(300);
    const briefForm = txTable.locator("[data-brief-form]");
    if ((await briefForm.locator("input").count()) !== 11)
      fail(`${label} brief form: expected 11 inputs`);
    else if ((await briefForm.textContent()).includes("Simpan brief"))
      ok(`${label} brief second-layer 11 fields inside expand`);
    else fail(`${label} brief form: no save button`);
    // Print Brief (#61): kop PROJECT BRIEF + hanya field terisi (Q32).
    // Expand saat ini = baris Nikahan Sinta (id 2) dengan brief terisi.
    let briefPrint = "";
    try {
      briefPrint = await bacaPrint(() =>
        txTable
          .getByRole("button", { name: "Cetak brief", exact: true })
          .click(),
      );
    } catch (e) {
      fail(`${label} print brief: popup tak terbuka (${e.message})`);
    }
    if (briefPrint) {
      if (
        briefPrint.includes("PROJECT BRIEF") &&
        briefPrint.includes("Nikahan Sinta") &&
        briefPrint.includes("Objective") &&
        briefPrint.includes("Live 1 camera") &&
        briefPrint.includes("Batam Center") &&
        !briefPrint.includes("Audience") // field kosong tidak dicetak
      )
        ok(`${label} print brief kop + field terisi saja`);
      else fail(`${label} print brief: kop/field terisi salah`);
    }
    // Walk-in di balik + (Q13): form hidden until toggled.
    const walkinRowsBefore = await txTable
      .locator("[data-walkin-form]")
      .count();
    await txTable.locator("[data-walkin-toggle]").click();
    await page.waitForTimeout(300);
    if (
      walkinRowsBefore !== 0 ||
      !(await txTable.locator("[data-walkin-form]").isVisible())
    )
      fail(`${label} walk-in form not behind + button`);
    else ok(`${label} walk-in hidden behind + button`);
    // Terbitkan sekali-klik (Q45): dari baris selesai → #/invoice + notice,
    // tanpa confirm. POST distub balikin invoice baru.
    await txTable.locator("[data-walkin-toggle]").click(); // tutup builder
    await page.waitForTimeout(300);
    const terbitkanBtn = txTable.getByRole("button", {
      name: "Terbitkan",
      exact: true,
    });
    await terbitkanBtn
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await terbitkanBtn.first().click();
    await page.waitForTimeout(600);
    const banner = (await page.locator('[role="status"]').textContent()) ?? "";
    if (page.url().split("#")[1] !== "/invoice")
      fail(`${label} terbitkan: hash is ${page.url()}`);
    else if (banner.includes("INV-2026-0003"))
      ok(`${label} terbitkan 1-klik → #/invoice + notice`);
    else fail(`${label} terbitkan: notice missing (${banner})`);

    // --- Tabel RAB (redesign 03, #56) ---
    // navRab sudah dihoist di atas (dipakai blok Ringkasan #58).
    await navRab("RAB", "RAB-2026-0001");
    const rabTable = page.locator('[data-view="rab"]');
    // Judul-kiri + tombol-kanan (Q5): tombol + RAB baru di header.
    if (!(await rabTable.locator("[data-rab-toggle]").isVisible()))
      fail(`${label} rab: no + RAB baru header button`);
    // 3 baris stub; default urutan API id DESC → terbaru (approved) di atas.
    if ((await rabTable.locator("table tbody tr").count()) !== 3)
      fail(`${label} rab table: expected 3 rows`);
    const rabFirst = await rabTable
      .locator("table tbody tr")
      .first()
      .textContent();
    if (!(rabFirst ?? "").includes("Grand Opening Kafe"))
      fail(`${label} rab table: default order not newest-first`);
    // Aksi primer per status: draft→Kirim, sent→Setujui, approved→kunci (tanpa aksi).
    const rabBodyTxt = (await rabTable.textContent()) ?? "";
    if (!rabBodyTxt.includes("Kirim") || !rabBodyTxt.includes("Setujui"))
      fail(`${label} rab row: missing primary action (Kirim/Setujui)`);
    else ok(`${label} rab table newest-first + aksi primer per status`);
    // Search: filter by client mempersempit ke 1 baris.
    await rabTable.locator("[data-rab-search]").fill("Soleh");
    await page.waitForTimeout(300);
    let rrows = await rabTable.locator("table tbody tr").count();
    if (rrows === 1) ok(`${label} rab search narrows to 1 row`);
    else fail(`${label} rab search: expected 1, got ${rrows}`);
    // Filter-miss empty state tawarkan reset (Q31).
    await rabTable.locator("[data-rab-search]").fill("zzz");
    await page.waitForTimeout(300);
    if (!((await rabTable.textContent()) ?? "").includes("Reset"))
      fail(`${label} rab filter-miss: no reset CTA`);
    await rabTable.locator("[data-rab-search]").fill("");
    // Status filter: draft → 1 baris.
    await rabTable.locator("[data-rab-status]").selectOption("draft");
    await page.waitForTimeout(300);
    rrows = await rabTable.locator("table tbody tr").count();
    if (rrows === 1) ok(`${label} rab status filter narrows to 1 row`);
    else fail(`${label} rab status filter: expected 1, got ${rrows}`);
    await rabTable.locator("[data-rab-status]").selectOption("semua");
    await page.waitForTimeout(300);
    // Sort: klik header Total sekali = desc (3.250.000 terbesar di atas).
    await rabTable.getByRole("button", { name: /Total/ }).click();
    await page.waitForTimeout(300);
    const rabDesc = await rabTable
      .locator("table tbody tr")
      .first()
      .textContent();
    if ((rabDesc ?? "").includes("Rp 3.250.000"))
      ok(`${label} rab sort desc by total`);
    else fail(`${label} rab sort desc: first row not 3.250.000`);
    // Sort cycle: klik kedua = asc (600.000 di atas).
    await rabTable.getByRole("button", { name: /Total/ }).click();
    await page.waitForTimeout(300);
    const rabAsc = await rabTable
      .locator("table tbody tr")
      .first()
      .textContent();
    if (!(rabAsc ?? "").includes("Rp 600.000"))
      fail(`${label} rab sort asc: first row not 600.000`);
    await rabTable.getByRole("button", { name: /Total/ }).click();
    await page.waitForTimeout(300);
    // Expand: Rincian → grup kategori + subtotal + aksi sekunder (Tolak/Revisi/Cetak).
    const rabRincian = rabTable.getByRole("button", {
      name: "Rincian",
      exact: true,
    });
    await rabRincian
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await rabRincian.first().click();
    await page.waitForTimeout(400);
    const rabExp = (await rabTable.textContent()) ?? "";
    if (!rabExp.includes("subtotal") || !rabExp.includes("PRODUCTION"))
      fail(`${label} rab expand: no category group/subtotal`);
    else if (rabExp.includes("Cetak"))
      ok(`${label} rab expand grup/subtotal + aksi sekunder`);
    // Single-open: buka baris lain menutup yang pertama.
    const rabRincian2 = rabTable.getByRole("button", {
      name: "Rincian",
      exact: true,
    });
    await rabRincian2
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await rabRincian2.first().click();
    await page.waitForTimeout(400);
    const rabOpenCount = await rabTable
      .getByRole("button", { name: "Tutup", exact: true })
      .count();
    if (rabOpenCount === 1) ok(`${label} rab expand single-open`);
    else fail(`${label} rab expand: not single-open (${rabOpenCount})`);
    // Print RAB (#61): kop RAB + PROJECT vs UNTUK + grup/subtotal + TOTAL
    // FINAL + nomor sistem, tanggal Indonesia pendek. Setelah sort cycle + 2x
    // expand, RAB terbuka = baris termurah (RAB-2026-0002).
    let rabPrint = "";
    try {
      rabPrint = await bacaPrint(() =>
        rabTable.getByRole("button", { name: "Cetak", exact: true }).click(),
      );
    } catch (e) {
      fail(`${label} print rab: popup tak terbuka (${e.message})`);
    }
    if (rabPrint) {
      if (
        rabPrint.includes("RANCANGAN ANGGARAN BIAYA") &&
        rabPrint.includes("RAB-2026-0002") &&
        rabPrint.includes("Akad Nikah Rina") &&
        rabPrint.includes("5 Agu 2026") &&
        rabPrint.includes("Foto Akad") &&
        rabPrint.includes("PRODUCTION") &&
        rabPrint.includes("Subtotal PRODUCTION") &&
        rabPrint.includes("TOTAL FINAL") &&
        rabPrint.includes("estimasi")
      )
        ok(`${label} print rab plek + nomor + tanggal ID`);
      else fail(`${label} print rab: kop/grup/total/tanggal salah`);
    }
    // Builder di balik + (Q23): form tersembunyi sampai tombol + diklik.
    await rabTable
      .getByRole("button", { name: "Tutup", exact: true })
      .first()
      .click();
    await page.waitForTimeout(200);
    const rabFormBefore = await rabTable.locator("[data-rab-form]").count();
    await rabTable.locator("[data-rab-toggle]").click();
    await page.waitForTimeout(300);
    if (
      rabFormBefore !== 0 ||
      !(await rabTable.locator("[data-rab-form]").isVisible())
    )
      fail(`${label} rab builder not behind + button`);
    else ok(`${label} rab builder hidden behind + button`);
    await rabTable.locator("[data-rab-toggle]").click(); // tutup builder
    await page.waitForTimeout(200);
    // Setujui sekali-klik (Q45): baris sent → #/transaksi + notice, tanpa confirm.
    const setujuiBtn = rabTable.getByRole("button", {
      name: "Setujui",
      exact: true,
    });
    await setujuiBtn
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await setujuiBtn.first().click();
    await page.waitForTimeout(600);
    const rabBanner =
      (await page.locator('[role="status"]').textContent()) ?? "";
    if (page.url().split("#")[1] !== "/transaksi")
      fail(`${label} setujui: hash is ${page.url()}`);
    else if (rabBanner.includes("disetujui"))
      ok(`${label} setujui 1-klik → #/transaksi + notice`);
    else fail(`${label} setujui: notice missing (${rabBanner})`);
    // Buat RAB dari Paket (Q19): salin baris → auto-pindah #/rab + builder terisi.
    await navRab("Paket", "Paket 1 Camera");
    await page
      .getByRole("button", { name: "Buat RAB", exact: true })
      .first()
      .click();
    await page.waitForTimeout(600);
    if (page.url().split("#")[1] === "/rab") {
      const bform = page.locator('[data-view="rab"] [data-rab-form]');
      const btxt = (await bform.textContent()) ?? "";
      if ((await bform.isVisible()) && btxt.includes("SONY FDR AX-40"))
        ok(`${label} buat RAB → #/rab + baris tersalin ke builder`);
      else fail(`${label} buat RAB: builder kosong / baris tak tersalin`);
    } else fail(`${label} buat RAB: hash is ${page.url()}`);
    // Confirm-timpa (Q21): builder sudah terisi → klik Buat RAB lagi muncul confirm.
    await navRab("Paket", "Paket 1 Camera");
    let rabConfirmShown = false;
    page.once("dialog", (d) => {
      rabConfirmShown = true;
      d.dismiss();
    });
    await page
      .getByRole("button", { name: "Buat RAB", exact: true })
      .first()
      .click();
    await page.waitForTimeout(400);
    if (rabConfirmShown)
      ok(`${label} buat RAB confirm-timpa saat builder terisi`);
    else fail(`${label} buat RAB: confirm-timpa tidak muncul`);

    // --- Paket CRUD UI (redesign 07, #60) ---
    // Tambah di balik + (Q23); expand grup kategori + subtotal + total;
    // Ubah = form terisi baris lama (PATCH wholesale, dokumen lama utuh);
    // tanpa DELETE (spirit B4); Buat RAB tetap jalan.
    await navRab("Paket", "Paket 1 Camera");
    const pkView = page.locator('[data-view="paket"]');
    const pkTxt = () => pkView.textContent();
    // Judul kiri + aksi kanan (Q5); form tambah tersembunyi sebelum + diklik.
    if ((await pkView.locator("[data-paket-toggle]").count()) !== 1)
      fail(`${label} paket: tombol + Paket baru hilang`);
    if ((await pkView.locator("[data-paket-form]").count()) !== 0)
      fail(`${label} paket: form tambah harus tersembunyi default`);
    // Tanpa DELETE (B4): tak ada tombol hapus paket di mana pun.
    if (
      (await pkView.getByRole("button", { name: /Hapus paket/i }).count()) !== 0
    )
      fail(`${label} paket: tombol hapus paket ada — tanpa DELETE (B4)`);
    // Expand: grup kategori + subtotal + total (plek dokumen, Q15).
    await pkView
      .locator("[data-paket-card]")
      .first()
      .getByRole("button", { name: /baris/ })
      .click();
    await page.waitForTimeout(350);
    const pkExp = (await pkTxt()) ?? "";
    if (
      !pkExp.includes("PRODUCTION") ||
      !pkExp.includes("subtotal") ||
      !pkExp.includes("SONY FDR AX-40")
    )
      fail(`${label} paket expand: grup kategori/subtotal hilang`);
    else ok(`${label} paket expand grup kategori + subtotal`);
    // Form tambah di balik + (Q23); tutup = buang isian.
    await pkView.locator("[data-paket-toggle]").click();
    await page.waitForTimeout(250);
    if ((await pkView.locator("[data-paket-form]").count()) === 1) {
      // Tambah baris kategori/jenis/qty/satuan/rate + subtotal & total tampil.
      const f = pkView.locator("[data-paket-form]");
      await f.locator("input[name=nama]").fill("Paket Dokumentasi");
      await f.locator("[data-pk-item]").fill("Dokumentasi foto");
      await f.locator("[data-pk-jenis]").selectOption("jasa");
      await f.locator("[data-pk-qty]").fill("2");
      await f.locator("[data-pk-satuan]").fill("Sesi");
      await f.locator("[data-pk-harga]").fill("400000");
      await f.locator("[data-pk-tambah-baris]").click();
      await page.waitForTimeout(250);
      const ftxt = (await f.textContent()) ?? "";
      if (!ftxt.includes("Dokumentasi foto") || !ftxt.includes("800.000"))
        fail(`${label} paket tambah: baris/subtotal tak tampil`);
      else ok(`${label} paket tambah form + baris + subtotal tampil`);
      // Simpan → POST /api/paket terkirim (201 di stub) + notice.
      await f.getByRole("button", { name: /Simpan paket/ }).click();
      await page.waitForTimeout(500);
      const post = writes.find(
        (w) => w.method === "POST" && w.path === "/api/paket",
      );
      if (post) {
        let sent = {};
        try {
          sent = JSON.parse(post.body);
        } catch {
          fail(`${label} paket tambah: body POST bukan JSON: ${post.body}`);
        }
        if (
          sent.nama === "Paket Dokumentasi" &&
          Array.isArray(sent.baris) &&
          sent.baris.length === 1 &&
          sent.baris[0].qty === 2 &&
          sent.baris[0].harga_satuan === 400000
        )
          ok(`${label} paket tambah → POST kontrak benar`);
        else if (sent.nama !== undefined)
          fail(`${label} paket tambah: body POST salah: ${post.body}`);
      } else fail(`${label} paket tambah: POST /api/paket tak tercatat`);
    } else fail(`${label} paket: form tambah tak terbuka di balik +`);
    // Ubah paket (PATCH wholesale): form terisi baris lama + notice snapshot.
    {
      const card2 = pkView.locator('[data-paket-card][data-paket-id="2"]');
      await card2.getByRole("button", { name: "Ubah", exact: true }).click();
      await page.waitForTimeout(300);
      const uf = card2.locator("[data-paket-edit-form]");
      if ((await uf.count()) === 1) {
        const utxt = (await uf.textContent()) ?? "";
        if (
          !utxt.includes("SONY NXR-100") ||
          !utxt.includes("tidak mengubah RAB/Transaksi lama")
        )
          fail(`${label} paket ubah: baris lama / notice snapshot hilang`);
        // Tambah baris LOGISTIK → PATCH baris wholesale terkirim.
        await uf.locator("[data-pk-item]").fill("INTERNET");
        await uf.locator("[data-pk-jenis]").selectOption("biaya");
        await uf.locator("[data-pk-kategori]").selectOption("LOGISTIK");
        await uf.locator("[data-pk-qty]").fill("1");
        await uf.locator("[data-pk-satuan]").fill("Sesi");
        await uf.locator("[data-pk-harga]").fill("150000");
        await uf.locator("[data-pk-tambah-baris]").click();
        await page.waitForTimeout(250);
        await uf.getByRole("button", { name: /Simpan perubahan/ }).click();
        await page.waitForTimeout(500);
        const patch = writes.find(
          (w) => w.method === "PATCH" && w.path === "/api/paket/2",
        );
        if (patch) {
          let sent = {};
          try {
            sent = JSON.parse(patch.body);
          } catch {
            fail(`${label} paket ubah: body PATCH bukan JSON: ${patch.body}`);
          }
          if (
            Array.isArray(sent.baris) &&
            sent.baris.length === 2 &&
            sent.baris[1].kategori === "LOGISTIK" &&
            sent.baris[1].harga_satuan === 150000
          )
            ok(`${label} paket ubah → PATCH baris wholesale (snapshot aman)`);
          else if (sent.baris !== undefined)
            fail(`${label} paket ubah: body PATCH salah: ${patch.body}`);
        } else fail(`${label} paket ubah: PATCH /api/paket/2 tak tercatat`);
      } else fail(`${label} paket ubah: form edit tak terbuka`);
    }

    await go("Settings", "No. rekening");
    // Settings (#61): sebut path logo kop cetak (Q29) — identitas/bank tetap.
    const logoNote = (await page.locator("[data-logo-note]").textContent()) ?? "";
    if (
      !logoNote.includes("public/img/logo-red.png") ||
      !logoNote.includes("img/logo-red.png")
    )
      fail(`${label} settings: path logo kop cetak hilang`);
    else ok(`${label} settings logo path + identitas/bank`);
    await go("Invoice", "INV-2026-0001");
    // Browser back returns to the previous view via hash history (Q35).
    await page.goBack();
    await page.waitForTimeout(450);
    if (page.url().split("#")[1] === "/settings")
      ok(`${label} browser back → #/settings`);
    else fail(`${label} back: hash is ${page.url()}`);

    if (isDesktop) {
      // Badges (Q29): 2 invoice belum-lunas (merah, stub ada overdue),
      // 1 transaksi aktif (navy). 0 = badge hilang.
      const invBadge = sidebar.locator("[data-badge-invoice]");
      if (
        (await invBadge.textContent()) !== "2" ||
        !(await invBadge.getAttribute("class")).includes("bg-magenta-bloom")
      )
        fail(`${label} invoice badge: expected red 2`);
      const txBadge = sidebar.locator("[data-badge-transaksi]");
      if (
        (await txBadge.textContent()) !== "2" ||
        !(await txBadge.getAttribute("class")).includes("bg-navy-ink")
      )
        fail(`${label} transaksi badge: expected navy 2`);
      if (!(await sidebar.textContent()).includes("Keluar"))
        fail(`${label} sidebar: no user/Keluar at bottom`);
    } else {
      // Drawer sopan (Q36): Esc, klik-luar, back, pilih menu semuanya menutup.
      const drawer = page.locator("[data-drawer]");
      await page.locator("button[aria-label='Buka menu']").click();
      await page.waitForTimeout(300);
      if (!(await drawer.isVisible())) fail("mobile drawer: not open");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      if (await drawer.isVisible()) fail("mobile drawer: Esc did not close");
      await page.locator("button[aria-label='Buka menu']").click();
      await page.waitForTimeout(300);
      // Tombol back browser juga menutup drawer (entri pushState terkonsumsi).
      await page.goBack();
      await page.waitForTimeout(300);
      if (await drawer.isVisible()) fail("mobile drawer: back did not close");
      else ok("mobile drawer: Esc/back close");
      await page.locator("button[aria-label='Buka menu']").click();
      await page.waitForTimeout(300);
      // Klik di luar panel drawer (kanan dari panel 260px) menutup.
      await page
        .locator("button[aria-label='Tutup menu']")
        .click({ position: { x: 350, y: 400 } });
      await page.waitForTimeout(300);
      if (await drawer.isVisible())
        fail("mobile drawer: outside-tap did not close");
      await page.locator("button[aria-label='Buka menu']").click();
      await page.waitForTimeout(300);
      await drawer.getByRole("button", { name: "Paket", exact: true }).click();
      await page.waitForTimeout(450);
      if (await drawer.isVisible()) fail("mobile drawer: select did not close");
      if (page.url().split("#")[1] === "/paket")
        ok("mobile drawer: outside/select close, select lands on hash");
      else fail(`mobile drawer: hash ${page.url()} after select`);
    }
    if (errs.length)
      fail(`${label} dashboard: console errors: ${errs.join(" // ")}`);
    else ok(`${label} dashboard renders all 7 views, 0 console errors`);
    await page.close();
  }
}

// Landing regression: index untouched.
{
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errs = [];
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text());
  });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(`${base}/index.html`);
  await page.waitForTimeout(1200);
  if (errs.length) fail(`index regression: ${errs.join(" // ")}`);
  else ok("index untouched, 0 console errors");
  await page.close();
}

await browser.close();
server.close();
process.exit(failures ? 1 : 0);
