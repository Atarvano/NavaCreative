// verify-04-browser.mjs: browser verification for ticket 04 (Team grid +
// signature motion). Serves dist/ locally; asserts:
//  - team grid: 4 makers visible, photos sharp, no pin anywhere in section
//  - signature moments fire: hero intro, about band, services preview,
//    live stagger, team stagger; work pin still the only pin
//  - reduced-motion: full static content, zero pin spacers
//  - no console errors on desktop and mobile widths
// Usage: node scripts/verify-04-browser.mjs
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

// Scroll the full page top->bottom in steps so every once:true trigger fires.
async function fullScroll(page) {
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 600) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
}

// --- Desktop: team grid + signature motion, work pin untouched ---
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) =>
    errors.push(`pageerror: ${String(e.message).slice(0, 200)}`),
  );
  await page.goto(`${base}/index.html`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(4500);

  // Bring the grid into view so lazy photos load and the stagger fires.
  await page.evaluate(() =>
    document.querySelector("#team").scrollIntoView({ behavior: "instant" }),
  );
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("#team .team-card img")].every(
          (i) => i.naturalWidth > 500,
        ),
      null,
      { timeout: 15000 },
    )
    .catch(() => {});
  await page.waitForTimeout(1500);

  // Team grid: 4 cards side by side, sharp photos, stagger settled.
  const team = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#team .team-card")];
    const boxes = cards.map((c) => c.getBoundingClientRect());
    const imgs = cards.map((c) => {
      const img = c.querySelector("img");
      const cs = getComputedStyle(img);
      return { naturalW: img.naturalWidth, filter: cs.filter };
    });
    const grid = getComputedStyle(document.querySelector("#team .team-grid"));
    return {
      count: cards.length,
      topRow: boxes.filter((b) => Math.abs(b.top - boxes[0].top) < 8).length,
      cols: grid.gridTemplateColumns.split(" ").length,
      settled: cards.map((c) => getComputedStyle(c).opacity),
      imgs,
      teamSpacer: !!document.querySelector("#team").closest(".pin-spacer"),
    };
  });
  if (team.count === 4) ok("desktop team shows all 4 makers");
  else fail(`desktop team shows ${team.count} cards, want 4`);
  if (team.cols === 4 && team.topRow === 4)
    ok("desktop team grid reads 4-across at a glance");
  else
    fail(`desktop team grid cols=${team.cols} topRow=${team.topRow}, want 4/4`);
  if (team.settled.every((o) => o === "1"))
    ok("desktop team stagger fired, all cards at opacity 1");
  else fail(`desktop team cards unsettled: ${team.settled.join(",")}`);
  if (team.imgs.every((i) => i.naturalW > 500))
    ok("desktop team photos loaded sharp (natural width > 500px)");
  else fail(`desktop team photos weak: ${JSON.stringify(team.imgs)}`);
  if (team.teamSpacer) fail("desktop team still wrapped in a pin-spacer");
  else ok("desktop team has no pin spacer");

  // Marquee dots painted (the 04 revisit): alternating magenta/teal.
  const dots = await page.evaluate(() =>
    [...document.querySelectorAll("#marqueeTrack i")]
      .slice(0, 6)
      .map((d) => getComputedStyle(d).backgroundColor),
  );
  const distinct = new Set(dots);
  if (dots.every((c) => c !== "rgba(0, 0, 0, 0)") && distinct.size === 2)
    ok(
      `desktop marquee dots painted, alternating (${[...distinct].join(" / ")})`,
    );
  else fail(`desktop marquee dots unpainted: ${dots.join(", ")}`);

  // Full scroll: every signature moment fires, work pin still the only pin.
  await fullScroll(page);
  const motion = await page.evaluate(() => {
    const op = (sel) => getComputedStyle(document.querySelector(sel)).opacity;
    const yOf = (sel) => {
      const els = [...document.querySelectorAll(sel)];
      return els.map(
        (c) => new DOMMatrixReadOnly(getComputedStyle(c).transform).m42,
      );
    };
    let spacers = 0;
    document.querySelectorAll(".pin-spacer").forEach((s) => {
      if (s.querySelector("#work")) spacers++;
    });
    const totalSpacers = document.querySelectorAll(".pin-spacer").length;
    return {
      heroTitleY: yOf(".hero-title .line"),
      aboutBandClip: getComputedStyle(document.querySelector(".about-band"))
        .clipPath,
      servicesOpacity: op(".service-row"),
      liveSettled: yOf(".live-card"),
      teamSettled: yOf("#team .team-card"),
      workSpacers: spacers,
      totalSpacers,
      workFixed: ["fixed", "absolute"].includes(
        getComputedStyle(document.querySelector("#work")).position,
      ),
    };
  });
  if (motion.heroTitleY.every((y) => Math.abs(y) < 1))
    ok("desktop hero kinetic intro fired (lines at y=0)");
  else fail(`desktop hero lines unsettled: ${motion.heroTitleY.join(",")}`);
  if (
    motion.aboutBandClip.includes("0% 0% 0%") ||
    motion.aboutBandClip === "inset(0%)"
  )
    ok("desktop about band revealed (clip settled)");
  else fail(`desktop about band clip = ${motion.aboutBandClip}`);
  if (motion.servicesOpacity === "1") ok("desktop services rows cascaded in");
  else fail(`desktop services rows opacity = ${motion.servicesOpacity}`);
  if (motion.liveSettled.every((y) => Math.abs(y) < 1))
    ok("desktop live stagger fired (cards at y=0)");
  else fail(`desktop live cards unsettled: ${motion.liveSettled.join(",")}`);
  if (motion.workSpacers === 1 && motion.totalSpacers === 1)
    ok("desktop work pin remains the single pin on the page");
  else
    fail(
      `desktop pin state wrong (work ${motion.workSpacers}, total ${motion.totalSpacers})`,
    );
  await page.screenshot({ path: join(SHOTS, "04-desktop-team-grid.png") });

  // About band parallax + services cursor preview (desktop-only moments).
  const para = await page.evaluate(async () => {
    const band = document.querySelector(".about-band");
    const img = band.querySelector("img");
    const y = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const bandTop = band.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: bandTop - window.innerHeight / 2,
      behavior: "instant",
    });
    await sleep(1000);
    const before = y(img);
    window.scrollTo({ top: bandTop + 600, behavior: "instant" });
    await sleep(1000);
    return { before, after: y(img) };
  });
  if (Math.abs(para.after - para.before) > 2)
    ok(
      `desktop about band parallaxes (img y ${Math.round(para.before)} -> ${Math.round(para.after)})`,
    );
  else fail("desktop about band img static under scroll");
  const preview = await page.evaluate(async () => {
    const p = document.querySelector("#servicesPreview");
    const row = document.querySelector(".service-row");
    row.dispatchEvent(
      new PointerEvent("pointerenter", {
        bubbles: true,
        clientX: 700,
        clientY: 400,
      }),
    );
    await new Promise((r) => setTimeout(r, 600));
    return getComputedStyle(p).opacity;
  });
  if (preview === "1") ok("desktop services cursor preview appears on hover");
  else fail(`desktop services preview opacity = ${preview}`);

  if (errors.length) errors.forEach((e) => fail(`desktop console: ${e}`));
  else ok("desktop no console errors");
  await ctx.close();
}

// --- Mobile: grid stacks, no pin, work carousel untouched ---
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) =>
    errors.push(`pageerror: ${String(e.message).slice(0, 200)}`),
  );
  await page.goto(`${base}/index.html`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(4500);
  await fullScroll(page);
  const mob = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#team .team-card")];
    const boxes = cards.map((c) => c.getBoundingClientRect().width);
    return {
      count: cards.length,
      stacked: new Set(boxes.map(Math.round)).size <= 2,
      settled: cards.map((c) => getComputedStyle(c).opacity),
      spacers: document.querySelectorAll(".pin-spacer").length,
      workPos: getComputedStyle(document.querySelector("#work")).position,
    };
  });
  if (mob.count === 4 && mob.stacked)
    ok("mobile team stacks full-width (4 cards)");
  else fail(`mobile team layout wrong: ${JSON.stringify(mob)}`);
  if (mob.settled.every((o) => o === "1")) ok("mobile team stagger fired");
  else fail(`mobile team cards unsettled: ${mob.settled.join(",")}`);
  if (mob.spacers === 0) ok("mobile page has zero pins");
  else fail(`mobile found ${mob.spacers} pin spacer(s)`);
  if (mob.workPos === "fixed") fail("mobile work pinned");
  else ok("mobile work never pins");
  await page.screenshot({ path: join(SHOTS, "04-mobile-team-grid.png") });
  if (errors.length) errors.forEach((e) => fail(`mobile console: ${e}`));
  else ok("mobile no console errors");
  await ctx.close();
}

// --- Reduced motion: full static content, zero pins ---
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) =>
    errors.push(`pageerror: ${String(e.message).slice(0, 200)}`),
  );
  await page.goto(`${base}/index.html`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3500);
  const rm = await page.evaluate(() => {
    const visible = (sel) =>
      [...document.querySelectorAll(sel)].every((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return cs.opacity === "1" && r.width > 0;
      });
    return {
      team: visible("#team .team-card"),
      work: visible(".work-card"),
      live: visible(".live-card"),
      spacers: document.querySelectorAll(".pin-spacer").length,
    };
  });
  if (rm.team && rm.work && rm.live)
    ok("reduced-motion renders all team/work/live content statically");
  else fail(`reduced-motion content hidden: ${JSON.stringify(rm)}`);
  if (rm.spacers === 0) ok("reduced-motion has zero pins");
  else fail(`reduced-motion found ${rm.spacers} pin spacer(s)`);
  if (errors.length) errors.forEach((e) => fail(`reduced console: ${e}`));
  else ok("reduced-motion no console errors");
  await ctx.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.log(`\n${failures.length} browser check(s) FAILED`);
  process.exit(1);
}
console.log("\nbrowser verification passed");
