<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion } from '../lib/motion.js';

  // Site-wide custom cursor (ticket 05, desktop fine-pointer only): one
  // fixed dot that chases the pointer transform-only (quickTo, no layout
  // reads per frame), grows over interactive targets, and hides when the
  // pointer leaves the window. Never intercepts input (pointer-events
  // none), never renders on touch or under reduced motion, never restyles
  // the OS pointer — opacity/visibility only. Mounted by App (index only).
  let dot;
  let ctx;
  let mm;
  // Compiler-known toggles: vite-plugin-svelte drops selectors for
  // classes it never sees in markup, so grow/hidden ride Svelte class:
  // directives (classList.toggle would leave .cursor--grow undelivered).
  let grown = $state(false);
  let hidden = $state(true);

  // Grow over links, buttons, pills, and the three card families
  // (cards + service rows read as interactive even where their only
  // control is a nested link).
  const GROW_SEL =
    'a, button, .magnetic, .team-card, .work-card, .live-card, .service-row';

  onMount(() => {
    ctx = motion(dot, () => {
      mm = gsap.matchMedia();
      mm.add('(pointer: fine) and (min-width: 768px)', () => {
        const ac = new AbortController();
        gsap.set(dot, { xPercent: -50, yPercent: -50, x: -100, y: -100 });
        const xTo = gsap.quickTo(dot, 'x', { duration: 0.18, ease: 'power3.out' });
        const yTo = gsap.quickTo(dot, 'y', { duration: 0.18, ease: 'power3.out' });
        const show = () => (hidden = false);
        const hide = () => (hidden = true);
        document.addEventListener(
          'pointermove',
          (e) => {
            if (e.pointerType !== 'mouse') return;
            show();
            xTo(e.clientX);
            yTo(e.clientY);
            grown = !!e.target.closest?.(GROW_SEL);
          },
          { signal: ac.signal, passive: true }
        );
        document.documentElement.addEventListener('pointerleave', hide, {
          signal: ac.signal,
        });
        document.addEventListener('pointerleave', hide, { signal: ac.signal });
        return () => ac.abort();
      });
    });
  });

  onDestroy(() => {
    mm?.revert();
    ctx?.revert();
  });
</script>

<!-- Cursor: the one fixed dot; hidden until the first pointermove parks it. -->
<span aria-hidden="true" class="cursor" class:cursor--grow={grown} class:cursor--hidden={hidden} bind:this={dot}></span>

<style>
  .cursor {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 200;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: var(--color-ink-black);
    opacity: 1;
    pointer-events: none;
    transition:
      width 0.25s var(--ease-out),
      height 0.25s var(--ease-out),
      opacity 0.25s var(--ease-out),
      background-color 0.25s var(--ease-out);
    will-change: transform;
  }
  .cursor.cursor--grow {
    width: 44px;
    height: 44px;
    background: rgb(0 0 0 / 14%);
    outline: 1px solid var(--color-ink-black);
    outline-offset: -1px;
  }
  .cursor.cursor--hidden {
    opacity: 0;
  }
  @media (pointer: coarse), (max-width: 767px) {
    .cursor {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cursor {
      display: none;
    }
  }
</style>
