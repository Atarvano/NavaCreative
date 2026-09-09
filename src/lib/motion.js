import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TextPlugin } from "gsap/TextPlugin";

// Shared motion helper. The single seam behind every animation:
// gsap + ScrollTrigger (+ TextPlugin for the Typewriter) registration, the
// prefers-reduced-motion gate, and the
// document.fonts.ready refresh that keeps pin-spacer heights honest
// (ADR-0003). Every animated component creates its triggers inside onMount
// wrapped in gsap.context and reverts on destroy.

gsap.registerPlugin(ScrollTrigger, TextPlugin);
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * Shared Scrub parallax range: the -/+ yPercent drift for the About band
 * and the Live frames, so depth reads at one speed across sections.
 * Behavior today is exactly the old hardcoded -7/+7.
 */
export const SCRUB_RANGE = 7;

/**
 * Typewriter typing speed: seconds per character. ~2s per heading keeps the
 * kinetic read without gating visitors behind a slow trickle.
 */
export const TYPE_SECONDS_PER_CHAR = 0.028;

// Late font swap changes text metrics -> stale pin-spacer heights -> sections
// overlap. Refresh once fonts are final.
if (document.fonts?.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

/** True when the visitor asked for no animation; content renders statically. */
export const reducedMotion = () => mq.matches;

/**
 * Run `setup` inside a gsap.context scoped to `scope`, returned for cleanup.
 * No-op returning null when reduced motion is on, so callers stay readable:
 *
 *   let ctx;
 *   onMount(() => { ctx = motion(sectionEl, () => { ...triggers... }); });
 *   onDestroy(() => ctx?.revert());
 */
export function motion(scope, setup) {
  if (reducedMotion()) return null;
  return gsap.context(setup, scope);
}

/**
 * Per-character Typewriter reveal for one heading's `.line` children
 * (About statement + CTA heading only; every other title keeps lines()).
 * The full copy is read from the DOM, the lines are cleared (a CSS
 * non-breaking space keeps their height so layout never shifts), and on
 * section entry each line is typed in reading order via TextPlugin with a
 * blinking aria-hidden caret riding the active line (as a `.line-mask` child
 * after the line, so TextPlugin's content rewrites can never wipe it). The caret is removed
 * on completion; any interruption (overwrite, kill, context revert) and the
 * returned restore settle to full text, so a heading can never strand
 * half-typed. Must run inside motion() (reduced motion keeps full static
 * text); call the returned restore after ctx.revert() on destroy.
 */
export function typewrite(heading) {
  const noop = () => {};
  if (!heading) return noop;
  const lines = [...heading.querySelectorAll(".line")];
  if (!lines.length) return noop;
  const full = lines.map((l) => l.textContent);
  heading.classList.add("typewriter");
  lines.forEach((l) => {
    l.textContent = "";
  });

  const caret = document.createElement("span");
  caret.className = "type-caret";
  caret.setAttribute("aria-hidden", "true");

  const settle = () => {
    lines.forEach((l, i) => {
      l.textContent = full[i];
    });
    caret.remove();
    heading.classList.remove("typewriter");
  };

  const tl = gsap.timeline({
    paused: true,
    onComplete: settle,
    onInterrupt: settle,
    onRevert: settle,
  });
  full.forEach((text, i) => {
    tl.call(() => lines[i].after(caret));
    tl.to(lines[i], {
      text,
      duration: Math.max(text.length * TYPE_SECONDS_PER_CHAR, 0.15),
      ease: "none",
    });
  });
  ScrollTrigger.create({
    trigger: heading,
    start: "top 85%",
    once: true,
    onEnter: () => tl.play(),
  });
  return settle;
}

/**
 * Scroll-bound drift for one element (ticket 04): across ±range px on one
 * axis, transform-only, never a layout shift. trigger/start/end override
 * the passage: the CTA strip and footer wordmark sit too close to the page
 * bottom for the default 'bottom top' end to ever be reached, so they peg
 * to ends their scroll range can actually traverse. Must run inside motion().
 */
export function drift(
  el,
  {
    axis = "y",
    range = 28,
    trigger = null,
    start = "top bottom",
    end = "bottom top",
  } = {},
) {
  if (!el) return;
  const prop = axis === "x" ? "x" : "y";
  gsap.fromTo(
    el,
    { [prop]: -range },
    {
      [prop]: range,
      ease: "none",
      scrollTrigger: { trigger: trigger || el, start, end, scrub: true },
    },
  );
}

/**
 * Masked line reveal for a heading's `.line` children (split per section:
 * each component calls this on its own heading, so no global pass can double-animate Work's pinned title). Must run inside a
 * motion() context so the trigger reverts with the component.
 */
export function lines(heading) {
  if (!heading) return;
  gsap.fromTo(
    heading.querySelectorAll(".line"),
    { yPercent: 115 },
    {
      yPercent: 0,
      duration: 1.15,
      ease: "expo.out",
      stagger: 0.09,
      scrollTrigger: { trigger: heading, start: "top 85%", once: true },
    },
  );
}

/**
 * Fade-up reveals for `[data-reveal]` descendants (the CSS
 * translateY(28px) initial state as fromTo, since the Svelte shell releases
 * the stylesheet-gated initial states). Must run inside motion().
 */
export function reveals(scope) {
  scope.querySelectorAll("[data-reveal]").forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      },
    );
  });
}

/**
 * Magnetic pull for one `.magnetic` button (desktop only). Call inside a
 * matchMedia block and abort `signal` on revert so no listener leaks when
 * resizing across the breakpoint.
 */
export function magnetic(btn, signal) {
  const xTo = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3.out" });
  const yTo = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3.out" });
  btn.addEventListener(
    "pointermove",
    (e) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.3);
      yTo((e.clientY - r.top - r.height / 2) * 0.4);
    },
    { signal },
  );
  btn.addEventListener(
    "pointerleave",
    () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
    },
    { signal },
  );
}

/**
 * Subtle pointer tilt for one card (desktop only, ticket 05). Rotation
 * follows the pointer (max `maxTilt` degrees at the card edge); the rect
 * is re-measured on every move — one getBoundingClientRect per event is
 * cheap next to the quickTo chase, and a stale rect is what strands
 * cards tilted. Settles flat on leave. Call inside a fine-pointer
 * matchMedia block and abort `signal` on revert. Callers gate tilt
 * until the card's entrance tween completes so the two never fight.
 */
export function tilt(card, signal, maxTilt = 6) {
  const entered = () => card.hasAttribute("data-entered");
  card.addEventListener(
    "pointermove",
    (e) => {
      if (!entered()) return;
      const r = card.getBoundingClientRect();
      gsap.to(card, {
        rotationX: -((e.clientY - r.top) / r.height - 0.5) * 2 * maxTilt,
        rotationY: ((e.clientX - r.left) / r.width - 0.5) * 2 * maxTilt,
        duration: 0.5,
        ease: "power3.out",
        overwrite: "auto",
      });
    },
    { signal },
  );
  card.addEventListener(
    "pointerleave",
    () => {
      if (!entered()) return;
      gsap.to(card, {
        rotationX: 0,
        rotationY: 0,
        duration: 0.7,
        ease: "elastic.out(1, 0.5)",
        overwrite: "auto",
      });
    },
    { signal },
  );
}

export { gsap, ScrollTrigger };
