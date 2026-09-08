// check-03: acceptance checks for ticket 03 (Work Pin in Tailwind).
// Usage: node scripts/check-03.mjs   (exit 0 = all pass)
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
// Exact class tokens from static class="..." attributes.
const tokens = (src) =>
  [...src.matchAll(/class="([^"]*)"/g)].flatMap((m) =>
    m[1].split(/\s+/).filter(Boolean),
  );

// Pure-styling legacy classes: none may survive as a token in Work markup.
// Kept hooks (queried by the component script or motion.js): work,
// work-card, section-title, line, line-mask.
const LEGACY_STYLE_CLASSES = new Set([
  "work-head",
  "work-hint",
  "work-track",
  "work-frame",
  "work-card-l",
  "work-card-s",
  "work-meta",
  "work-name",
  "eyebrow",
]);

check("Work uses utilities, no legacy style classes", () => {
  const src = read("src/sections/Work.svelte");
  must(
    /(?:^|\s)(?:flex|grid|px-|py-|p-|m-|gap-|md:|max-md:|aspect-|snap-|overflow-|h-|w-|will-change)/m.test(
      src,
    ),
    "Work.svelte shows no Tailwind utilities",
  );
  for (const t of tokens(src))
    must(!LEGACY_STYLE_CLASSES.has(t), `Work.svelte still uses legacy .${t}`);
});

check("GSAP hooks preserved on new markup", () => {
  const src = read("src/sections/Work.svelte");
  for (const h of ["work-card", "section-title", "workTrack", 'id="work"'])
    must(src.includes(h), `Work.svelte lost hook ${h}`);
});

check("work-meta migrated to shared Tag", () => {
  const src = read("src/sections/Work.svelte");
  must(
    src.includes("../components/ui/Tag.svelte"),
    "Work.svelte does not import Tag",
  );
  must(
    (src.match(/<Tag/g) || []).length >= 8,
    "expected 8 <Tag> work-meta labels",
  );
});

check("breakpoint split aligned to theme md (768/767)", () => {
  const src = read("src/sections/Work.svelte");
  must(src.includes("min-width: 768px"), "desktop matchMedia not on 768px");
  must(src.includes("max-width: 767px"), "mobile matchMedia not on 767px");
  must(!src.includes("769px"), "stale 769px breakpoint survives");
});

check("ADR-0003 pin geometry in markup and script", () => {
  const src = read("src/sections/Work.svelte");
  for (const u of ["md:h-[100dvh]", "md:overflow-hidden", "md:p-0"])
    must(src.includes(u), `section missing utility ${u}`);
  must(!/anticipatePin\s*:/.test(src), "anticipatePin must stay unset");
  must(src.includes("pinnedContainer"), "title reveal lost pinnedContainer");
  must(src.includes("invalidateOnRefresh"), "pin lost invalidateOnRefresh");
  must(src.includes("mm?.revert()"), "matchMedia revert missing on destroy");
});

check("motion.js untouched", () => {
  const git = run("git diff --name-only main...HEAD");
  must(git.ok, `git diff failed: ${git.out}`);
  must(
    !git.out.includes("src/lib/motion.js"),
    "motion.js must stay untouched in ticket 03",
  );
});

check("clean build", () => {
  const b = run("npm run build");
  must(b.ok, `build failed: ${b.out.slice(-500)}`);
  must(existsSync("dist/index.html"), "dist/index.html missing after build");
});

check("work utilities emitted in dist output", () => {
  // NOTE: probes are built via join() so no bare utility literal lives in
  // this file (Tailwind v4 scans scripts/, a literal would seed its own
  // emission and the check would pass vacuously).
  // Escaped forms as emitted in CSS (.md\:h-\[100dvh\] etc.); written
  // with doubled backslashes so the raw file text never holds the
  // single-backslash candidate Tailwind scans for.
  const probes = [
    ["h-\\[100dvh", "\\]"].join(""),
    ["snap", "-x"].join(""),
    ["aspect-\\[3\\/2", "\\]"].join(""),
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
