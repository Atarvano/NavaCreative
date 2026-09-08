<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion } from '../lib/motion.js';
  import Pill from '../components/ui/Pill.svelte';

  // Full-screen Navy Ink nav (mobile only): the paused open/close timeline
  // plays on the `open` prop; the class toggle + scroll-lock below keep the
  // reduced-motion path working with no animation at all.
  let { open = false, onclose } = $props();

  let overlay;
  let ctx;
  let tl;

  // Lock body scroll while the overlay is open.
  $effect(() => {
    document.body.classList.toggle('menu-locked', open);
    return () => document.body.classList.remove('menu-locked');
  });

  $effect(() => {
    if (!tl) return;
    if (open) tl.timeScale(1).play();
    else tl.timeScale(1.6).reverse();
  });

  onMount(() => {
    ctx = motion(overlay, () => {
      tl = gsap.timeline({ paused: true });
      tl.set(overlay, { visibility: 'visible' })
        .to(overlay, {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.7,
          ease: 'expo.inOut',
        })
        .fromTo(
          overlay.querySelectorAll('.menu-link .menu-line'),
          { yPercent: 115 },
          {
            yPercent: 0,
            duration: 0.8,
            ease: 'expo.out',
            stagger: 0.06,
            immediateRender: false,
          },
          '-=0.25'
        )
        .fromTo(
          overlay.querySelectorAll('.menu-meta a'),
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.06 },
          '-=0.4'
        );
    });
  });

  onDestroy(() => ctx?.revert());
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && open) onclose?.(); }} />

<!-- Menu overlay: full-screen Navy Ink nav (mobile only). -->
<div id="menuOverlay" class:is-open={open} aria-hidden={String(!open)} bind:this={overlay} class="invisible fixed inset-0 z-90 hidden flex-col bg-navy-ink px-(--pad) pt-4 pb-8 text-bone-white [clip-path:inset(0%_0%_100%_0%)] max-md:flex">
  <div class="flex h-(--nav-h) items-center justify-between">
    <p class="text-body">Nava Creative</p>
    <Pill id="menuClose" variant="light" size="menu" onclick={() => onclose?.()}>Close</Pill>
  </div>
  <nav aria-label="Menu" class="flex min-h-0 flex-1 flex-col justify-center gap-2 overflow-y-auto">
    <a href="#about" onclick={() => onclose?.()} class="menu-link w-fit text-[clamp(2rem,8.5vw,6.5rem)] leading-[1.12] font-light tracking-[-0.04em] transition-opacity duration-200 hover:opacity-55"><span class="menu-mask"><span class="menu-line">About</span></span></a>
    <a href="#services" onclick={() => onclose?.()} class="menu-link w-fit text-[clamp(2rem,8.5vw,6.5rem)] leading-[1.12] font-light tracking-[-0.04em] transition-opacity duration-200 hover:opacity-55"><span class="menu-mask"><span class="menu-line">Services</span></span></a>
    <a href="#work" onclick={() => onclose?.()} class="menu-link w-fit text-[clamp(2rem,8.5vw,6.5rem)] leading-[1.12] font-light tracking-[-0.04em] transition-opacity duration-200 hover:opacity-55"><span class="menu-mask"><span class="menu-line">Work</span></span></a>
    <a href="#live" onclick={() => onclose?.()} class="menu-link w-fit text-[clamp(2rem,8.5vw,6.5rem)] leading-[1.12] font-light tracking-[-0.04em] transition-opacity duration-200 hover:opacity-55"><span class="menu-mask"><span class="menu-line">Live</span></span></a>
    <a href="#team" onclick={() => onclose?.()} class="menu-link w-fit text-[clamp(2rem,8.5vw,6.5rem)] leading-[1.12] font-light tracking-[-0.04em] transition-opacity duration-200 hover:opacity-55"><span class="menu-mask"><span class="menu-line">Team</span></span></a>
    <a href="#contact" onclick={() => onclose?.()} class="menu-link w-fit text-[clamp(2rem,8.5vw,6.5rem)] leading-[1.12] font-light tracking-[-0.04em] transition-opacity duration-200 hover:opacity-55"><span class="menu-mask"><span class="menu-line">Contact</span></span></a>
  </nav>
  <div class="menu-meta flex flex-wrap gap-x-8 gap-y-4 text-body-sm text-bone-white/70">
    <a href="https://instagram.com/navacreative.btm" target="_blank" rel="noopener" class="hover:text-bone-white">@navacreative.btm</a>
    <a href="https://wa.me/6285817999140" target="_blank" rel="noopener" class="hover:text-bone-white">0858-1799-9140</a>
    <a href="mailto:navaproduction9@gmail.com" class="hover:text-bone-white">navaproduction9@gmail.com</a>
  </div>
</div>

<style>
  /* Open state under reduced motion (no GSAP): class toggle alone reveals */
  .is-open {
    visibility: visible;
    clip-path: inset(0% 0% 0% 0%);
  }
</style>
