<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, ScrollTrigger, motion } from '../lib/motion.js';

  // Constant drift (quadrupled track) with a scroll-velocity
  // kick to the loop's timeScale.
  let track;
  let ctx;

  onMount(() => {
    ctx = motion(track, () => {
      const base = track.innerHTML;
      track.innerHTML = base + base + base + base;
      const drift = gsap.to(track, {
        xPercent: -50,
        ease: 'none',
        duration: 30,
        repeat: -1,
      });
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          const v = gsap.utils.clamp(0, 3, Math.abs(self.getVelocity()) / 900);
          gsap.to(drift, { timeScale: 1 + v, duration: 0.4, overwrite: true });
        },
      });
    });
  });

  onDestroy(() => ctx?.revert());
</script>

<!-- Marquee: service ticker (JS quadruples the track). -->
<div class="marquee" aria-hidden="true">
  <div class="marquee-track" id="marqueeTrack" bind:this={track}>
    <span>Video Editing</span><i></i><span>Photography</span><i></i><span>Graphic Design</span><i></i><span>Live Streaming</span><i></i><span>Photoshoot</span><i></i><span>Social Media</span><i></i>
  </div>
</div>
