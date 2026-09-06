<script>
  import { onMount, onDestroy } from 'svelte';
  import { motion, lines } from '../lib/motion.js';

  // Giant closing wordmark line reveal.
  let footer;
  let ctx;

  onMount(() => {
    ctx = motion(footer, () => {
      lines(footer.querySelector('.footer-word'));
    });
  });

  onDestroy(() => ctx?.revert());
</script>

<!-- Footer: colophon. 1:1 with legacy/index.html markup. -->
<footer class="footer" bind:this={footer}>
  <p class="footer-word" aria-hidden="true"><span class="line-mask"><span class="line">Nava Creative<i class="footer-dot"></i></span></span></p>
  <div class="footer-grid">
    <div class="footer-brand">
      <p class="footer-logo">Nava Creative</p>
      <p class="footer-tag">Crafting Moments, Creating Impact.</p>
    </div>
    <div class="footer-col">
      <p class="footer-head">Contact</p>
      <a href="https://instagram.com/navacreative.btm" target="_blank" rel="noopener">@navacreative.btm</a>
      <a href="https://wa.me/6285817999140" target="_blank" rel="noopener">0858-1799-9140</a>
      <a href="mailto:navaproduction9@gmail.com">navaproduction9@gmail.com</a>
    </div>
    <div class="footer-col">
      <p class="footer-head">Menu</p>
      <a href="#about">About</a>
      <a href="#services">Services</a>
      <a href="#work">Work</a>
      <a href="#team">Team</a>
    </div>
  </div>
  <p class="footer-base">Copyright 2025 Nava Creative, Batam</p>
</footer>
