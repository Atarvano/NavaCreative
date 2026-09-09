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
<header class="fixed inset-x-0 top-0 z-50 flex h-(--nav-h) items-center justify-between gap-8 px-(--pad) transition-transform duration-450 ease-emphasis" id="backbar" bind:this={header}>
  <a class="inline-flex min-h-11 min-w-11 items-center justify-center text-body text-graphite transition-colors duration-200 hover:text-ink-black" href="index.html#services" aria-label="All services">←</a>
  <a class="inline-flex items-center gap-3" href="index.html">
    <span aria-hidden="true" class="relative h-8 w-8 flex-none rounded-full bg-ink-black after:absolute after:inset-0 after:m-auto after:h-2 after:w-2 after:rounded-full after:bg-bone-white"></span>
    <span class="text-caption leading-[1.43] text-ink-black uppercase">Nava Creative //<br />Photo & Video Studio</span>
  </a>
</header>
