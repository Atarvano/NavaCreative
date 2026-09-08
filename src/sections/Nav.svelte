<script>
  import { onMount, onDestroy } from 'svelte';
  import { ScrollTrigger, motion } from '../lib/motion.js';
  import Pill from '../components/ui/Pill.svelte';

  // Hide-on-scroll chrome (never while the menu is open); reappears when
  // the overlay opens.
  let { onmenu, open = false } = $props();

  let header;
  let ctx;

  $effect(() => {
    if (open) header?.classList.remove('nav--hidden');
  });

  onMount(() => {
    ctx = motion(header, () => {
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          if (open) return;
          header.classList.toggle(
            'nav--hidden',
            self.direction === 1 && self.scroll() > 160
          );
        },
      });
    });
  });

  onDestroy(() => ctx?.revert());
</script>

<!-- Nav: editorial lockup + inline links + mobile Menu pill. -->
<header id="nav" bind:this={header} class="fixed inset-x-0 top-0 z-50 flex h-(--nav-h) items-center justify-between gap-8 px-(--pad) transition-transform duration-450 ease-emphasis">
  <a href="#home" class="inline-flex items-center gap-3">
    <span aria-hidden="true" class="relative h-8 w-8 flex-none rounded-full bg-ink-black after:absolute after:inset-0 after:m-auto after:h-2 after:w-2 after:rounded-full after:bg-bone-white"></span>
    <span class="text-caption leading-[1.43] text-ink-black uppercase">Nava Creative //<br />Photo &amp; Video Studio</span>
  </a>
  <nav aria-label="Primary" class="flex items-center gap-[clamp(24px,3.2vw,44px)] max-md:hidden">
    <a href="#about" class="text-body-sm text-graphite transition-colors duration-200 hover:text-ink-black">About</a>
    <a href="#services" class="text-body-sm text-graphite transition-colors duration-200 hover:text-ink-black">Services</a>
    <a href="#work" class="text-body-sm text-graphite transition-colors duration-200 hover:text-ink-black">Work</a>
    <a href="#live" class="text-body-sm text-graphite transition-colors duration-200 hover:text-ink-black">Live</a>
    <a href="#team" class="text-body-sm text-graphite transition-colors duration-200 hover:text-ink-black">Team</a>
    <a href="#contact" class="text-body-sm text-graphite transition-colors duration-200 hover:text-ink-black">Contact</a>
  </nav>
  <span class="md:hidden">
    <Pill size="menu" id="menuBtn" aria-expanded={String(open)} aria-controls="menuOverlay" onclick={() => onmenu?.()}>Menu</Pill>
  </span>
</header>
