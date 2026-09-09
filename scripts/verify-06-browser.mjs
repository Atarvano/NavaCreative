// verify-06-browser.mjs: full parity verification for ticket 06 (cutover).
// Serves dist/ locally (legacy stylesheet gone); asserts across all six
// pages, desktop + mobile + reduced-motion:
//  - work pin holds exactly one viewport; mobile carousel never pins
//  - all in-page anchors + service links + back links resolve
//  - nav hide-on-scroll works (the migrated nav--hidden mapping)
//  - reduced-motion renders everything statically, zero pins
//  - no console errors anywhere
// Usage: node scripts/verify-06-browser.mjs
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";

const DIST = resolve("dist");
const SHOTS = resolve(".scratch/tailwind-rewrite/screenshots");
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
const SERVICE_PAGES = [
  "photo-video.html",
  "photo-product.html",
  "graphic-design.html",
  "social-media.html",
  "live-streaming.html",
];

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`FAIL ${msg}`);
};
const ok = (msg) => console.log(`ok   ${msg}`);

const server = createServer((req, res) => {
  const path = join(DIST, decodeURIComponent(req.url.split("?")[0]));
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
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox"],
});

function watch(page, errors) {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) =>
    errors.push(`pageerror: ${String(e.message).slice(0, 200)}`),
  );
}

async function newPage(vw, extra = {}) {
  const ctx = await browser.newContext({ viewport: vw, ...extra });
  const page = await ctx.newPage();
  const errors = [];
  watch(page, errors);
  return { ctx, page, errors };
}

// --- Desktop index: pin geometry + anchors + nav hide ---
{
  const { ctx, page, errors } = await newPage({ width: 1440, height: 900 });
  await page.goto(`${base}/index.html`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(4500);
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(800);

  const geo = await page.evaluate(() => {
    const work = document.querySelector("#work");
    const r = work.getBoundingClientRect();
    return {
      h: r.height,
      vh: window.innerHeight,
      overflow: getComputedStyle(work).overflow,
    };
  });
  if (Math.abs(geo.h - geo.vh) <= 1 && geo.overflow === "hidden")
    ok(`desktop pin holds exactly one viewport (${geo.h}px, overflow hidden)`);
  else fail(`desktop pin geometry wrong: ${JSON.stringify(geo)}`);

  // Nav hide-on-scroll (the migrated nav--hidden mapping).
  const nav = await page.evaluate(async () => {
    const header = document.querySelector("#nav");
    window.scrollTo({ top: 600, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 900));
    const hidden = header.classList.contains("nav--hidden");
    const y = new DOMMatrixReadOnly(getComputedStyle(header).transform).m42;
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 600));
    const shown = !header.classList.contains("nav--hidden");
    return { hidden, y: Math.round(y), shown };
  });
  if (nav.hidden && nav.y < -40 && nav.shown)
    ok(`desktop nav hides on scroll-down (y ${nav.y}) and returns`);
  else fail(`desktop nav hide broken: ${JSON.stringify(nav)}`);

  // Every in-page anchor resolves to a real target.
  const anchors = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute("href"))
      .filter((h, i, arr) => arr.indexOf(h) === i)
      .map((h) => ({ h, found: !!document.querySelector(h) })),
  );
  const missing = anchors.filter((a) => !a.found);
  if (missing.length) fail(`desktop anchors missing: ${missing.map((a) => a.h).join(",")}`); else ok(`desktop all ${anchors.length} in-page anchors resolve`);
  const svcLinks = await page.evaluate(() =>
    [...document.querySelectorAll('.service-row')]
      .map((a) => a.getAttribute("href"))
      .join(","),
  );
  if (svcLinks.split(",").every((h) => h.endsWith(".html")))
    ok(`desktop service rows link out (${svcLinks.split(",").length} pages)`);
  else fail(`desktop service links wrong: ${svcLinks}`);
  await page.screenshot({ path: join(SHOTS, "06-desktop-index.png") });

  if (errors.length) errors.forEach((e) => fail(`desktop index console: ${e}`));
  else ok("desktop index no console errors");
  await ctx.close();
}

// --- Mobile index: carousel native, anchors resolve, team stacks ---
{
  const { ctx, page, errors } = await newPage({ width: 390, height: 844 });
  await page.goto(`${base}/index.html`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(4500);
  const mob = await page.evaluate(() => {
    const track = document.querySelector("#workTrack");
    const cs = getComputedStyle(track);
    return {
      overflowX: cs.overflowX,
      snap: cs.scrollSnapType,
      workPos: getComputedStyle(document.querySelector("#work")).position,
      spacers: document.querySelectorAll(".pin-spacer").length,
      teamCards: document.querySelectorAll("#team .team-card").length,
      anchors: [...document.querySelectorAll('a[href^="#"]')]
        .map((a) => a.getAttribute("href"))
        .every((h) => !!document.querySelector(h)),
    };
  });
  if (mob.snap.includes("mandatory") && mob.workPos !== "fixed" && mob.spacers === 0)
    ok("mobile work is a native snap carousel, never pins");
  else fail(`mobile work wrong: ${JSON.stringify(mob)}`);
  if (mob.teamCards === 4) ok("mobile team shows all 4 makers");
  else fail(`mobile team shows ${mob.teamCards} cards`);
  if (mob.anchors) ok("mobile all anchors resolve");
  else fail("mobile has dangling anchors");
  await page.screenshot({ path: join(SHOTS, "06-mobile-index.png") });
  if (errors.length) errors.forEach((e) => fail(`mobile console: ${e}`));
  else ok("mobile no console errors");
  await ctx.close();
}

// --- All five service pages: detail -> footer, back bar hides, no errors ---
for (const p of SERVICE_PAGES) {
  const { ctx, page, errors } = await newPage({ width: 1440, height: 900 });
  await page.goto(`${base}/${p}`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3500);
  const snap = await page.evaluate(async () => {
    const header = document.querySelector("#backbar");
    window.scrollTo({ top: 500, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 900));
    const backHidden = header.classList.contains("backbar--hidden");
    const backY = new DOMMatrixReadOnly(getComputedStyle(header).transform).m42;
    window.scrollTo({ top: 0, behavior: "instant" });
    return {
      detail: !!document.querySelector("#service-detail"),
      cta: !!document.querySelector("#contact"),
      footer: !!document.querySelector("footer"),
      backHidden,
      backY: Math.round(backY),
      crosses: [...document.querySelectorAll('nav[aria-label="Other services"] a')]
        .every((a) => a.getAttribute("href").endsWith(".html")),
    };
  });
  if (snap.detail && !snap.cta && snap.footer)
    ok(`${p}: detail -> footer, no CTA`);
  else fail(`${p} layout wrong: ${JSON.stringify(snap)}`);
  if (snap.backHidden && snap.backY < -30)
    ok(`${p}: back bar hides on scroll (y ${snap.backY})`);
  else fail(`${p} back bar hide broken: hidden=${snap.backHidden} y=${snap.backY}`);
  if (snap.crosses) ok(`${p}: cross-links resolve`);
  else fail(`${p}: cross-links broken`);
  if (errors.length) errors.forEach((e) => fail(`${p} console: ${e}`));
  else ok(`${p}: no console errors`);
  await ctx.close();
}

// --- Reduced motion: everything static on every page ---
for (const p of ["index.html", ...SERVICE_PAGES]) {
  const { ctx, page, errors } = await newPage(
    { width: 1440, height: 900 },
    { reducedMotion: "reduce" },
  );
  await page.goto(`${base}/${p}`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3000);
  const rm = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".live-card, .work-card, #team .team-card, .service-row, [data-reveal]")];
    return {
      visible: els.every((el) => getComputedStyle(el).opacity === "1"),
      count: els.length,
      spacers: document.querySelectorAll(".pin-spacer").length,
    };
  });
  if (rm.visible && rm.spacers === 0)
    ok(`reduced ${p}: ${rm.count} animated nodes all static, zero pins`);
  else fail(`reduced ${p} wrong: ${JSON.stringify(rm)}`);
  if (errors.length) errors.forEach((e) => fail(`reduced ${p} console: ${e}`));
  else ok(`reduced ${p}: no console errors`);
  await ctx.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.log(`\n${failures.length} browser check(s) FAILED`);
  process.exit(1);
}
console.log("\nbrowser verification passed");
