// check-04: acceptance checks for ticket 04 (Team grid + signature motion).
// Usage: node scripts/check-04.mjs   (exit 0 = all pass)
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

// Pure-styling legacy Team classes: none may survive as a token in Team
// markup. Kept hooks (queried by the component script or motion.js):
// team-card, team-grid, section-title, line, line-mask, #team.
const LEGACY_TEAM_CLASSES = new Set([
  "team",
  "team-title",
  "team-stack",
  "team-card--accent",
  "team-card--flip",
  "team-photo",
  "team-info",
  "team-index",
  "team-name",
  "team-tags",
  "team-tag",
  "team-exp",
  "team-links",
  "eyebrow",
]);

check("Team uses utilities, no legacy style classes", () => {
  const src = read("src/sections/Team.svelte");
  must(
    /(?:^|\s)(?:grid|flex|gap-|md:|lg:|aspect-|object-cover|grayscale|text-)/m.test(
      src,
    ),
    "Team.svelte shows no Tailwind utilities",
  );
  for (const t of tokens(src))
    must(!LEGACY_TEAM_CLASSES.has(t), `Team.svelte still uses legacy .${t}`);
});

check("Team content parity: four makers, hooks, shared primitives", () => {
  const src = read("src/sections/Team.svelte");
  must((src.match(/team-card group/g) || []).length >= 4, "want 4 team cards");
  for (const n of ["Hangga", "Zidny", "Luthfi", "M. Alfajrin"])
    must(src.includes(n), `Team.svelte lost maker ${n}`);
  for (const h of ['id="team"', "team-grid", "section-title"])
    must(src.includes(h), `Team.svelte lost hook ${h}`);
  must(src.includes("../components/ui/Tag.svelte"), "Team omits Tag import");
  must((src.match(/<Tag/g) || []).length >= 12, "want 12 skill <Tag>s");
  must(
    src.includes("../components/ui/SectionTitle.svelte"),
    "Team omits SectionTitle import",
  );
  must(src.includes("Meet the makers"), "Team lost its title");
});

check("no pin anywhere in Team; Work stays the single pin owner", () => {
  const team = read("src/sections/Team.svelte");
  must(!/pin\s*:\s*true/.test(team), "Team.svelte still pins");
  const owners = readdirSync("src/sections")
    .filter((f) => f.endsWith(".svelte"))
    .filter((f) => /pin\s*:\s*true/.test(read(`src/sections/${f}`)));
  must(
    owners.length === 1 && owners[0] === "Work.svelte",
    `pin owners want [Work.svelte], got [${owners}]`,
  );
});

check("signature moments wired per section", () => {
  const hero = read("src/sections/Hero.svelte");
  must(/paused\s*:\s*true/.test(hero), "Hero lost its paused intro timeline");
  must(hero.includes("magnetic"), "Hero lost magnetic CTAs");
  const about = read("src/sections/About.svelte");
  must(
    about.includes("yPercent") && about.includes("scrub"),
    "About lost its band parallax scrub",
  );
  const services = read("src/sections/Services.svelte");
  must(services.includes("quickTo"), "Services lost its cursor preview");
  must(services.includes("magnetic") === false, "Services rows were never magnetic; Hero/Cta own magnetic");
  const live = read("src/sections/Live.svelte");
  must(live.includes("live-card"), "Live lost its card cascade hook");
  must(
    live.includes("yPercent") && live.includes("scrub"),
    "Live lost its parallax scrub",
  );
  const team = read("src/sections/Team.svelte");
  must(team.includes("stagger"), "Team lost its grid stagger");
  const cta = read("src/sections/Cta.svelte");
  must(cta.includes("magnetic"), "Cta lost its magnetic button");
});

check("marquee dots painted alternating magenta/teal", () => {
  const src = read("src/sections/Marquee.svelte");
  must(!src.includes("4n + 1"), "Marquee keeps the dead 4n+1 selector");
  must(!src.includes("intentionally unpainted"), "Marquee keeps the unpainted-dots comment");
  // Per-dot utilities, not nth-child: the drift loop quadruples innerHTML,
  // so classes ride along and no selector math can desync from the list.
  const magentas = (src.match(/bg-magenta-bloom/g) || []).length;
  const teals = (src.match(/bg-forest-teal/g) || []).length;
  must(magentas === 3 && teals === 3, "want 3 magenta + 3 teal dots, got " + magentas + " + " + teals);
});

check("motion.js untouched", () => {
  const git = run("git diff --name-only main...HEAD");
  must(git.ok, `git diff failed: ${git.out}`);
  must(
    !git.out.includes("src/lib/motion.js"),
    "motion.js must stay untouched in ticket 04",
  );
});

check("clean build", () => {
  const b = run("npm run build");
  must(b.ok, `build failed: ${b.out.slice(-500)}`);
  must(existsSync("dist/index.html"), "dist/index.html missing after build");
});

check("team + marquee utilities emitted in dist output", () => {
  // NOTE: probes are built via join() so no bare utility literal lives in
  // this file (Tailwind v4 scans scripts/, a literal would seed its own
  // emission and the check would pass vacuously).
  const probes = [
    ["grid-cols-", "4"].join(""),
    ["lg" + String.fromCharCode(92) + ":grid", "-cols-4"].join(""),
    ["bg-magenta", "-bloom"].join(""),
    ["bg-forest", "-teal"].join(""),
  ]
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
