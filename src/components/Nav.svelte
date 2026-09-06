<script>
  import { onMount, onDestroy } from 'svelte';
  import { ScrollTrigger, motion } from '../lib/motion.js';

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

<!-- Nav: editorial lockup + inline links + mobile Menu pill. 1:1 with legacy/index.html markup. -->
<header class="nav" id="nav" bind:this={header}>
  <a class="nav-lockup" href="#home">
    <span class="nav-mark" aria-hidden="true"></span>
    <span class="nav-eyebrow">Nava Creative //<br />Photo &amp; Video Studio</span>
  </a>
  <nav class="nav-links" aria-label="Primary">
    <a href="#about">About</a>
    <a href="#services">Services</a>
    <a href="#work">Work</a>
    <a href="#live">Live</a>
    <a href="#team">Team</a>
    <a href="#contact">Contact</a>
  </nav>
  <button class="menu-btn" id="menuBtn" aria-expanded={String(open)} aria-controls="menuOverlay" onclick={() => onmenu?.()}>Menu</button>
</header>
