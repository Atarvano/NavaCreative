// verify-02-browser.mjs: browser verification for ticket 02.
// Serves dist/ locally, loads all 6 pages at desktop + mobile widths,
// fails on console errors / pageerrors / missing anchors / style regressions.
// Usage: node scripts/verify-02-browser.mjs
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";

const DIST = resolve("dist");
const SHOTS = resolve(".scratch/tailwind-rewrite/screenshots");
const CHROME =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PAGES = [
  "index.html",
  "photo-video.html",
  "photo-product.html",
  "graphic-design.html",
  "social-media.html",
  "live-streaming.html",
];
const ANCHORS = ["about", "services", "work", "live", "team", "contact"];
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

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

for (const [label, w, h] of [
  ["desktop", 1440, 900],
  ["mobile", 390, 844],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) =>
    consoleErrors.push(`pageerror: ${String(e.message).slice(0, 200)}`),
  );

  for (const p of PAGES) {
    await page.goto(`${base}/${p}`, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(p === "index.html" ? 4500 : 1500);
    const tag = `${label}/${p}`;
    if (consoleErrors.length) {
      consoleErrors.splice(0).forEach((e) => fail(`${tag} console: ${e}`));
    } else {
      ok(`${tag} no console errors`);
    }
    // No horizontal overflow (unstyled content usually spills).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    if (overflow > 1) fail(`${tag} overflows horizontally by ${overflow}px`);
    // Viewport shot only here; fullPage parity shots happen in the
    // reduced-motion pass below (normal-motion fullPage never fires
    // below-fold ScrollTriggers, so it cannot show parity).
    await page.screenshot({
      path: join(SHOTS, `02-${label}-${p.replace(".html", "")}-top.png`),
    });
  }

  // Index-only assertions for this viewport.
  await page.goto(`${base}/index.html`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(4500);
  for (const a of ANCHORS) {
    const n = await page.locator(`#${a}`).count();
    if (!n) fail(`${label} anchor #${a} missing`);
  }
  ok(`${label} all 6 anchors resolve`);
  const styles = await page.evaluate(() => {
    const cs = (sel, prop) =>
      getComputedStyle(document.querySelector(sel))[prop];
    // isVisible not computed-display: #menuBtn keeps its own inline-block
    // while the md:hidden wrapper hides it on desktop.
    const menuVisible =
      document.querySelector("#menuBtn")?.offsetParent !== null;
    return {
      bodyBg: cs("body", "backgroundColor"),
      ctaBg: cs("#contact", "backgroundColor"),
      menuVisible,
      navLinks: cs('nav[aria-label="Primary"]', "display"),
    };
  });
  const expect = (name, got, want) =>
    got === want
      ? ok(`${label} ${name} = ${got}`)
      : fail(`${label} ${name} = ${got}, want ${want}`);
  expect("body bg (canvas)", styles.bodyBg, "rgb(240, 239, 233)");
  expect("cta bg (navy ink)", styles.ctaBg, "rgb(16, 23, 49)");
  if (label === "desktop") {
    if (styles.menuVisible) fail("desktop menu button visible");
    else ok("desktop menu button hidden");
    if (styles.navLinks === "none") fail("desktop nav links hidden");
    else ok(`desktop nav links display = ${styles.navLinks}`);
  } else {
    if (!styles.menuVisible) fail("mobile menu button hidden");
    else ok("mobile menu button visible");
    expect("nav links hidden", styles.navLinks, "none");
  }
  await ctx.close();

  // Parity pass: reduced motion renders everything statically, so a fullPage
  // shot is a meaningful layout comparison (nothing hides in triggers).
  const still = await browser.newContext({
    viewport: { width: w, height: h },
    reducedMotion: "reduce",
  });
  const sp = await still.newPage();
  for (const p of PAGES) {
    await sp.goto(`${base}/${p}`, { waitUntil: "load", timeout: 30000 });
    // Trigger lazy loading top-to-bottom, then wait for every image to
    // settle before the fullPage shot (else below-fold imgs render blank).
    await sp.evaluate(async () => {
      await new Promise((resolve) => {
        const h = document.body.scrollHeight;
        let y = 0;
        const t = setInterval(() => {
          y += Math.max(400, window.innerHeight);
          window.scrollTo(0, y);
          if (y >= h) {
            clearInterval(t);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 60);
      });
    });
    await sp
      .waitForFunction(() => [...document.images].every((i) => i.complete), {
        timeout: 20000,
      })
      .catch(() => {});
    await sp.waitForTimeout(800);
    await sp.screenshot({
      path: join(SHOTS, `02-parity-${label}-${p.replace(".html", "")}.png`),
      fullPage: true,
    });
  }
  ok(`${label} parity shots taken (reduced motion)`);
  await still.close();

  // Motion pass: scroll through the index firing each trigger, then shoot
  // every section in its post-animation state.
  const motion = await browser.newContext({
    viewport: { width: w, height: h },
  });
  const mp = await motion.newPage();
  await mp.goto(`${base}/index.html`, { waitUntil: "load", timeout: 30000 });
  await mp.waitForTimeout(4500);
  for (const a of ANCHORS) {
    await mp.locator(`#${a}`).scrollIntoViewIfNeeded();
    await mp.waitForTimeout(1200);
    await mp.screenshot({
      path: join(SHOTS, `02-motion-${label}-${a}.png`),
    });
  }
  // Menu overlay open state (mobile only). Scroll home first: hide-on-scroll
  // parks the nav (and #menuBtn) above the viewport at page bottom.
  if (label === "mobile") {
    await mp.evaluate(() => window.scrollTo(0, 0));
    await mp.waitForTimeout(800);
    await mp.locator("#menuBtn").click();
    await mp.waitForTimeout(1200);
    await mp.screenshot({ path: join(SHOTS, `02-motion-${label}-menu.png`) });
    const open = await mp.locator("#menuOverlay").isVisible();
    if (!open) fail("mobile menu overlay did not open");
    else ok("mobile menu overlay opens");
  }
  ok(`${label} motion shots taken`);
  await motion.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.log(`\n${failures.length} browser check(s) FAILED`);
  process.exit(1);
}
console.log("\nbrowser verification passed");
