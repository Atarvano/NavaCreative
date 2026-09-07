<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion } from '../lib/motion.js';

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
<div class="menu-overlay" id="menuOverlay" class:is-open={open} aria-hidden={String(!open)} bind:this={overlay}>
  <div class="menu-top">
    <p class="menu-brand">Nava Creative</p>
    <button class="menu-close" id="menuClose" onclick={() => onclose?.()}>Close</button>
  </div>
  <nav class="menu-nav" aria-label="Menu">
    <a class="menu-link" href="#about" onclick={() => onclose?.()}><span class="menu-mask"><span class="menu-line">About</span></span></a>
    <a class="menu-link" href="#services" onclick={() => onclose?.()}><span class="menu-mask"><span class="menu-line">Services</span></span></a>
    <a class="menu-link" href="#work" onclick={() => onclose?.()}><span class="menu-mask"><span class="menu-line">Work</span></span></a>
    <a class="menu-link" href="#live" onclick={() => onclose?.()}><span class="menu-mask"><span class="menu-line">Live</span></span></a>
    <a class="menu-link" href="#team" onclick={() => onclose?.()}><span class="menu-mask"><span class="menu-line">Team</span></span></a>
    <a class="menu-link" href="#contact" onclick={() => onclose?.()}><span class="menu-mask"><span class="menu-line">Contact</span></span></a>
  </nav>
  <div class="menu-meta">
    <a href="https://instagram.com/navacreative.btm" target="_blank" rel="noopener">@navacreative.btm</a>
    <a href="https://wa.me/6285817999140" target="_blank" rel="noopener">0858-1799-9140</a>
    <a href="mailto:navaproduction9@gmail.com">navaproduction9@gmail.com</a>
  </div>
</div>
