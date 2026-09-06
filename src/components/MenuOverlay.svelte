<!-- Menu overlay: full-screen Navy Ink nav (mobile only). Plain class toggle here, no GSAP — the open/close timeline lands in ticket 04. 1:1 with legacy/index.html markup. -->
<script>
  let { open = false, onclose } = $props();

  // Mirror legacy setMenu: lock body scroll while the overlay is open.
  $effect(() => {
    document.body.classList.toggle('menu-locked', open);
    return () => document.body.classList.remove('menu-locked');
  });
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && open) onclose?.(); }} />

<div class="menu-overlay" id="menuOverlay" class:is-open={open} aria-hidden={String(!open)}>
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
