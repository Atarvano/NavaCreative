// check-05: acceptance checks for ticket 05 (Service pages in Tailwind,
// CTA strip removed). Usage: node scripts/check-05.mjs (exit 0 = all pass)
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

// Pure-styling legacy classes on the service-page path: none may survive as
// a token in Backbar/ServiceDetail markup. Kept hooks (queried by component
// scripts or motion.js): backbar--hidden, backbar id, nav-lockup (shared
// with Nav), service-title, service-lede, service-detail id, live-card,
// line, line-mask, data-reveal.
const LEGACY_SERVICE_CLASSES = new Set([
  "backbar",
  "backbar-back",
  "nav-mark",
  "nav-eyebrow",
  "nav-links",
  "menu-btn",
  "eyebrow",
  "service-gallery",
  "service-more",
  "service-more-head",
  "service-more-link",
  "live-frame",
  "live-meta",
  "live-name",
]);

check("Backbar + ServiceDetail use utilities, no legacy style classes", () => {
  for (const f of ["Backbar.svelte", "ServiceDetail.svelte"]) {
    const src = read(`src/sections/${f}`);
    must(
      /(?:^|\s)(?:flex|grid|px-|py-|p-|m-|gap-|fixed|absolute|text-|bg-|border|rounded-|aspect-|object-cover)/m.test(
        src,
      ),
      `${f} shows no Tailwind utilities`,
    );
    for (const t of tokens(src))
      must(
        !LEGACY_SERVICE_CLASSES.has(t),
        `${f} still uses legacy .${t}`,
      );
  }
});

check("motion hooks preserved on new markup", () => {
  const back = read("src/sections/Backbar.svelte");
  for (const h of ["backbar--hidden", 'id="backbar"'])
    must(back.includes(h), `Backbar.svelte lost hook ${h}`);
  const detail = read("src/sections/ServiceDetail.svelte");
  for (const h of [
    "service-title",
    "service-lede",
    "live-card",
    'id="service-detail"',
    "data-reveal",
  ])
    must(detail.includes(h), `ServiceDetail.svelte lost hook ${h}`);
});

check("gallery meta migrated to shared Tag", () => {
  const src = read("src/sections/ServiceDetail.svelte");
  must(
    src.includes("../components/ui/Tag.svelte"),
    "ServiceDetail.svelte does not import Tag",
  );
  must(src.includes("<Tag"), "ServiceDetail.svelte renders no <Tag>");
});

check("no CTA strip on service pages; index keeps its Cta", () => {
  const app = read("src/ServiceApp.svelte");
  must(!app.includes("<Cta"), "ServiceApp.svelte still renders <Cta>");
  must(!app.includes("sections/Cta.svelte"), "ServiceApp still imports Cta");
  const index = read("src/App.svelte");
  must(index.includes("<Cta"), "index App.svelte lost its <Cta>");
  must(
    index.includes("sections/Cta.svelte"),
    "index App.svelte lost the Cta import",
  );
});

check("CTA utilities still emitted (index owns the strip)", () => {
  const src = read("src/sections/Cta.svelte");
  must(src.includes("bg-navy-ink"), "Cta.svelte lost its inverted field");
});

check("motion.js untouched", () => {
  const git = run("git diff --name-only main...HEAD");
  must(git.ok, `git diff failed: ${git.out}`);
  must(
    !git.out.includes("src/lib/motion.js"),
    "motion.js must stay untouched in ticket 05",
  );
});

check("clean build", () => {
  const b = run("npm run build");
  must(b.ok, `build failed: ${b.out.slice(-500)}`);
  for (const p of [
    "photo-video.html",
    "photo-product.html",
    "graphic-design.html",
    "social-media.html",
    "live-streaming.html",
  ])
    must(existsSync(`dist/${p}`), `dist/${p} missing after build`);
});

check("service utilities emitted in dist output", () => {
  // NOTE: probes are built via join() so no bare utility literal lives in
  // this file (Tailwind v4 scans scripts/, a literal would seed its own
  // emission and the check would pass vacuously).
  const probes = [
    ["grid-cols-", "3"].join(""),
    ["aspect-\\[4\\/3", "\\]"].join(""),
    ["bg-navy", "-ink"].join(""),
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
