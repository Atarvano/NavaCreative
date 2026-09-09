<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, typewrite, reveals, drift, magnetic } from '../lib/motion.js';
  import Pill from '../components/ui/Pill.svelte';

  // CTA heading line reveal + magnetic button (desktop) + stills plates
  // scale/opacity rise with CSS translateY offsets preserved: only opacity
  // and scale animate, never y. The Rupture (ticket 06): the heading's
  // "with us?" line carries one accent-tinted word — the single
  // rule-break on the page, CTA-only, static markup (never motion-gated
  // so reduced-motion keeps it readable).
  let section;
  let ctx;
  let mm;
  let settleType = () => {};

  onMount(() => {
    ctx = motion(section, () => {
      settleType = typewrite(section.querySelector('.cta-title'));
      drift(section.querySelector('.cta-title'));
      reveals(section);
      drift(section.querySelector('.cta-strip'), {
        axis: 'x',
        range: 20,
        trigger: section,
        start: 'top 85%',
        end: 'bottom bottom',
      });
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
    settleType();
  });
</script>

<!-- CTA: the one inverted featured block + stills strip. The Rupture
     (moment) lives here only: "us?" in signal-yellow — the page's one
     deliberate rule-break, owner-approved per ADR-0009. -->
<section id="contact" bind:this={section} class="bg-navy-ink text-bone-white">
  <p class="mb-12 text-caption uppercase text-bone-white/60">Contact</p>
  <h2 class="cta-title mb-8 text-[clamp(2.75rem,8vw,84px)] leading-none font-light tracking-[-0.04em]">
    <span class="line-mask"><span class="line">Ready to work</span></span>
    <span class="line-mask"><span class="line">with <em class="rupture not-italic text-signal-yellow">us?</em></span></span>
  </h2>
  <p data-reveal class="mx-auto mb-8 max-w-[34ch] text-subheading text-bone-white/70">Where art meets purpose and imagination knows no limits.</p>
  <Pill href="https://wa.me/6285817999140" target="_blank" rel="noopener" variant="light" size="lg" magnetic>Start a Project</Pill>
  <div data-reveal class="cta-strip group mt-16 flex justify-center gap-4 max-md:flex-wrap">
    <img src="./img/work-misc-1.jpg" alt="Recent production still" width="1080" height="1350" loading="lazy" class="aspect-[4/5] w-[clamp(120px,18vw,260px)] object-cover grayscale group-hover:grayscale-0" />
    <img src="./img/work-misc-2.jpg" alt="Recent production still" width="1080" height="1350" loading="lazy" class="aspect-[4/5] w-[clamp(120px,18vw,260px)] -translate-y-6 object-cover grayscale group-hover:grayscale-0 max-md:translate-y-0" />
    <img src="./img/work-misc-3.jpg" alt="Recent production still" width="1080" height="1350" loading="lazy" class="aspect-[4/5] w-[clamp(120px,18vw,260px)] translate-y-3 object-cover grayscale group-hover:grayscale-0 max-md:translate-y-0" />
  </div>
</section>
