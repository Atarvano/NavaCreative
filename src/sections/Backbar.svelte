<script>
  import { onMount, onDestroy } from 'svelte';
  import { ScrollTrigger, motion } from '../lib/motion.js';

  // Hide-on-scroll chrome, same geometry as the landing nav but with no menu
  // state to consult — service pages have no Menu button or overlay.
  let header;
  let ctx;

  onMount(() => {
    ctx = motion(header, () => {
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          header.classList.toggle(
            'backbar--hidden',
            self.direction === 1 && self.scroll() > 160
          );
        },
      });
    });
  });

  onDestroy(() => ctx?.revert());
</script>

<!-- Back bar: icon-only back link + lockup. No nav links, no Menu button, no overlay. -->
<header class="backbar" id="backbar" bind:this={header}>
  <a class="backbar-back" href="index.html#services" aria-label="All services">←</a>
  <a class="nav-lockup" href="index.html">
    <span class="nav-mark" aria-hidden="true"></span>
    <span class="nav-eyebrow">Nava Creative //<br />Photo & Video Studio</span>
  </a>
</header>
