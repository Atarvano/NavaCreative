<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, magnetic } from '../lib/motion.js';

  // Paused intro timeline (the preloader plays it via play()); owns its
  // initial states via fromTo since the Svelte shell releases the
  // stylesheet-gated ones. Magnetic CTAs are desktop-only.
  let section;
  let intro;
  let ctx;
  let mm;

  export function play() {
    intro?.play();
  }

  onMount(() => {
    ctx = motion(section, () => {
      intro = gsap.timeline({ paused: true });
      intro
        .fromTo(
          section.querySelectorAll('.hero-title .line'),
          { yPercent: 115 },
          { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.09 },
          0
        )
        .fromTo(
          section.querySelector('.hero-frame img'),
          { scale: 1.18 },
          { scale: 1, duration: 1.6, ease: 'expo.out' },
          0.1
        )
        .fromTo(
          section.querySelector('.hero-frame'),
          { clipPath: 'inset(0% 0% 100% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out' },
          0.15
        )
        .fromTo(
          section.querySelectorAll('.hero-side > *'),
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 },
          0.7
        );

      mm = gsap.matchMedia();
      mm.add('(min-width: 769px)', () => {
        const ac = new AbortController();
        section
          .querySelectorAll('.magnetic')
          .forEach((btn) => magnetic(btn, ac.signal));
        return () => ac.abort();
      });
    });
  });

  onDestroy(() => {
    mm?.revert();
    ctx?.revert();
  });
</script>

<!-- Hero: editorial manifesto + full-bleed photo band + Caption plate. 1:1 with legacy/index.html markup. -->
<section class="hero" id="home" bind:this={section}>
  <div class="hero-top">
    <h1 class="hero-title">
      <span class="line-mask"><span class="line">Crafting Moments,</span></span>
      <span class="line-mask"><span class="line">Creating Impact.</span></span>
    </h1>
  </div>
  <div class="hero-side">
    <p class="hero-sub">A creative entity bringing fresh, solution-oriented ideas to today's visual and communication needs.</p>
    <div class="hero-ctas">
      <a class="btn btn-accent magnetic" href="https://wa.me/6285817999140" target="_blank" rel="noopener">Start a Project</a>
      <a class="btn btn-ghost magnetic" href="#work">See Work</a>
    </div>
  </div>
  <div class="hero-media">
    <div class="hero-frame">
      <img src="./img/hero-main.jpg" alt="Nava Creative photographer on set" width="1800" height="2400" fetchpriority="high" />
    </div>
    <div class="hero-overlay">
      <p class="hero-meta">Nava Creative Studio // Batam</p>
      <p class="hero-overlay-title">On set with the crew.</p>
    </div>
  </div>
</section>
