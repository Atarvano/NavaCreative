<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, lines } from '../lib/motion.js';

  // Heading line reveal + card cascade; desktop adds the parallax scrub
  // on each frame's img (triggered off the .parallax wrapper).
  let section;
  let ctx;
  let mm;

  onMount(() => {
    ctx = motion(section, () => {
      lines(section.querySelector('.section-title'));
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
      mm = gsap.matchMedia();
      mm.add('(min-width: 769px)', () => {
        section.querySelectorAll('.parallax img').forEach((img) => {
          gsap.fromTo(
            img,
            { yPercent: -7 },
            {
              yPercent: 7,
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
  });

  onDestroy(() => {
    mm?.revert();
    ctx?.revert();
  });
</script>

<!-- Live: event records grid. -->
<section class="live" id="live" bind:this={section}>
  <h2 class="section-title">
    <span class="line-mask"><span class="line">Live &amp; documented</span></span>
  </h2>
  <div class="live-grid">
    <article class="live-card">
      <figure class="live-frame parallax"><img src="./img/vid-walimatul-ursy.jpg" alt="Walimatul Ursy of Lia and Fenda" width="1080" height="1920" loading="lazy" /></figure>
      <p class="live-meta">Live Streaming</p>
      <h3 class="live-name">Walimatul Ursy, Lia &amp; Fenda</h3>
    </article>
    <article class="live-card">
      <figure class="live-frame parallax"><img src="./img/vid-walimatul-naqiah.jpg" alt="Walimatul Naqiah ceremony" width="1600" height="2400" loading="lazy" /></figure>
      <p class="live-meta">Video Documentation</p>
      <h3 class="live-name">Walimatul Naqi'ah</h3>
    </article>
    <article class="live-card">
      <figure class="live-frame parallax"><img src="./img/vid-santunan.jpg" alt="Santunan anak yatim with Srikandi and Forkom" width="2400" height="1600" loading="lazy" /></figure>
      <p class="live-meta">Event Documentation</p>
      <h3 class="live-name">Santunan Anak Yatim, Srikandi &amp; Forkom</h3>
    </article>
    <article class="live-card">
      <figure class="live-frame parallax"><img src="./img/vid-graduation.jpg" alt="Graduation live streaming" width="1366" height="2048" loading="lazy" /></figure>
      <p class="live-meta">Live Streaming</p>
      <h3 class="live-name">Wisuda, Batam</h3>
    </article>
  </div>
</section>
