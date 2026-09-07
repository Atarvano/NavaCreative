// check-01: acceptance checks for ticket 01 (Tailwind scaffold + theme).
// Usage: node scripts/check-01.mjs   (exit 0 = all pass)
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

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

// Sections live under src/sections/ after the ticket-01 git mv.
const SECTIONS = [
  "About", "Backbar", "Cta", "Footer", "Hero", "Live", "Marquee",
  "MenuOverlay", "Nav", "Preloader", "ServiceDetail", "Services", "Team", "Work",
];

check("tailwind deps installed", () => {
  const pkg = JSON.parse(read("package.json"));
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

check("preflight excluded, utilities live", () => {
  const t = read("src/styles/theme.css");
  must(!t.includes("preflight"), "preflight must stay excluded in ticket 01");
  must(t.includes("tailwindcss/utilities"), "utilities.css import missing");
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

check("entries import theme chain + legacy sheet", () => {
  for (const e of ["src/main.js", "src/service.js"]) {
    const src = read(e);
    must(src.includes("styles/theme.css"), `${e} lacks theme import`);
    must(src.includes("../styles.css"), `${e} must keep ../styles.css until cutover`);
  }
});

check("sections moved to src/sections/", () => {
  for (const s of SECTIONS)
    must(existsSync(`src/sections/${s}.svelte`), `src/sections/${s}.svelte missing`);
  must(!existsSync("src/components/About.svelte"), "stale src/components/*.svelte remains");
});

check("apps import from ./sections/", () => {
  for (const a of ["src/App.svelte", "src/ServiceApp.svelte"]) {
    const src = read(a);
    must(!src.includes("./components/"), `${a} still imports ./components/`);
    must(src.includes("./sections/"), `${a} lacks ./sections/ import`);
  }
});

check("motion helper untouched", () => {
  const git = execSync("git diff --name-only main...HEAD", { encoding: "utf8" });
  must(!git.includes("src/lib/motion.js"), "motion.js must stay untouched in ticket 01");
});

check("clean build", () => {
  execSync("npm run build", { stdio: "pipe" });
  must(existsSync("dist/index.html"), "dist/index.html missing after build");
});

if (failures) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nall checks passed");
