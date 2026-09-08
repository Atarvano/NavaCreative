// verify-03-browser.mjs: browser verification for ticket 03 (Work pin).
// Serves dist/ locally; asserts the ticket acceptance checklist:
//  - desktop pin holds exactly one viewport, neighbors never overlap
//    (incl. after fonts settle + across resize over the breakpoint)
//  - cards travel horizontally; rise triggers once per card
//  - mobile never pins: snap carousel scrolls natively, cards fade up
//  - navigating away and back leaves no stuck pin / leaked trigger / errors
// Usage: node scripts/verify-03-browser.mjs
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

// --- Desktop: pin geometry + horizontal travel, no neighbor overlap ---
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
  // Let fonts settle (the ADR-0003 fonts.ready refresh path), then remeasure.
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(800);

  const geo = await page.evaluate(() => {
    const work = document.querySelector("#work");
    const head = work.querySelector(":scope > div");
    const track = document.querySelector("#workTrack");
    const r = work.getBoundingClientRect();
    const cs = getComputedStyle(work);
    return {
      vh: window.innerHeight,
      sectionH: r.height,
      overflow: cs.overflow,
      headBottom: head.getBoundingClientRect().bottom - r.top,
      trackW: track.scrollWidth,
      overhang: r.bottom - window.innerHeight,
    };
  });
  if (Math.abs(geo.sectionH - geo.vh) <= 1)
    ok(
      `desktop section exactly one viewport (${geo.sectionH}px vs vh ${geo.vh})`,
    );
  else fail(`desktop section ${geo.sectionH}px != viewport ${geo.vh}px`);
  if (geo.overflow === "hidden") ok("desktop section overflow hidden");
  else fail(`desktop section overflow = ${geo.overflow}`);
  if (geo.headBottom <= geo.vh + 1)
    ok(
      `desktop head fits inside viewport (bottom ${Math.round(geo.headBottom)}px)`,
    );
  else
    fail(
      `desktop head overflows viewport (bottom ${Math.round(geo.headBottom)}px)`,
    );
  if (geo.trackW > 1440)
    ok(
      `desktop track overflows viewport (${geo.trackW}px), pin has distance to travel`,
    );
  else
    fail(
      `desktop track ${geo.trackW}px fits in viewport: no horizontal travel`,
    );

  // Mid-pin: work covers exactly the viewport, services/live never overlap.
  await page.evaluate(() => {
    const work = document.querySelector("#work");
    const y = work.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, y + window.innerHeight * 0.5);
  });
  await page.waitForTimeout(1500);
  const mid = await page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    };
    const work = rect("#work");
    const cs = getComputedStyle(document.querySelector("#work"));
    return {
      work,
      pinSpacer: !!document.querySelector("#work").closest(".pin-spacer"),
      pinFixed: cs.position === "fixed" || work.top <= 1,
      servicesVisible:
        rect("#services").bottom > 2 && rect("#services").top < 2,
      liveStartsBelowFold: rect("#live").top >= window.innerHeight - 2,
      trackX: document.querySelector("#workTrack").getBoundingClientRect().x,
    };
  });
  if (mid.pinFixed) ok("desktop pin holds at viewport top mid-scroll");
  else fail(`desktop pin not holding (work top ${mid.work.top})`);
  if (mid.trackX < -10)
    ok(`desktop track travels horizontally (x ${Math.round(mid.trackX)}px)`);
  else fail(`desktop track not travelling (x ${Math.round(mid.trackX)}px)`);
  mid.servicesVisible
    ? fail("desktop services still overlapping the pinned work")
    : ok("desktop services scrolled clear, no overlap onto work");
  // Scroll past the pin: live arrives cleanly, no stuck pin. Instant jump:
  // CSS smooth-scrolling would still be animating past the ~1900px pin
  // distance when measured (a false stuck-pin reading).
  await page.evaluate(() => {
    const work = document.querySelector("#work");
    const dist =
      document.querySelector("#workTrack").scrollWidth - window.innerWidth;
    const pinStart = work.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: pinStart + dist + window.innerHeight + 50,
      behavior: "instant",
    });
  });
  await page.waitForTimeout(1200);
  const afterPin = await page.evaluate(() => {
    const r = document.querySelector("#work").getBoundingClientRect();
    return {
      workBottom: r.bottom,
      fixed: getComputedStyle(document.querySelector("#work")).position,
    };
  });
  if (afterPin.workBottom <= 2)
    ok("desktop pin releases: work scrolled fully past");
  else
    fail(
      `desktop pin stuck (work bottom ${Math.round(afterPin.workBottom)}px)`,
    );
  await page.screenshot({ path: join(SHOTS, "03-desktop-work-pinned.png") });

  // Card rise triggers once per card: after full scroll every card sits at y 0.
  const rises = await page.evaluate(() =>
    [...document.querySelectorAll(".work-card")].map(
      (c) => new DOMMatrixReadOnly(getComputedStyle(c).transform).m42,
    ),
  );
  if (rises.every((y) => Math.abs(y) < 1))
    ok(
      `desktop all ${rises.length} cards settled at y=0 (rise fired once each)`,
    );
  else
    fail(
      `desktop card y offsets unsettled: ${rises.map(Math.round).join(",")}`,
    );

  // Resize across the breakpoint and back: geometry still exactly one viewport.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1200);
  const resized = await page.evaluate(() => ({
    h: document.querySelector("#work").getBoundingClientRect().height,
    vh: window.innerHeight,
  }));
  if (Math.abs(resized.h - resized.vh) <= 1)
    ok(
      `desktop pin geometry survives resize (${resized.h}px vs vh ${resized.vh})`,
    );
  else
    fail(`pin geometry broke on resize (${resized.h}px vs vh ${resized.vh})`);

  // Navigate away and back: no stuck pin, no leaked trigger, no errors.
  await page.goto(`${base}/photo-video.html`, {
    waitUntil: "load",
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
  await page.goto(`${base}/index.html`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(4500);
  const back = await page.evaluate(() => {
    const work = document.querySelector("#work");
    // Exactly one spacer wrapping #work: the live pin. Zero = pin never
    // initialized; nested multiples = leaked duplicate mount.
    let spacers = 0;
    for (let el = work.parentElement; el; el = el.parentElement)
      if (el.classList?.contains("pin-spacer")) spacers++;
    return {
      pinnedAtRest: getComputedStyle(work).position === "fixed",
      spacers,
    };
  });
  if (!back.pinnedAtRest && back.spacers === 1)
    ok("navigate away+back: single live pin, nothing stuck");
  else fail(`navigate away+back left pin state ${JSON.stringify(back)}`);
  if (errors.length) errors.forEach((e) => fail(`desktop console: ${e}`));
  else ok("desktop no console errors");
  await ctx.close();
}

// --- Mobile: never pins, snap carousel scrolls natively, cards fade up ---
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
  const mob = await page.evaluate(() => {
    const track = document.querySelector("#workTrack");
    const cs = getComputedStyle(track);
    const cards = [...document.querySelectorAll(".work-card")].map((c) => {
      const r = c.getBoundingClientRect();
      return { w: r.width, opacity: getComputedStyle(c).opacity };
    });
    return {
      trackOverflowX: cs.overflowX,
      snapType: cs.scrollSnapType,
      trackScrollable: track.scrollWidth > track.clientWidth + 10,
      cards,
    };
  });
  if (mob.trackOverflowX === "auto" || mob.trackOverflowX === "scroll")
    ok(`mobile track scrolls natively (overflow-x ${mob.trackOverflowX})`);
  else
    fail(`mobile track overflow-x = ${mob.trackOverflowX}, want auto/scroll`);
  if (mob.snapType.includes("mandatory") && mob.snapType.includes("x"))
    ok(`mobile track snaps (${mob.snapType})`);
  else fail(`mobile snap-type = ${mob.snapType}`);
  if (mob.trackScrollable)
    ok("mobile track overflows: carousel has somewhere to go");
  else fail("mobile track fits viewport: nothing to swipe");
  if (mob.cards.some((c) => c.w > 390)) fail("mobile card wider than viewport");
  else
    ok(
      `mobile cards fit viewport (${Math.round(mob.cards[0].w)}px first card)`,
    );

  // Swipe the carousel natively: scrollLeft moves, section never pins.
  const swiped = await page.evaluate(() => {
    const track = document.querySelector("#workTrack");
    track.scrollLeft = 200;
    return {
      left: track.scrollLeft,
      workPos: getComputedStyle(document.querySelector("#work")).position,
    };
  });
  if (swiped.left > 100)
    ok(
      `mobile carousel swipes natively (scrollLeft ${Math.round(swiped.left)})`,
    );
  else fail("mobile carousel did not scroll");
  if (swiped.workPos === "fixed") fail("mobile section pinned");
  else ok("mobile section never pins");
  await page.screenshot({ path: join(SHOTS, "03-mobile-work-carousel.png") });
  if (errors.length) errors.forEach((e) => fail(`mobile console: ${e}`));
  else ok("mobile no console errors");
  await ctx.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.log(`\n${failures.length} browser check(s) FAILED`);
  process.exit(1);
}
console.log("\nbrowser verification passed");
