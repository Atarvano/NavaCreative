// check-06: acceptance checks for ticket 06 (cutover: styles.css deleted,
// full Tailwind build). Usage: node scripts/check-06.mjs (exit 0 = all pass)
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
    return {
      ok: true,
      out: execSync(cmd, { encoding: "utf8", stdio: "pipe" }),
    };
  } catch (e) {
    return { ok: false, out: String(e.message ?? e) };
  }
};

check("styles.css deleted; no import remains", () => {
  must(!existsSync("styles.css"), "styles.css still exists");
  const theme = read("src/styles/theme.css");
  must(!theme.includes("styles.css"), "theme.css still imports styles.css");
  must(!/layer(legacy)|@layer[^{]*legacy/.test(theme), "theme.css still declares a legacy layer");
  const users = readdirSync("src/sections")
    .filter((f) => f.endsWith(".svelte"))
    .map((f) => read(`src/sections/${f}`))
    .join("\n");
  must(!users.includes("styles.css"), "a section still imports styles.css");
});

check("hide-on-scroll survives without the legacy sheet", () => {
  const nav = read("src/sections/Nav.svelte");
  must(nav.includes("nav--hidden"), "Nav lost its hidden-state hook");
  const back = read("src/sections/Backbar.svelte");
  must(back.includes("backbar--hidden"), "Backbar lost its hidden-state hook");
  // JS toggles these classes inside ScrollTrigger callbacks, so scoped
  // styles would be tree-shaken: the rules live globally in base.css
  // beside body.menu-locked (same rationale).
  const base = read("src/styles/base.css");
  must(base.includes(".nav--hidden"), "base lost the nav--hidden rule");
  must(base.includes(".backbar--hidden"), "base lost the backbar--hidden rule");
});

check("preloader gates survive without the legacy sheet", () => {
  const base = read("src/styles/base.css");
  // Legacy carried body.no-js/.reduced gates plus the media-query gate.
  must(base.includes("body.no-js .preloader"), "base lost the no-js gate");
  must(base.includes("body.reduced .preloader"), "base lost the reduced gate");
});

check("no orphaned legacy style classes in markup", () => {
  // Hook/state classes that legitimately stay (queried by GSAP or scoped
  // styles, or mapped to utilities per the checks above): everything else
  // that styles.css used to define must be gone from class attributes.
  const KEEP = new Set([
    "section-title", "line", "line-mask", "hero-title", "hero-frame",
    "hero-side", "about-statement", "about-band", "about-band-overlay",
    "about-photos", "service-row", "servicesList", "servicesPreview",
    "work", "work-card", "workTrack", "live-card", "parallax",
    "team-card", "team-grid", "cta-title", "cta-strip", "footer-word",
    "menu-link", "menu-line", "menu-mask", "menu-meta", "is-open",
    "magnetic", "preloader", "preloader-letter", "service-title",
    "service-lede", "nav--hidden", "backbar--hidden", "menuBtn",
  ]);
  const ORPHANS = new Set([
    "nav", "nav-lockup", "nav-mark", "nav-eyebrow", "nav-links", "menu-btn",
    "hero", "hero-top", "hero-sub", "hero-ctas", "hero-media", "hero-overlay",
    "hero-meta", "hero-overlay-title", "marquee", "marquee-track",
    "about", "about-lower", "about-copy", "about-band-meta",
    "about-band-title", "fig-cap", "services", "services-list", "service",
    "service-num", "service-name", "service-arrow", "services-preview",
    "live", "live-grid", "live-frame", "live-meta", "live-name",
    "cta", "eyebrow", "eyebrow-invert", "cta-sub", "footer", "footer-dot",
    "footer-grid", "footer-logo", "footer-tag", "footer-head", "footer-col",
    "footer-base", "footer-brand", "menu-overlay", "menu-top", "menu-brand",
    "menu-close", "menu-nav", "preloader-word", "preloader-letter-last",
    "btn", "btn-accent", "btn-ghost", "btn-big", "team", "team-title",
    "team-stack", "team-card--accent", "team-card--flip", "team-photo",
    "team-info", "team-index", "team-name", "team-tags", "team-tag",
    "team-exp", "team-links", "work-head", "work-hint", "work-track",
    "work-frame", "work-card-l", "work-card-s", "work-meta", "work-name",
    "backbar", "backbar-back",
  ]);
  // Any class Tailwind actually emitted is a real utility by construction
  // (cheaper than a hand-rolled prefix regex that rots with every new
  // utility). Backslashes are escaping noise: strip them on both sides
  // and compare the bare selector text. KEEP/ORPHANS still guard the
  // legacy hook contract above.
  const cssFiles = readdirSync("dist/assets").filter((f) => f.endsWith(".css"));
  const css = cssFiles.map((f) => read(`dist/assets/${f}`)).join("\n").replace(/\\/g, "");
  const files = [
    ...readdirSync("src/sections")
      .filter((f) => f.endsWith(".svelte"))
      .map((f) => `src/sections/${f}`),
    ...readdirSync("src/components/ui")
      .filter((f) => f.endsWith(".svelte"))
      .map((f) => `src/components/ui/${f}`),
  ];
  for (const f of files) {
    const tokens = [...read(f).matchAll(/class="([^"]*)"/g)].flatMap((m) =>
      m[1].split(/\s+/).filter(Boolean),
    );
    for (const t of tokens) {
      must(!ORPHANS.has(t), `${f} references orphaned legacy .${t}`);
      if (!KEEP.has(t))
        must(css.includes(`.${t}`), `${f} uses unknown non-utility class .${t}`);
    }
  }
});

check("motion.js untouched", () => {
  const git = run("git diff --name-only main...HEAD");
  must(git.ok, `git diff failed: ${git.out}`);
  must(
    !git.out.includes("src/lib/motion.js"),
    "motion.js must stay untouched in ticket 06",
  );
});

check("GSAP npm-bundled, no CDN script tag", () => {
  for (const h of [
    "index.html",
    "photo-video.html",
    "photo-product.html",
    "graphic-design.html",
    "social-media.html",
    "live-streaming.html",
  ]) {
    const src = read(h);
    must(!/cdn|unpkg|jsdelivr/i.test(src), `${h} references a CDN`);
    must(
      !src.toLowerCase().includes("gsap"),
      `${h} loads gsap outside the npm bundle`,
    );
  }
  let pkg = {};
  try {
    pkg = JSON.parse(read("package.json"));
  } catch {
    pkg = {};
  }
  must(pkg.dependencies?.gsap, "gsap missing from dependencies");
});

check("clean build with zero legacy bytes", () => {
  const b = run("npm run build");
  must(b.ok, `build failed: ${b.out.slice(-500)}`);
  must(existsSync("dist/index.html"), "dist/index.html missing after build");
  const cssFiles = readdirSync("dist/assets").filter((f) => f.endsWith(".css"));
  must(cssFiles.length > 0, "no CSS emitted to dist/assets");
  const css = cssFiles.map((f) => read(`dist/assets/${f}`)).join("\n");
  // Legacy-only selectors must not survive in output (their hooks do, but
  // with utility-driven declarations, never the legacy bodies).
  for (const s of [".team-stack", ".work-track", ".nav-links", ".btn-accent"])
    must(!css.includes(s), `dist CSS still carries legacy ${s}`);
});

if (failures) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nall checks passed");
