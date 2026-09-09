<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, ScrollTrigger, motion } from '../lib/motion.js';
  import Tag from '../components/ui/Tag.svelte';

  // Work portfolio in Tailwind: static markup plus the ADR-0003 desktop pin
  // (exactly 100dvh, start top top, scrub, no anticipatePin) with
  // horizontal cards and once-per-card rise. Mobile keeps the native snap
  // carousel with fade-up cards. Owns its own title reveal with
  // pinnedContainer so the global sweep must skip .work.
  // Breakpoints sit on the theme md split (768 desktop / 767 mobile) so the
  // JS branches always agree with the md: utilities (the old 769/768 split
  // left 768px wide running the mobile branch under desktop CSS: no pin).
  // The title stays a raw h2, not SectionTitle: the head budget needs its
  // bottom margin at exactly 0, and utilities already beat
  // SectionTitle's scoped style without an !important fight.
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

      // Scroll depth (ticket 04): hairline + card counter tracking the
      // horizontal travel. Two sources, one contract — the pin's onUpdate
      // on desktop, the track's native scroll on mobile — merged through
      // setMeters so both always agree on progress and the 01-based card.
      // Index N = round(p * (N-1)) + 1: the closest passed card edge.
      const cards = [...section.querySelectorAll('.work-card')];
      const fill = section.querySelector('.work-progress-fill');
      const counter = section.querySelector('.work-counter');
      const total = String(cards.length).padStart(2, '0');
      const setMeters = (p) => {
        const i = Math.min(cards.length - 1, Math.round(p * (cards.length - 1)));
        fill.style.transform = `scaleX(${p})`;
        counter.textContent = `${String(i + 1).padStart(2, '0')} / ${total}`;
      };
      setMeters(0);

      mm = gsap.matchMedia();

      // Desktop pin: cards travel horizontally while the section holds one
      // viewport. invalidateOnRefresh keeps the distance honest on resize.
      // onRefresh re-syncs the meters to the true pin progress: after a
      // refresh (pin re-created at progress 1), ScrollTrigger deliberately
      // suppresses an onUpdate with an unchanged progress, so without
      // this the counter could strand at 08/08 at pin start.
      mm.add('(min-width: 768px)', () => {
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
            onUpdate: (self) => setMeters(self.progress),
            onRefresh: (self) => setMeters(ScrollTrigger.isInViewport(section) ? self.progress : 0),
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

      // Mobile: no pin, cards fade up in the snap carousel; the meters
      // track the track's own native scroll, aborted on branch revert.
      mm.add('(max-width: 767px)', () => {
        const ac = new AbortController();
        track.addEventListener(
          'scroll',
          () => {
            const max = track.scrollWidth - track.clientWidth;
            setMeters(max > 0 ? track.scrollLeft / max : 0);
          },
          { signal: ac.signal, passive: true }
        );
        setMeters(0);
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
        return () => ac.abort();
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
<section class="work px-0 md:h-[100dvh] md:overflow-hidden md:p-0" id="work" bind:this={section}>
  <div class="mb-12 flex items-end justify-between gap-8 px-(--pad) md:mb-4 md:pt-[calc(var(--nav-h)_+_24px)]">
    <div>
      <p class="mb-12 text-caption text-graphite uppercase">Work</p>
      <h2 class="section-title mb-0 text-heading font-light max-md:text-[clamp(2rem,8.5vw,3rem)] max-md:tracking-[-0.02em]">
        <span class="line-mask"><span class="line">Selected work</span></span>
      </h2>
    </div>
    <p class="text-caption text-graphite uppercase">Photo &amp; video productions</p>
    <p class="work-counter ml-auto text-caption text-graphite uppercase tabular-nums" aria-hidden="true">01 / 08</p>
  </div>
  <div aria-hidden="true" class="work-progress mx-(--pad) mb-4 h-px bg-ash/40 md:mb-6">
    <div class="work-progress-fill h-full w-full origin-left bg-ink-black" style="transform: scaleX(0)"></div>
  </div>
  <div class="flex items-end gap-12 px-(--pad) pb-4 will-change-transform max-md:snap-x max-md:snap-mandatory max-md:overflow-x-auto md:pb-6" id="workTrack" bind:this={track}>
    <article class="work-card group flex-none max-md:w-[min(78vw,340px)] max-md:snap-start">
      <figure class="aspect-[3/4] w-full md:aspect-[3/2] md:h-[min(44vh,460px)] md:w-auto"><img src="img/pv-ihsan-ochi.jpg" alt="Prewedding portrait of Ihsan and Ochi" width="1200" height="1800" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 ease-emphasis group-hover:scale-[1.03] group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Photo Prewedding</Tag>
      <h3 class="mt-2 text-subheading font-light">Ihsan &amp; Ochi</h3>
    </article>
    <article class="work-card group flex-none max-md:w-[min(78vw,340px)] max-md:snap-start">
      <figure class="aspect-[3/4] w-full md:h-[min(44vh,460px)] md:w-auto"><img src="img/pv-banda-neira.jpg" alt="Banda Neira on stage" width="1080" height="1350" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 ease-emphasis group-hover:scale-[1.03] group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Stage Photography</Tag>
      <h3 class="mt-2 text-subheading font-light">Banda Neira</h3>
    </article>
    <article class="work-card group flex-none max-md:w-[min(78vw,340px)] max-md:snap-start">
      <figure class="aspect-[3/4] w-full md:h-[min(44vh,460px)] md:w-auto"><img src="img/pv-tsenja.jpg" alt="Tsenja photoshoot" width="1600" height="2400" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 ease-emphasis group-hover:scale-[1.03] group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Photoshoot</Tag>
      <h3 class="mt-2 text-subheading font-light">Tsenja</h3>
    </article>
    <article class="work-card group flex-none max-md:w-[min(78vw,340px)] max-md:snap-start">
      <figure class="aspect-[3/4] w-full md:h-[min(44vh,460px)] md:w-auto"><img src="img/pv-stage.jpg" alt="Stage performance photography" width="1600" height="2400" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 ease-emphasis group-hover:scale-[1.03] group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Stage Photography</Tag>
      <h3 class="mt-2 text-subheading font-light">Rissau</h3>
    </article>
    <article class="work-card group flex-none max-md:w-[min(78vw,340px)] max-md:snap-start">
      <figure class="aspect-[3/4] w-full md:aspect-[3/2] md:h-[min(44vh,460px)] md:w-auto"><img src="img/pv-event.jpg" alt="Event photography coverage" width="2400" height="1600" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 ease-emphasis group-hover:scale-[1.03] group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Event Photography</Tag>
      <h3 class="mt-2 text-subheading font-light">Amsakar Cup II</h3>
    </article>
    <article class="work-card group flex-none max-md:w-[min(78vw,340px)] max-md:snap-start">
      <figure class="aspect-[3/4] w-full md:h-[min(44vh,460px)] md:w-auto"><img src="img/gd-double-g.jpg" alt="Graphic design work for Double G" width="1599" height="2400" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 ease-emphasis group-hover:scale-[1.03] group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Graphic Design</Tag>
      <h3 class="mt-2 text-subheading font-light">Double G</h3>
    </article>
    <article class="work-card group flex-none max-md:w-[min(78vw,340px)] max-md:snap-start">
      <figure class="aspect-[3/4] w-full md:h-[min(44vh,460px)] md:w-auto"><img src="img/pv-ceremony.jpg" alt="Ceremony photography" width="1200" height="1800" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 ease-emphasis group-hover:scale-[1.03] group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Photo &amp; Video</Tag>
      <h3 class="mt-2 text-subheading font-light">Titik Ngopi</h3>
    </article>
    <article class="work-card group flex-none max-md:w-[min(78vw,340px)] max-md:snap-start">
      <figure class="aspect-[3/4] w-full md:h-[min(44vh,460px)] md:w-auto"><img src="img/pv-crowd.jpg" alt="Crowd during a live event" width="1200" height="1800" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 ease-emphasis group-hover:scale-[1.03] group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Event Documentation</Tag>
      <h3 class="mt-2 text-subheading font-light">Perry Pet Shop</h3>
    </article>
  </div>
</section>
