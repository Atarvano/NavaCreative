<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, lines, drift, SCRUB_RANGE } from '../lib/motion.js';
  import SectionTitle from '../components/ui/SectionTitle.svelte';
  import Tag from '../components/ui/Tag.svelte';

  // Heading line reveal + card cascade + title drift; the parallax scrub
  // on each frame's img (triggered off the .parallax wrapper) runs
  // ungated since ticket 04 for scroll parity.
  let section;
  let ctx;

  onMount(() => {
    ctx = motion(section, () => {
      lines(section.querySelector('.section-title'));
      drift(section.querySelector('.section-title'));
      section.querySelectorAll('.live-card').forEach((card, i) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 44 },
          {
            opacity: 1,
            y: 0,
            duration: 0.85,
            ease: 'power3.out',
            delay: (i % 2) * 0.12,
            scrollTrigger: { trigger: card, start: 'top 86%', once: true },
          }
        );
      });
      // Scroll parity: the Scrub runs on mobile too (ticket 04 un-gates
      // the desktop-only frames; the About band was never gated).
      section.querySelectorAll('.parallax img').forEach((img) => {
        gsap.fromTo(
          img,
          { yPercent: -SCRUB_RANGE },
          {
            yPercent: SCRUB_RANGE,
            ease: 'none',
            scrollTrigger: {
              trigger: img.closest('.parallax'),
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        );
      });
    });
  });

  onDestroy(() => ctx?.revert());
</script>

<!-- Live: event records grid. -->
<section id="live" bind:this={section}>
  <SectionTitle lines={["Live & documented"]} />
  <div class="grid grid-cols-2 gap-x-12 gap-y-16 max-md:grid-cols-1 max-md:gap-12">
    <article class="live-card group">
      <figure class="parallax aspect-[4/3]"><img src="./img/vid-walimatul-ursy.jpg" alt="Walimatul Ursy of Lia and Fenda" width="1080" height="1920" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter] duration-500 ease-emphasis group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Live Streaming</Tag>
      <h3 class="mt-2 max-w-[36ch] text-subheading font-light">Walimatul Ursy, Lia &amp; Fenda</h3>
    </article>
    <article class="live-card group">
      <figure class="parallax aspect-[4/3]"><img src="./img/vid-walimatul-naqiah.jpg" alt="Walimatul Naqiah ceremony" width="1600" height="2400" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter] duration-500 ease-emphasis group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Video Documentation</Tag>
      <h3 class="mt-2 max-w-[36ch] text-subheading font-light">Walimatul Naqi'ah</h3>
    </article>
    <article class="live-card group">
      <figure class="parallax aspect-[4/3]"><img src="./img/vid-santunan.jpg" alt="Santunan anak yatim with Srikandi and Forkom" width="2400" height="1600" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter] duration-500 ease-emphasis group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Event Documentation</Tag>
      <h3 class="mt-2 max-w-[36ch] text-subheading font-light">Santunan Anak Yatim, Srikandi &amp; Forkom</h3>
    </article>
    <article class="live-card group">
      <figure class="parallax aspect-[4/3]"><img src="./img/vid-graduation.jpg" alt="Graduation live streaming" width="1366" height="2048" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter] duration-500 ease-emphasis group-hover:grayscale-0" /></figure>
      <Tag class="mt-4">Live Streaming</Tag>
      <h3 class="mt-2 max-w-[36ch] text-subheading font-light">Wisuda, Batam</h3>
    </article>
  </div>
</section>
