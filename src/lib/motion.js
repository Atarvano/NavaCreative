import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Shared motion helper. The single seam behind every animation:
// gsap + ScrollTrigger registration, the prefers-reduced-motion gate, and the
// document.fonts.ready refresh that keeps pin-spacer heights honest
// (ADR-0003). Every animated component creates its triggers inside onMount
// wrapped in gsap.context and reverts on destroy.

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

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

export { gsap, ScrollTrigger };
