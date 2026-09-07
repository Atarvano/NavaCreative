// check-01: acceptance checks for ticket 01 (Tailwind scaffold + theme).
// Usage: node scripts/check-01.mjs   (exit 0 = all pass)
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

// Sections live under src/sections/ after the ticket-01 git mv.
const SECTIONS = [
  "About", "Backbar", "Cta", "Footer", "Hero", "Live", "Marquee",
  "MenuOverlay", "Nav", "Preloader", "ServiceDetail", "Services", "Team", "Work",
];

check("tailwind deps installed", () => {
  let pkg;
  try {
    pkg = JSON.parse(read("package.json"));
  } catch {
    throw new Error("package.json unreadable");
  }
  must(pkg.devDependencies?.["tailwindcss"], "missing tailwindcss");
  must(pkg.devDependencies?.["@tailwindcss/vite"], "missing @tailwindcss/vite");
});

check("vite plugin registered", () => {
  const cfg = read("vite.config.js");
  must(cfg.includes("@tailwindcss/vite"), "vite.config.js lacks @tailwindcss/vite");
});

check("theme carries design.md tokens", () => {
  must(existsSync("src/styles/theme.css"), "src/styles/theme.css missing");
  const t = read("src/styles/theme.css");
  for (const tok of [
    "--color-canvas: #f0efe9",
    "--color-magenta-bloom: #8a0467",
    "--color-forest-teal: #03624c",
    "--color-navy-ink: #101731",
    "Plus Jakarta Sans",
    "--text-display: 84px",
    "--text-display--line-height: 1",
    "--text-display--letter-spacing: -0.04em",
    "--radius-pill: 1440px",
    "--breakpoint-md: 768px",
  ])
    must(t.includes(tok), `theme.css lacks ${tok}`);
});

check("preflight excluded, utilities live, legacy layered", () => {
  const t = read("src/styles/theme.css");
  must(!t.includes("preflight"), "preflight must stay excluded in ticket 01");
  must(t.includes("tailwindcss/utilities"), "utilities.css import missing");
  must(t.includes("../../styles.css"), "theme.css must import legacy styles.css");
  must(t.includes("layer(legacy)"), "legacy sheet must sit in a legacy layer");
});

check("base carries global rules verbatim", () => {
  must(existsSync("src/styles/base.css"), "src/styles/base.css missing");
  const b = read("src/styles/base.css");
  for (const rule of [
    "box-sizing: border-box",
    "scroll-behavior: smooth",
    "overflow-x: clip",
    "[data-reveal]",
    "prefers-reduced-motion",
    "menu-locked",
    "--nav-h: 68px",
  ])
    must(b.includes(rule), `base.css lacks ${rule}`);
});

check("entries import theme only; legacy via CSS layer", () => {
  for (const e of ["src/main.js", "src/service.js"]) {
    const src = read(e);
    must(src.includes("styles/theme.css"), `${e} lacks theme import`);
    must(!src.includes("../styles.css"), `${e} must not import ../styles.css directly (legacy comes via the theme.css layer)`);
  }
});

check("sections moved to src/sections/", () => {
  for (const s of SECTIONS)
    must(existsSync(`src/sections/${s}.svelte`), `src/sections/${s}.svelte missing`);
  must(!existsSync("src/components/About.svelte"), "stale src/components/*.svelte remains");
  must(existsSync("src/components/ui"), "src/components/ui missing");
});

check("apps import from ./sections/", () => {
  for (const a of ["src/App.svelte", "src/ServiceApp.svelte"]) {
    const src = read(a);
    must(!src.includes("./components/"), `${a} still imports ./components/`);
    must(src.includes("./sections/"), `${a} lacks ./sections/ import`);
  }
});

check("motion helper untouched", () => {
  const git = run("git diff --name-only main...HEAD");
  must(git.ok, `git diff failed: ${git.out}`);
  must(!git.out.includes("src/lib/motion.js"), "motion.js must stay untouched in ticket 01");
});

check("clean build", () => {
  const b = run("npm run build");
  must(b.ok, `build failed: ${b.out.slice(-500)}`);
  must(existsSync("dist/index.html"), "dist/index.html missing after build");
});

check("legacy layered in dist output", () => {
  const cssFiles = readdirSync("dist/assets").filter((f) => f.endsWith(".css"));
  must(cssFiles.length > 0, "no CSS emitted to dist/assets");
  const css = cssFiles.map((f) => read(`dist/assets/${f}`)).join("\n");
  must(css.includes("@layer"), "dist CSS has no cascade layers");
  must(css.includes("legacy"), "dist CSS lacks the legacy layer");
  must(css.includes(".nav--hidden"), "dist CSS lacks legacy selectors");
});

if (failures) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nall checks passed");
