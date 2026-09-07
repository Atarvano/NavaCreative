<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion } from '../lib/motion.js';

  // Work portfolio: static markup plus the ADR-0003 desktop pin (exactly
  // 100dvh, start top top, scrub, no anticipatePin) with horizontal cards
  // and once-per-card rise. Mobile keeps the native snap carousel with
  // fade-up cards. Owns its own title reveal with pinnedContainer so the
  // global sweep must skip .work.
  let section;
  let track;
  let ctx;
  let mm;

  onMount(() => {
    ctx = motion(section, () => {
      const title = section.querySelector('.section-title');
      gsap.fromTo(
        title.querySelectorAll('.line'),
        { yPercent: 115 },
        {
          yPercent: 0,
          duration: 1.15,
          ease: 'expo.out',
          stagger: 0.09,
          scrollTrigger: {
            trigger: title,
            start: 'top 85%',
            once: true,
            pinnedContainer: section,
          },
        }
      );

      mm = gsap.matchMedia();

      // Desktop pin: cards travel horizontally while the section holds one
      // viewport. invalidateOnRefresh keeps the distance honest on resize.
      mm.add('(min-width: 769px)', () => {
        const distance = () => track.scrollWidth - window.innerWidth;
        const scrollTween = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => '+=' + distance(),
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });

        section.querySelectorAll('.work-card').forEach((card) => {
          gsap.fromTo(
            card,
            { y: 60 },
            {
              y: 0,
              duration: 0.8,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: card,
                containerAnimation: scrollTween,
                start: 'left 95%',
                once: true,
              },
            }
          );
        });
      });

      // Mobile: no pin, cards fade up in the snap carousel.
      mm.add('(max-width: 768px)', () => {
        section.querySelectorAll('.work-card').forEach((card) => {
          gsap.fromTo(
            card,
            { opacity: 0, y: 40 },
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: 'power3.out',
              scrollTrigger: { trigger: card, start: 'top 92%', once: true },
            }
          );
        });
      });
    });
  });

  // Revert the matchMedia first (kills the pin + its spacer), then the
  // context, so navigating away never leaves a stuck pin or leaked trigger.
  onDestroy(() => {
    mm?.revert();
    ctx?.revert();
  });
</script>

<!-- Work: horizontal print portfolio. -->
<section class="work" id="work" bind:this={section}>
  <div class="work-head">
    <div>
      <p class="eyebrow">Work</p>
      <h2 class="section-title">
        <span class="line-mask"><span class="line">Selected work</span></span>
      </h2>
    </div>
    <p class="work-hint">Photo &amp; video productions</p>
  </div>
  <div class="work-track" id="workTrack" bind:this={track}>
    <article class="work-card work-card-l">
      <figure class="work-frame"><img src="img/pv-ihsan-ochi.jpg" alt="Prewedding portrait of Ihsan and Ochi" width="1200" height="1800" loading="lazy" /></figure>
      <p class="work-meta">Photo Prewedding</p>
      <h3 class="work-name">Ihsan &amp; Ochi</h3>
    </article>
    <article class="work-card work-card-s">
      <figure class="work-frame"><img src="img/pv-banda-neira.jpg" alt="Banda Neira on stage" width="1080" height="1350" loading="lazy" /></figure>
      <p class="work-meta">Stage Photography</p>
      <h3 class="work-name">Banda Neira</h3>
    </article>
    <article class="work-card work-card-s">
      <figure class="work-frame"><img src="img/pv-tsenja.jpg" alt="Tsenja photoshoot" width="1600" height="2400" loading="lazy" /></figure>
      <p class="work-meta">Photoshoot</p>
      <h3 class="work-name">Tsenja</h3>
    </article>
    <article class="work-card work-card-s">
      <figure class="work-frame"><img src="img/pv-stage.jpg" alt="Stage performance photography" width="1600" height="2400" loading="lazy" /></figure>
      <p class="work-meta">Stage Photography</p>
      <h3 class="work-name">Rissau</h3>
    </article>
    <article class="work-card work-card-l">
      <figure class="work-frame"><img src="img/pv-event.jpg" alt="Event photography coverage" width="2400" height="1600" loading="lazy" /></figure>
      <p class="work-meta">Event Photography</p>
      <h3 class="work-name">Amsakar Cup II</h3>
    </article>
    <article class="work-card work-card-s">
      <figure class="work-frame"><img src="img/gd-double-g.jpg" alt="Graphic design work for Double G" width="1599" height="2400" loading="lazy" /></figure>
      <p class="work-meta">Graphic Design</p>
      <h3 class="work-name">Double G</h3>
    </article>
    <article class="work-card work-card-s">
      <figure class="work-frame"><img src="img/pv-ceremony.jpg" alt="Ceremony photography" width="1200" height="1800" loading="lazy" /></figure>
      <p class="work-meta">Photo &amp; Video</p>
      <h3 class="work-name">Titik Ngopi</h3>
    </article>
    <article class="work-card work-card-s">
      <figure class="work-frame"><img src="img/pv-crowd.jpg" alt="Crowd during a live event" width="1200" height="1800" loading="lazy" /></figure>
      <p class="work-meta">Event Documentation</p>
      <h3 class="work-name">Perry Pet Shop</h3>
    </article>
  </div>
</section>
