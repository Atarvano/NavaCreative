import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Shared motion helper (ticket 01). The single seam behind every animation:
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

const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

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

export { gsap, ScrollTrigger };
