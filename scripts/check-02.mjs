// check-02: acceptance checks for ticket 02 (index sections in Tailwind).
// Usage: node scripts/check-02.mjs   (exit 0 = all pass)
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name}: ${e.message}`);
  }
};
const must = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const read = (p) => readFileSync(p, "utf8");
const run = (cmd) => {
  try {
    return { ok: true, out: execSync(cmd, { encoding: "utf8", stdio: "pipe" }) };
  } catch (e) {
    return { ok: false, out: String(e.message ?? e) };
  }
};
// Exact class tokens from static class="..." attributes (no regex-substring
// footguns: "service" must not match the kept hook "service-row").
const tokens = (src) =>
  [...src.matchAll(/class="([^"]*)"/g)]
    .flatMap((m) => m[1].split(/\s+/).filter(Boolean));

// Ticket-02 scope: ten index sections (Work/Team/ServiceDetail/Backbar
// migrate in later tickets; Preloader folded in here as index chrome).
const MIGRATED = [
  "Nav", "Hero", "Marquee", "About", "Services",
  "Live", "Cta", "Footer", "MenuOverlay", "Preloader",
];

// Pure-styling legacy classes: none may survive as a token in migrated
// markup. Hook/state classes (section-title, hero-title, hero-side,
// hero-frame, about-statement, about-band, about-band-overlay, about-photos,
// service-row, live-card, parallax, cta-title, cta-strip, footer-word,
// menu-link, menu-line, menu-mask, menu-meta, preloader, preloader-letter,
// magnetic, line, line-mask, data-reveal, is-open, nav--hidden) stay by
// design: component scripts and motion.js query them.
const LEGACY_STYLE_CLASSES = new Set([
  "nav", "nav-lockup", "nav-mark", "nav-eyebrow", "nav-links", "menu-btn",
  "hero", "hero-top", "hero-sub", "hero-ctas",
  "hero-media", "hero-overlay", "hero-meta", "hero-overlay-title",
  "marquee", "marquee-track",
  "about", "about-lower", "about-copy", "about-band-meta",
  "about-band-title", "fig-cap",
  "services", "services-list", "service", "service-num", "service-name",
  "service-arrow", "services-preview",
  "live", "live-grid", "live-frame", "live-meta", "live-name",
  "cta", "eyebrow", "eyebrow-invert", "cta-sub",
  "footer", "footer-dot", "footer-grid", "footer-logo", "footer-tag",
  "footer-head", "footer-col", "footer-base", "footer-brand",
  "menu-overlay", "menu-top", "menu-brand", "menu-close", "menu-nav",
  "preloader-word", "preloader-letter-last",
  "btn", "btn-accent", "btn-ghost", "btn-big",
]);

// GSAP/JS hooks that must survive the migration (motion.js + component
// scripts query these; ticket 02 keeps all existing motion working).
const HOOKS = [
  ["Nav.svelte", ["nav--hidden", "menuBtn"]],
  ["Hero.svelte", ["hero-title", "hero-frame", "hero-side", "magnetic"]],
  ["Marquee.svelte", ["marqueeTrack"]],
  ["About.svelte", ["about-statement", "about-band", "about-band-overlay", "about-photos", "data-reveal"]],
  ["Services.svelte", ["section-title", "service-row", "servicesList", "servicesPreview"]],
  ["Live.svelte", ["section-title", "live-card", "parallax"]],
  ["Cta.svelte", ["cta-title", "cta-strip", "magnetic", "data-reveal"]],
  ["Footer.svelte", ["footer-word"]],
  ["MenuOverlay.svelte", ["menu-link", "menu-line", "is-open", "menu-meta"]],
  ["Preloader.svelte", ["preloader", "preloader-letter"]],
];

check("migrated sections use utilities, no legacy style classes", () => {
  for (const s of MIGRATED) {
    const src = read(`src/sections/${s}.svelte`);
    must(/(?:^|\s)(?:bg-|text-|flex|grid|px-|py-|p-|m-|gap-|hidden|md:|fixed|absolute|relative|w-|max-w-|tracking-|leading-|font-|uppercase|rounded-|border)/m.test(src),
      `${s}.svelte shows no Tailwind utilities`);
    for (const t of tokens(src))
      must(!LEGACY_STYLE_CLASSES.has(t), `${s}.svelte still uses legacy .${t}`);
  }
});

check("motion hooks preserved", () => {
  for (const [file, hooks] of HOOKS) {
    const src = read(`src/sections/${file}`);
    for (const h of hooks) must(src.includes(h), `${file} lost hook ${h}`);
  }
});

check("shared primitives extracted and consumed (Pill, SectionTitle, Tag)", () => {
  for (const p of ["Pill.svelte", "SectionTitle.svelte", "Tag.svelte"])
    must(existsSync(`src/components/ui/${p}`), `src/components/ui/${p} missing`);
  const users = readdirSync("src/sections")
    .filter((f) => f.endsWith(".svelte"))
    .map((f) => read(`src/sections/${f}`)).join("\n");
  for (const p of ["Pill", "SectionTitle", "Tag"])
    must(users.includes(`<${p}`), `no section consumes <${p}>`);
});

check("anchors and service links intact", () => {
  const app = ["src/App.svelte", "src/sections/Nav.svelte", "src/sections/MenuOverlay.svelte",
    "src/sections/Footer.svelte"].map(read).join("\n");
  for (const a of ["#about", "#services", "#work", "#live", "#team", "#contact"])
    must(app.includes(a), `anchor ${a} missing`);
  const rows = read("src/sections/Services.svelte");
  for (const p of ["photo-video.html", "photo-product.html", "graphic-design.html",
    "social-media.html", "live-streaming.html"])
    must(rows.includes(p), `service link ${p} missing`);
});

check("motion.js untouched", () => {
  const git = run("git diff --name-only main...HEAD");
  must(git.ok, `git diff failed: ${git.out}`);
  must(!git.out.includes("src/lib/motion.js"), "motion.js must stay untouched in ticket 02");
});

check("clean build", () => {
  const b = run("npm run build");
  must(b.ok, `build failed: ${b.out.slice(-500)}`);
  must(existsSync("dist/index.html"), "dist/index.html missing after build");
});

check("utilities emitted in dist output", () => {
  // NOTE: probes are built via join() so no bare utility literal lives in
  // this file. Tailwind v4 scans every non-gitignored file including
  // scripts/, so a literal here would seed its own emission and the check
  // would pass vacuously. Constructed strings can only come from real
  // markup in src/sections/.
  const probes = [
    ["bg", "navy-ink"].join("-"),
    ["rounded", "pill"].join("-"),
    [".text", "display"].join("-"),
    ["max-md\\:", "hidden"].join(""),
  ];
  const cssFiles = readdirSync("dist/assets").filter((f) => f.endsWith(".css"));
  must(cssFiles.length > 0, "no CSS emitted to dist/assets");
  const css = cssFiles.map((f) => read(`dist/assets/${f}`)).join("\n");
  for (const u of probes)
    must(css.includes(u), `dist CSS lacks generated utility ${u}`);
});

if (failures) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nall checks passed");
