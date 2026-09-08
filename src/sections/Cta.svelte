<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, lines, reveals, magnetic } from '../lib/motion.js';
  import Pill from '../components/ui/Pill.svelte';

  // CTA heading line reveal + magnetic button (desktop) + stills plates
  // scale/opacity rise with CSS translateY offsets preserved: only opacity
  // and scale animate, never y.
  let section;
  let ctx;
  let mm;

  onMount(() => {
    ctx = motion(section, () => {
      lines(section.querySelector('.cta-title'));
      reveals(section);
      gsap.fromTo(
        section.querySelectorAll('.cta-strip img'),
        { opacity: 0, scale: 0.92 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: {
            trigger: section.querySelector('.cta-strip'),
            start: 'top 90%',
            once: true,
          },
        }
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

<!-- CTA: the one inverted featured block + stills strip. -->
<section id="contact" bind:this={section} class="bg-navy-ink text-bone-white">
  <p class="mb-12 text-caption uppercase text-bone-white/60">Contact</p>
  <h2 class="cta-title mb-8 text-[clamp(2.75rem,8vw,84px)] leading-none font-light tracking-[-0.04em]">
    <span class="line-mask"><span class="line">Ready to work</span></span>
    <span class="line-mask"><span class="line">with us?</span></span>
  </h2>
  <p data-reveal class="mx-auto mb-8 max-w-[34ch] text-subheading text-bone-white/70">Where art meets purpose and imagination knows no limits.</p>
  <Pill href="https://wa.me/6285817999140" target="_blank" rel="noopener" variant="light" size="lg" magnetic>Start a Project</Pill>
  <div data-reveal class="cta-strip group mt-16 flex justify-center gap-4 max-md:flex-wrap">
    <img src="./img/work-misc-1.jpg" alt="Recent production still" width="1080" height="1350" loading="lazy" class="aspect-[4/5] w-[clamp(120px,18vw,260px)] object-cover grayscale group-hover:grayscale-0" />
    <img src="./img/work-misc-2.jpg" alt="Recent production still" width="1080" height="1350" loading="lazy" class="aspect-[4/5] w-[clamp(120px,18vw,260px)] -translate-y-6 object-cover grayscale group-hover:grayscale-0 max-md:translate-y-0" />
    <img src="./img/work-misc-3.jpg" alt="Recent production still" width="1080" height="1350" loading="lazy" class="aspect-[4/5] w-[clamp(120px,18vw,260px)] translate-y-3 object-cover grayscale group-hover:grayscale-0 max-md:translate-y-0" />
  </div>
</section>
