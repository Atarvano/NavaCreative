// verify-rental-browser.mjs: browser verification for the rental dashboard.
// Serves dist/ locally with a minimal /api/* stub (production serves /api/*
// from the Worker; the static preview has no API), loads login + dashboard
// at desktop + mobile widths, fails on console errors / pageerrors.
// Usage: node scripts/verify-rental-browser.mjs
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = resolve('dist');
const CHROME =
  process.env.CHROME_PATH ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

// Stub: logged in as admin; two alat — one paid off, one not — so the
// balik-modal badge branch renders in the browser (pendapatan counts only
// jenis=alat rows per Q13; transaksi tables land in #44, stub fakes it).
const STUB = {
  '/api/auth/me': { username: 'admin' },
  '/api/settings': { settings: { nama: 'Nava Production', hp: '085817999140', email: 'navaproduction9@gmail.com', bank: 'BCA', norek: '8335463109', atas_nama: 'Luthfi Ahmad Zaidan' } },
  '/api/invoice': {
    invoice: [
      { id: 1, transaksi_id: 1, nomor: 'INV-2026-0001', tanggal_terbit: '2026-08-17', jatuh_tempo: '2026-08-24', total: 5500000, bank_snapshot: 'BCA 8335463109 Luthfi Ahmad Zaidan', status: 'partial', dibayar: 2000000, sisa: 3500000, overdue: false },
      // Overdue: cabang badge merah + chip merah 'overdue' (Q29).
      { id: 2, transaksi_id: 2, nomor: 'INV-2026-0002', tanggal_terbit: '2026-08-01', jatuh_tempo: '2026-08-07', total: 900000, bank_snapshot: 'BCA 8335463109 Luthfi Ahmad Zaidan', status: 'unpaid', dibayar: 0, sisa: 900000, overdue: true },
    ],
  },
  '/api/transaksi': {
    transaksi: [
      {
        id: 1, rab_id: null, nama_project: 'Drone Bandar Baru', nama_client: 'Pak Suhaimi', perusahaan_client: '',
        tanggal_mulai: '2026-08-17', tanggal_selesai: '2026-08-17', lokasi: 'Bandar Baru',
        status: 'terjadwal', diskon: 0, total: 600000,
        baris: [
          { id: 1, kategori: 'PRODUCTION', jenis: 'jasa', nama: 'Jasa Drone', qty: 1, satuan: 'Sesi', harga_satuan: 350000 },
          { id: 2, kategori: 'PRODUCTION', jenis: 'jasa', nama: 'Jasa Edit', qty: 1, satuan: 'Sesi', harga_satuan: 250000 },
        ],
      },
    ],
  },
  '/api/alat': {
    alat: [
      { id: 1, nama: 'Sony NXR-100', harga_beli: 10_000_000, tarif_event: 350_000, is_active: 1, modal: 12_000_000, pendapatan: 12_000_000, balik_modal: true },
      { id: 2, nama: 'Tripod B-18', harga_beli: 500_000, tarif_event: 50_000, is_active: 1, modal: 500_000, pendapatan: 0, balik_modal: false },
    ],
  },
  '/api/paket': {
    paket: [
      {
        id: 1, nama: 'Paket 1 Camera', deskripsi: '', total: 1415000,
        subtotal: { PRODUCTION: 1115000, LOGISTIK: 150000, MISC: 150000 },
        baris: [
          { id: 1, kategori: 'PRODUCTION', jenis: 'alat', nama: 'SONY FDR AX-40', qty: 1, satuan: 'Unit', harga_satuan: 100000 },
          { id: 6, kategori: 'PRODUCTION', jenis: 'jasa', nama: 'OPERATOR', qty: 2, satuan: 'Orang', harga_satuan: 250000 },
        ],
      },
      {
        id: 2, nama: 'Paket 2 Camera', deskripsi: '', total: 2380000,
        subtotal: { PRODUCTION: 2080000, LOGISTIK: 150000, MISC: 150000 },
        baris: [
          { id: 9, kategori: 'PRODUCTION', jenis: 'alat', nama: 'SONY NXR-100', qty: 1, satuan: 'Unit', harga_satuan: 350000 },
        ],
      },
    ],
  },
  '/api/rab': {
    rab: [
      {
        id: 1, nomor: 'RAB-2026-0001', nama_project: 'Nikahan Soleh', tanggal_rab: '2026-08-02',
        nama_client: 'Soleh Permana', perusahaan_client: '', status: 'sent', diskon: 50000, total: 3250000, catatan: '',
        subtotal: { PRODUCTION: 3200000, LOGISTIK: 100000 },
        baris: [
          { id: 1, kategori: 'PRODUCTION', jenis: 'alat', nama: 'Live Streaming 2 camera', qty: 1, satuan: 'Hari', harga_satuan: 3200000 },
          { id: 2, kategori: 'LOGISTIK', jenis: 'biaya', nama: 'Transportasi', qty: 1, satuan: 'Hari', harga_satuan: 100000 },
        ],
      },
    ],
  },
  '/api/ringkasan': {
    total_modal: 12500000, total_pendapatan: 12000000, piutang: 3500000,
    per_alat: [
      { id: 1, nama: 'Sony NXR-100', modal: 12000000, pendapatan: 12000000, balik_modal: true },
      { id: 2, nama: 'Tripod B-18', modal: 500000, pendapatan: 0, balik_modal: false },
    ],
    belum_lunas: [{ id: 1, nomor: 'INV-2026-0001', sisa: 3500000, jatuh_tempo: '2026-08-24', status: 'partial' }],
    overdue: [],
    recent: [{ id: 1, nama_project: 'Drone Bandar Baru', nama_client: 'Pak Suhaimi', total: 600000, status: 'terjadwal' }],
  },
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (STUB[urlPath]) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(STUB[urlPath]));
    return;
  }
  const path = join(DIST, urlPath);
  if (!existsSync(path)) {
    res.writeHead(404);
    res.end('nope');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'text/plain' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`FAIL ${msg}`);
};
const ok = (msg) => console.log(`ok   ${msg}`);

for (const [label, w, h] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
  // Login page: form renders, no console errors.
  {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`${base}/login.html`);
    await page.waitForTimeout(800);
    const hasForm = (await page.locator('form').count()) >= 1
      && (await page.locator('input[name=username]').count()) === 1
      && (await page.locator('input[name=password]').count()) === 1;
    if (!hasForm) fail(`${label} login: form incomplete`);
    else if (errs.length) fail(`${label} login: console errors: ${errs.join(' // ')}`);
    else ok(`${label} login renders, 0 console errors`);
    await page.close();
  }
  // Dashboard: sidebar shell + hash nav + drawer, all views render.
  {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    const isDesktop = w >= 768;
    // Deep link: hash #/invoice lands on the Invoice view (Q35).
    await page.goto(`${base}/dashboard.html#/invoice`);
    await page.waitForTimeout(900);
    const sidebar = page.locator('[data-sidebar]');
    // Sidebar visible on desktop, hidden behind drawer on mobile (ADR-0012).
    if ((await sidebar.isVisible()) !== isDesktop)
      fail(`${label} sidebar: visibility wrong (visible=${await sidebar.isVisible()}, desktop=${isDesktop})`);
    const invBody = (await page.locator('#app').textContent()) ?? '';
    if (!invBody.includes('INV-2026-0001') || !invBody.includes('Tempo 24 Agu 2026'))
      fail(`${label} hash #/invoice: invoice view not shown`);
    else ok(`${label} hash #/invoice lands on Invoice (tanggal Indonesia)`);

    const go = async (navLabel, text) => {
      // Non-exact: badge count ikut nama aksesibel tombol (e.g. "Transaksi 1").
      if (isDesktop) await sidebar.getByRole('button', { name: navLabel }).click();
      else {
        await page.locator("button[aria-label='Buka menu']").click();
        await page.waitForTimeout(250);
        await page.locator('[data-drawer]').getByRole('button', { name: navLabel }).click();
      }
      await page.waitForTimeout(450);
      const body = (await page.locator('#app').textContent()) ?? '';
      if (!body.includes(text)) fail(`${label} view ${navLabel}: missing ${text}`);
    };
    await go('Ringkasan', 'Rp 12.500.000');
    await go('Alat', 'Sony NXR-100');
    await go('Paket', 'Paket 1 Camera');
    await go('RAB', 'RAB-2026-0001');
    await go('Transaksi', 'Drone Bandar Baru');
    await go('Settings', 'No. rekening');
    await go('Invoice', 'INV-2026-0001');
    // Browser back returns to the previous view via hash history (Q35).
    await page.goBack();
    await page.waitForTimeout(450);
    if (page.url().split('#')[1] === '/settings') ok(`${label} browser back → #/settings`);
    else fail(`${label} back: hash is ${page.url()}`);

    if (isDesktop) {
      // Badges (Q29): 2 invoice belum-lunas (merah, stub ada overdue),
      // 1 transaksi aktif (navy). 0 = badge hilang.
      const invBadge = sidebar.locator('[data-badge-invoice]');
      if ((await invBadge.textContent()) !== '2' || !(await invBadge.getAttribute('class')).includes('bg-magenta-bloom'))
        fail(`${label} invoice badge: expected red 2`);
      const txBadge = sidebar.locator('[data-badge-transaksi]');
      if ((await txBadge.textContent()) !== '1' || !(await txBadge.getAttribute('class')).includes('bg-navy-ink'))
        fail(`${label} transaksi badge: expected navy 1`);
      if (!(await sidebar.textContent()).includes('Keluar')) fail(`${label} sidebar: no user/Keluar at bottom`);
    } else {
      // Drawer sopan (Q36): Esc, klik-luar, back, pilih menu semuanya menutup.
      const drawer = page.locator('[data-drawer]');
      await page.locator("button[aria-label='Buka menu']").click();
      await page.waitForTimeout(300);
      if (!(await drawer.isVisible())) fail('mobile drawer: not open');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      if (await drawer.isVisible()) fail('mobile drawer: Esc did not close');
      await page.locator("button[aria-label='Buka menu']").click();
      await page.waitForTimeout(300);
      // Tombol back browser juga menutup drawer (entri pushState terkonsumsi).
      await page.goBack();
      await page.waitForTimeout(300);
      if (await drawer.isVisible()) fail('mobile drawer: back did not close');
      else ok('mobile drawer: Esc/back close');
      await page.locator("button[aria-label='Buka menu']").click();
      await page.waitForTimeout(300);
      // Klik di luar panel drawer (kanan dari panel 260px) menutup.
      await page.locator("button[aria-label='Tutup menu']").click({ position: { x: 350, y: 400 } });
      await page.waitForTimeout(300);
      if (await drawer.isVisible()) fail('mobile drawer: outside-tap did not close');
      await page.locator("button[aria-label='Buka menu']").click();
      await page.waitForTimeout(300);
      await drawer.getByRole('button', { name: 'Paket', exact: true }).click();
      await page.waitForTimeout(450);
      if (await drawer.isVisible()) fail('mobile drawer: select did not close');
      if (page.url().split('#')[1] === '/paket') ok('mobile drawer: outside/select close, select lands on hash');
      else fail(`mobile drawer: hash ${page.url()} after select`);
    }
    if (errs.length) fail(`${label} dashboard: console errors: ${errs.join(' // ')}`);
    else ok(`${label} dashboard renders all 7 views, 0 console errors`);
    await page.close();
  }
}

// Landing regression: index untouched.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${base}/index.html`);
  await page.waitForTimeout(1200);
  if (errs.length) fail(`index regression: ${errs.join(' // ')}`);
  else ok('index untouched, 0 console errors');
  await page.close();
}

await browser.close();
server.close();
process.exit(failures ? 1 : 0);
