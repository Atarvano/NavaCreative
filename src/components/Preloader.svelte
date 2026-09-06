<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, ScrollTrigger, motion, reducedMotion } from '../lib/motion.js';

  // NAVA wordmark lift that hands off to the paused hero intro. The 4s
  // failsafe guarantees the page is never trapped; reduced-motion visitors
  // skip straight to content (CSS also force-hides the preloader).
  let { ondone } = $props();

  let el;
  let ctx;
  let failsafe;
  let finished = false;

  // progress() renders end states but suppresses callbacks, so the
  // failsafe must run the handoff explicitly. Idempotent: the normal
  // play-through and the failsafe can never hand off twice.
  function finish() {
    if (finished) return;
    finished = true;
    el.style.display = 'none';
    ondone?.();
    ScrollTrigger.refresh();
  }

  onMount(() => {
    if (reducedMotion()) {
      finish();
      return;
    }
    ctx = motion(el, () => {
      const letters = el.querySelectorAll('.preloader-letter');
      const tl = gsap.timeline();
      tl.fromTo(
        letters,
        { yPercent: 115 },
        { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07, delay: 0.15 }
      )
        .to(
          letters,
          { yPercent: -110, duration: 0.7, ease: 'expo.in', stagger: 0.05 },
          '+=0.2'
        )
        .to(el, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, '-=0.35')
        .add(finish, '-=0.45');
      // Failsafe: never hold the page hostage.
      failsafe = setTimeout(() => {
        if (el.style.display !== 'none') {
          tl.progress(1);
          finish();
        }
      }, 4000);
    });
  });

  onDestroy(() => {
    clearTimeout(failsafe);
    ctx?.revert();
  });
</script>

<!-- Preloader: NAVA wordmark lift. 1:1 with legacy/index.html markup. -->
<div class="preloader" id="preloader" aria-hidden="true" bind:this={el}>
  <div class="preloader-word">
    <span class="preloader-letter">N</span>
    <span class="preloader-letter">A</span>
    <span class="preloader-letter">V</span>
    <span class="preloader-letter preloader-letter-last">A</span>
  </div>
</div>
