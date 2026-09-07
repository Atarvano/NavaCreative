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

// Ticket-02 scope: nine index sections (Work/Team/Preloader/ServiceDetail
// migrate in later tickets).
const MIGRATED = [
  "Nav", "Hero", "Marquee", "About", "Services",
  "Live", "Cta", "Footer", "MenuOverlay",
];

// Legacy classes whose only job was styling a migrated section: none may
// survive in the migrated markup.
const LEGACY_STYLE_CLASSES = [
  "nav-lockup", "nav-mark", "nav-eyebrow", "nav-links", "menu-btn",
  "hero-top", "hero-title", "hero-side", "hero-sub", "hero-ctas",
  "hero-media", "hero-overlay", "hero-meta", "hero-overlay-title",
  "marquee-track",
  "about-statement", "about-band", "about-band-overlay", "about-band-meta",
  "about-band-title", "about-lower", "about-copy", "about-photos", "fig-cap",
  "services-list", "service", "service-num", "service-name", "service-arrow",
  "services-preview",
  "live-grid", "live-frame", "live-meta", "live-name",
  "eyebrow-invert", "cta-title", "cta-sub", "cta-strip",
  "footer-word", "footer-dot", "footer-grid", "footer-logo", "footer-tag",
  "footer-head", "footer-col", "footer-base", "footer-brand",
  "menu-top", "menu-brand", "menu-close", "menu-nav", "menu-link", "menu-meta",
  "btn", "btn-accent", "btn-ghost", "btn-big",
];

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
  ["MenuOverlay.svelte", ["menu-locked", "menu-link", "menu-line", "is-open", "menu-meta"]],
];

check("migrated sections use utilities, no legacy style classes", () => {
  for (const s of MIGRATED) {
    const src = read(`src/sections/${s}.svelte`);
    must(/(?:^|\s)(?:bg-|text-|flex|grid|px-|py-|p-|m-|gap-|hidden|md:|fixed|absolute|relative|w-|max-w-|tracking-|leading-|font-|uppercase|rounded-|border)/m.test(src),
      `${s}.svelte shows no Tailwind utilities`);
    for (const c of LEGACY_STYLE_CLASSES) {
      const re = new RegExp(`class="[^"]*\\b${c}\\b`);
      must(!re.test(src), `${s}.svelte still uses legacy .${c}`);
    }
  }
});

check("motion hooks preserved", () => {
  for (const [file, hooks] of HOOKS) {
    const src = read(`src/sections/${file}`);
    for (const h of hooks) must(src.includes(h), `${file} lost hook ${h}`);
  }
});

check("shared primitives extracted (Pill, SectionTitle, Tag)", () => {
  for (const p of ["Pill.svelte", "SectionTitle.svelte", "Tag.svelte"])
    must(existsSync(`src/components/ui/${p}`), `src/components/ui/${p} missing`);
  const users = readdirSync("src/sections")
    .filter((f) => f.endsWith(".svelte"))
    .map((f) => read(`src/sections/${f}`)).join("\n");
  must(users.includes("SectionTitle"), "no section consumes SectionTitle");
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

if (failures) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nall checks passed");
