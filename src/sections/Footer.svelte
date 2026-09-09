<script>
  import { onMount, onDestroy } from 'svelte';
  import { motion, lines, drift } from '../lib/motion.js';

  // Giant closing wordmark line reveal.
  // `base` prefixes the menu anchors: '' on the index, 'index.html'
  // on service pages so subpage section links never strand the visitor.
  let { base = '' } = $props();

  let footer;
  let ctx;

  onMount(() => {
    ctx = motion(footer, () => {
      lines(footer.querySelector('.footer-word'));
      // Index only: ServiceDetail mounts Footer too, but story #33 locks
      // service pages pixel-untouched. The sibling-guard reads the two
      // app shells apart (#home = index, #service-detail = service page)
      // so the wordmark drifts on the index and stays static elsewhere.
      if (document.querySelector('#app main > #home'))
        drift(footer.querySelector('.footer-word'), {
          axis: 'x',
          range: 48,
          trigger: footer,
          start: 'top bottom',
          end: 'bottom bottom',
        });
    });
  });

  onDestroy(() => ctx?.revert());
</script>

<!-- Footer: colophon. -->
<footer bind:this={footer} class="overflow-hidden border-t border-ash px-(--pad) pt-16 pb-6">
  <p class="footer-word text-[clamp(2rem,9.5vw,9rem)] leading-none font-light tracking-[-0.04em] whitespace-nowrap" aria-hidden="true"><span class="line-mask"><span class="line">Nava Creative<i class="ml-[0.06em] inline-block h-[0.14em] w-[0.14em] rounded-full bg-magenta-bloom"></i></span></span></p>
  <div class="grid grid-cols-[2fr_1fr_1fr] gap-12 max-md:grid-cols-1 max-md:gap-8">
    <div>
      <p class="text-subheading font-normal">Nava Creative</p>
      <p class="mt-2 text-body-sm text-graphite">Crafting Moments, Creating Impact.</p>
    </div>
    <div class="grid content-start gap-2 text-body-sm">
      <p class="mb-4 text-caption text-graphite uppercase">Contact</p>
      <a href="https://instagram.com/navacreative.btm" target="_blank" rel="noopener" class="text-ink-black transition-colors duration-200 hover:text-graphite">@navacreative.btm</a>
      <a href="https://wa.me/6285817999140" target="_blank" rel="noopener" class="text-ink-black transition-colors duration-200 hover:text-graphite">0858-1799-9140</a>
      <a href="mailto:navaproduction9@gmail.com" class="text-ink-black transition-colors duration-200 hover:text-graphite">navaproduction9@gmail.com</a>
    </div>
    <div class="grid content-start gap-2 text-body-sm">
      <p class="mb-4 text-caption text-graphite uppercase">Menu</p>
      <a href="{base}#about" class="text-ink-black transition-colors duration-200 hover:text-graphite">About</a>
      <a href="{base}#services" class="text-ink-black transition-colors duration-200 hover:text-graphite">Services</a>
      <a href="{base}#work" class="text-ink-black transition-colors duration-200 hover:text-graphite">Work</a>
      <a href="{base}#team" class="text-ink-black transition-colors duration-200 hover:text-graphite">Team</a>
    </div>
  </div>
  <p class="mt-16 border-t border-ash pt-4 text-caption text-graphite">Copyright 2025 Nava Creative, Batam</p>
</footer>
