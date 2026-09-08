<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, magnetic } from '../lib/motion.js';
  import Pill from '../components/ui/Pill.svelte';

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

<!-- Hero: editorial manifesto + full-bleed photo band + Caption plate. -->
<section id="home" bind:this={section} class="pb-12">
  <div class="pt-[calc(var(--nav-h)_+_64px)] max-md:pt-[calc(var(--nav-h)_+_24px)]">
    <h1 class="hero-title mb-12 text-[clamp(2.75rem,8.4vw,84px)] leading-none font-light tracking-[-0.04em] max-md:text-[clamp(2.1rem,9.5vw,4rem)]">
      <span class="line-mask"><span class="line">Crafting Moments,</span></span>
      <span class="line-mask"><span class="line">Creating Impact.</span></span>
    </h1>
  </div>
  <div class="hero-side mb-16 flex items-end justify-between gap-8 max-md:flex-col max-md:items-start">
    <p class="max-w-[30rem] text-subheading text-graphite">A creative entity bringing fresh, solution-oriented ideas to today's visual and communication needs.</p>
    <div class="flex flex-wrap gap-2">
      <Pill href="https://wa.me/6285817999140" target="_blank" rel="noopener" magnetic>Start a Project</Pill>
      <Pill href="#work" variant="ghost" magnetic>See Work</Pill>
    </div>
  </div>
  <div class="relative mx-[calc(var(--pad)*-1)] h-[72vh] min-h-[380px] max-md:h-[52vh]">
    <div class="hero-frame h-full w-full">
      <img src="./img/hero-main.jpg" alt="Nava Creative photographer on set" width="1800" height="2400" fetchpriority="high" class="h-full w-full object-cover" />
    </div>
    <div class="absolute bottom-12 left-8 z-1 block w-fit max-w-[min(560px,80%)] bg-bone-white px-6 py-4 text-ink-black max-md:bottom-4 max-md:left-4">
      <p class="mb-2 text-caption text-graphite uppercase">Nava Creative Studio // Batam</p>
      <p class="text-heading-sm leading-[1.25] font-light">On set with the crew.</p>
    </div>
  </div>
</section>
