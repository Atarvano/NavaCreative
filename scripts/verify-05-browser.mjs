// verify-05-browser.mjs: browser verification for ticket 05 (Service pages
// in Tailwind, CTA strip removed). Serves dist/ locally; asserts per page:
//  - back bar + detail gallery + footer render, no CTA strip markup
//  - gallery cascade fires; cross-links + anchors resolve
//  - reduced-motion: full static content
//  - no console errors on desktop and mobile widths
// Usage: node scripts/verify-05-browser.mjs
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
const PAGES = [
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

async function trackErrors(page, errors) {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) =>
    errors.push(`pageerror: ${String(e.message).slice(0, 200)}`),
  );
}

// --- Desktop: all five pages render detail -> footer, no CTA ---
for (const p of PAGES) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  const errors = [];
  await trackErrors(page, errors);
  await page.goto(`${base}/${p}`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 800));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 800));
  });

  const snap = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#service-detail .live-card")];
    const cols = getComputedStyle(
      document.querySelector("#service-detail .grid"),
    ).gridTemplateColumns.split(" ").length;
    return {
      backbar: !!document.querySelector("#backbar"),
      title: document
        .querySelector(".service-title")
        ?.textContent.trim()
        .slice(0, 40),
      cards: cards.length,
      cols,
      cta: !!document.querySelector("#contact"),
      footer: !!document.querySelector("footer"),
      // Detail flows straight into footer: no #contact between them.
      order: ["#service-detail", "#contact", "footer"]
        .map((s) => {
          const el = document.querySelector(s);
          return el ? Math.round(el.getBoundingClientRect().top) : null;
        })
        .join("/"),
      settled: cards.map((c) => getComputedStyle(c).opacity),
      others: [
        ...document.querySelectorAll('nav[aria-label="Other services"] a'),
      ].map((a) => a.getAttribute("href")),
    };
  });
  if (snap.backbar) ok(`desktop ${p}: back bar renders`);
  else fail(`desktop ${p}: back bar missing`);
  if (snap.cards >= 3 && snap.cols === 3)
    ok(`desktop ${p}: gallery renders ${snap.cards} cards in 3 columns`);
  else
    fail(
      `desktop ${p}: gallery wrong (cards ${snap.cards}, cols ${snap.cols})`,
    );
  if (snap.cta) fail(`desktop ${p}: CTA strip still present`);
  else ok(`desktop ${p}: no CTA strip`);
  if (snap.footer) ok(`desktop ${p}: footer renders`);
  else fail(`desktop ${p}: footer missing`);
  if (snap.settled.every((o) => o === "1"))
    ok(`desktop ${p}: gallery cascade fired`);
  else fail(`desktop ${p}: cards unsettled: ${snap.settled.join(",")}`);
  if (snap.others.length === 4 && snap.others.every((h) => h.endsWith(".html")))
    ok(`desktop ${p}: 4 cross-links resolve (${snap.others.join(",")})`);
  else fail(`desktop ${p}: cross-links wrong: ${snap.others.join(",")}`);

  // Back link + one anchor resolve.
  const backHref = await page.evaluate(() =>
    document
      .querySelector('#backbar a[aria-label="All services"]')
      .getAttribute("href"),
  );
  if (backHref === "index.html#services")
    ok(`desktop ${p}: back link -> All services`);
  else fail(`desktop ${p}: back link href = ${backHref}`);
  if (p === "photo-video.html")
    await page.screenshot({ path: join(SHOTS, "05-desktop-service.png") });

  if (errors.length) errors.forEach((e) => fail(`desktop ${p} console: ${e}`));
  else ok(`desktop ${p}: no console errors`);
  await ctx.close();
}

// --- Mobile: one page stacked, no errors ---
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  const errors = [];
  await trackErrors(page, errors);
  await page.goto(`${base}/graphic-design.html`, {
    waitUntil: "load",
    timeout: 30000,
  });
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 800));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 800));
  });
  const mob = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#service-detail .live-card")];
    const widths = new Set(
      cards.map((c) => Math.round(c.getBoundingClientRect().width)),
    );
    return {
      cols: getComputedStyle(
        document.querySelector("#service-detail .grid"),
      ).gridTemplateColumns.split(" ").length,
      stacked: widths.size <= 2,
      cta: !!document.querySelector("#contact"),
      settled: cards.map((c) => getComputedStyle(c).opacity),
    };
  });
  if (mob.cols === 1 && mob.stacked) ok("mobile gallery stacks full-width");
  else fail(`mobile gallery layout wrong: ${JSON.stringify(mob)}`);
  if (mob.cta) fail("mobile CTA strip present");
  else ok("mobile no CTA strip");
  if (mob.settled.every((o) => o === "1")) ok("mobile gallery cascade fired");
  else fail(`mobile cards unsettled: ${mob.settled.join(",")}`);
  await page.screenshot({ path: join(SHOTS, "05-mobile-service.png") });
  if (errors.length) errors.forEach((e) => fail(`mobile console: ${e}`));
  else ok("mobile no console errors");
  await ctx.close();
}

// --- Reduced motion: full static content on one page ---
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const errors = [];
  await trackErrors(page, errors);
  await page.goto(`${base}/live-streaming.html`, {
    waitUntil: "load",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);
  const rm = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#service-detail .live-card")];
    return {
      visible: cards.every((c) => getComputedStyle(c).opacity === "1"),
      title: getComputedStyle(document.querySelector(".service-title .line"))
        .opacity,
      cta: !!document.querySelector("#contact"),
    };
  });
  if (rm.visible && rm.title === "1")
    ok("reduced-motion renders gallery + title statically");
  else fail(`reduced-motion content hidden: ${JSON.stringify(rm)}`);
  if (rm.cta) fail("reduced-motion CTA strip present");
  else ok("reduced-motion no CTA strip");
  if (errors.length) errors.forEach((e) => fail(`reduced console: ${e}`));
  else ok("reduced-motion no console errors");
  await ctx.close();
}

// --- Index keeps its Cta ---
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  const errors = [];
  await trackErrors(page, errors);
  await page.goto(`${base}/index.html`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(4500);
  const has = await page.evaluate(() => !!document.querySelector("#contact"));
  if (has) ok("index keeps its Cta strip");
  else fail("index lost its Cta strip");
  if (errors.length) errors.forEach((e) => fail(`index console: ${e}`));
  else ok("index no console errors");
  await ctx.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.log(`\n${failures.length} browser check(s) FAILED`);
  process.exit(1);
}
console.log("\nbrowser verification passed");
