<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, lines, reveals, magnetic } from '../lib/motion.js';

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
<section class="cta" id="contact" bind:this={section}>
  <p class="eyebrow eyebrow-invert">Contact</p>
  <h2 class="cta-title">
    <span class="line-mask"><span class="line">Ready to work</span></span>
    <span class="line-mask"><span class="line">with us?</span></span>
  </h2>
  <p class="cta-sub" data-reveal>Where art meets purpose and imagination knows no limits.</p>
  <a class="btn btn-accent btn-big magnetic" href="https://wa.me/6285817999140" target="_blank" rel="noopener">Start a Project</a>
  <div class="cta-strip" data-reveal>
    <img src="./img/work-misc-1.jpg" alt="Recent production still" width="1080" height="1350" loading="lazy" />
    <img src="./img/work-misc-2.jpg" alt="Recent production still" width="1080" height="1350" loading="lazy" />
    <img src="./img/work-misc-3.jpg" alt="Recent production still" width="1080" height="1350" loading="lazy" />
  </div>
</section>
