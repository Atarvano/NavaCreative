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
<div aria-hidden="true" class="overflow-hidden border-y border-ash py-8 whitespace-nowrap">
  <div id="marqueeTrack" bind:this={track} class="inline-flex items-center will-change-transform">
    <span class="px-6 text-subheading font-light">Video Editing</span><i class="h-2 w-2 flex-none"></i><span class="px-6 text-subheading font-light">Photography</span><i class="h-2 w-2 flex-none"></i><span class="px-6 text-subheading font-light">Graphic Design</span><i class="h-2 w-2 flex-none"></i><span class="px-6 text-subheading font-light">Live Streaming</span><i class="h-2 w-2 flex-none"></i><span class="px-6 text-subheading font-light">Photoshoot</span><i class="h-2 w-2 flex-none"></i><span class="px-6 text-subheading font-light">Social Media</span><i class="h-2 w-2 flex-none"></i>
    <!-- Dots intentionally unpainted: the legacy i:nth-child(4n+1/4n+3)
         selectors only ever matched odd children (spans), so no <i> was
         colored and dots rendered as transparent gaps. Revisit in 04. -->
  </div>
</div>
