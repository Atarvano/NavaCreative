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

// Stub: logged in as admin; two alat — one paid off, one not — so the
// balik-modal badge branch renders in the browser (pendapatan counts only
// jenis=alat rows per Q13; transaksi tables land in #44, stub fakes it).
const STUB = {
  "/api/auth/me": { username: "admin" },
  "/api/settings": {
    settings: {
      nama: "Nava Production",
      hp: "085817999140",
      email: "navaproduction9@gmail.com",
      bank: "BCA",
      norek: "8335463109",
      atas_nama: "Luthfi Ahmad Zaidan",
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
      {
        id: 2,
        nama: "Tripod B-18",
        harga_beli: 500_000,
        tarif_event: 50_000,
        is_active: 1,
        modal: 500_000,
        pendapatan: 0,
        balik_modal: false,
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
    piutang: 3500000,
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
    ],
    overdue: [],
    recent: [
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
  if (STUB[urlPath]) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(STUB[urlPath]));
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
    if (!hasForm) fail(`${label} login: form incomplete`);
    else if (errs.length)
      fail(`${label} login: console errors: ${errs.join(" // ")}`);
    else ok(`${label} login renders, 0 console errors`);
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
    if (
      !invBody.includes("INV-2026-0001") ||
      !invBody.includes("Tempo 24 Agu 2026")
    )
      fail(`${label} hash #/invoice: invoice view not shown`);
    else ok(`${label} hash #/invoice lands on Invoice (tanggal Indonesia)`);

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
    await go("Ringkasan", "Rp 12.500.000");
    await go("Alat", "Sony NXR-100");
    await go("Paket", "Paket 1 Camera");
    await go("RAB", "RAB-2026-0001");
    await go("Transaksi", "Drone Bandar Baru");

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
    // Navigasi langsung (desktop: sidebar; mobile: drawer) — go() hanya
    // memverifikasi, tak mengembalikan hash.
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
      if (!body.includes(text)) fail(`${label} view ${navLabel}: missing ${text}`);
    };
    await navRab("RAB", "RAB-2026-0001");
    const rabTable = page.locator('[data-view="rab"]');
    // Judul-kiri + tombol-kanan (Q5): tombol + RAB baru di header.
    if (!(await rabTable.locator("[data-rab-toggle]").isVisible()))
      fail(`${label} rab: no + RAB baru header button`);
    // 3 baris stub; default urutan API id DESC → terbaru (approved) di atas.
    if ((await rabTable.locator("table tbody tr").count()) !== 3)
      fail(`${label} rab table: expected 3 rows`);
    const rabFirst = await rabTable.locator("table tbody tr").first().textContent();
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
    const rabDesc = await rabTable.locator("table tbody tr").first().textContent();
    if ((rabDesc ?? "").includes("Rp 3.250.000")) ok(`${label} rab sort desc by total`);
    else fail(`${label} rab sort desc: first row not 3.250.000`);
    // Sort cycle: klik kedua = asc (600.000 di atas).
    await rabTable.getByRole("button", { name: /Total/ }).click();
    await page.waitForTimeout(300);
    const rabAsc = await rabTable.locator("table tbody tr").first().textContent();
    if (!(rabAsc ?? "").includes("Rp 600.000"))
      fail(`${label} rab sort asc: first row not 600.000`);
    await rabTable.getByRole("button", { name: /Total/ }).click();
    await page.waitForTimeout(300);
    // Expand: Rincian → grup kategori + subtotal + aksi sekunder (Tolak/Revisi/Cetak).
    const rabRincian = rabTable.getByRole("button", { name: "Rincian", exact: true });
    await rabRincian.first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    await rabRincian.first().click();
    await page.waitForTimeout(400);
    const rabExp = (await rabTable.textContent()) ?? "";
    if (!rabExp.includes("subtotal") || !rabExp.includes("PRODUCTION"))
      fail(`${label} rab expand: no category group/subtotal`);
    else if (rabExp.includes("Cetak")) ok(`${label} rab expand grup/subtotal + aksi sekunder`);
    // Single-open: buka baris lain menutup yang pertama.
    const rabRincian2 = rabTable.getByRole("button", { name: "Rincian", exact: true });
    await rabRincian2.first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    await rabRincian2.first().click();
    await page.waitForTimeout(400);
    const rabOpenCount = await rabTable.getByRole("button", { name: "Tutup", exact: true }).count();
    if (rabOpenCount === 1) ok(`${label} rab expand single-open`);
    else fail(`${label} rab expand: not single-open (${rabOpenCount})`);
    // Builder di balik + (Q23): form tersembunyi sampai tombol + diklik.
    await rabTable.getByRole("button", { name: "Tutup", exact: true }).first().click();
    await page.waitForTimeout(200);
    const rabFormBefore = await rabTable.locator("[data-rab-form]").count();
    await rabTable.locator("[data-rab-toggle]").click();
    await page.waitForTimeout(300);
    if (rabFormBefore !== 0 || !(await rabTable.locator("[data-rab-form]").isVisible()))
      fail(`${label} rab builder not behind + button`);
    else ok(`${label} rab builder hidden behind + button`);
    await rabTable.locator("[data-rab-toggle]").click(); // tutup builder
    await page.waitForTimeout(200);
    // Setujui sekali-klik (Q45): baris sent → #/transaksi + notice, tanpa confirm.
    const setujuiBtn = rabTable.getByRole("button", { name: "Setujui", exact: true });
    await setujuiBtn.first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    await setujuiBtn.first().click();
    await page.waitForTimeout(600);
    const rabBanner = (await page.locator('[role="status"]').textContent()) ?? "";
    if (page.url().split("#")[1] !== "/transaksi")
      fail(`${label} setujui: hash is ${page.url()}`);
    else if (rabBanner.includes("disetujui"))
      ok(`${label} setujui 1-klik → #/transaksi + notice`);
    else fail(`${label} setujui: notice missing (${rabBanner})`);
    // Buat RAB dari Paket (Q19): salin baris → auto-pindah #/rab + builder terisi.
    await navRab("Paket", "Paket 1 Camera");
    await page.getByRole("button", { name: "Buat RAB", exact: true }).first().click();
    await page.waitForTimeout(600);
    if (page.url().split("#")[1] === "/rab"){
      const bform = page.locator('[data-view="rab"] [data-rab-form]');
      const btxt = (await bform.textContent()) ?? "";
      if ((await bform.isVisible()) && btxt.includes("SONY FDR AX-40"))
        ok(`${label} buat RAB → #/rab + baris tersalin ke builder`);
      else fail(`${label} buat RAB: builder kosong / baris tak tersalin`);
    } else 
      fail(`${label} buat RAB: hash is ${page.url()}`);
    // Confirm-timpa (Q21): builder sudah terisi → klik Buat RAB lagi muncul confirm.
    await navRab("Paket", "Paket 1 Camera");
    let rabConfirmShown = false;
    page.once("dialog", (d) => {
      rabConfirmShown = true;
      d.dismiss();
    });
    await page.getByRole("button", { name: "Buat RAB", exact: true }).first().click();
    await page.waitForTimeout(400);
    if (rabConfirmShown) ok(`${label} buat RAB confirm-timpa saat builder terisi`);
    else fail(`${label} buat RAB: confirm-timpa tidak muncul`);

    await go("Settings", "No. rekening");
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
