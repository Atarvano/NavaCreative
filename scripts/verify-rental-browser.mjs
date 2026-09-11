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
  '/api/alat': {
    alat: [
      { id: 1, nama: 'Sony NXR-100', harga_beli: 10_000_000, tarif_event: 350_000, is_active: 1, modal: 12_000_000, pendapatan: 12_000_000, balik_modal: true },
      { id: 2, nama: 'Tripod B-18', harga_beli: 500_000, tarif_event: 50_000, is_active: 1, modal: 500_000, pendapatan: 0, balik_modal: false },
    ],
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
  // Dashboard: alat list + both badge states render, no console errors.
  {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`${base}/dashboard.html`);
    await page.waitForTimeout(900);
    const body = (await page.locator('#app').innerText()) ?? '';
    const checks = [
      ['NXR-100 row', body.includes('Sony NXR-100')],
      ['paid-off badge', body.includes('Balik modal')],
      ['unpaid badge', body.includes('Belum balik modal')],
      ['modal math shown', body.includes('Rp 12.000.000')],
      ['add form', (await page.locator('input[name=nama]').count()) === 1],
    ];
    const bad = checks.filter(([, v]) => !v).map(([n]) => n);
    if (bad.length) fail(`${label} dashboard: missing ${bad.join(', ')}`);
    else if (errs.length) fail(`${label} dashboard: console errors: ${errs.join(' // ')}`);
    else ok(`${label} dashboard renders (badges + math), 0 console errors`);
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
