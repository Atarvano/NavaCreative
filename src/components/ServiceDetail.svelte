<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, lines, reveals } from '../lib/motion.js';

  // Statement + related Work/Live gallery + cross-links. 1:1 with the legacy
  // service pages: .live-card reuse, h2 names, lazy imgs with dimensions.
  // Motion mirrors the legacy sweep for these selectors: title line reveal,
  // lede fade-up, per-card cascade (no parallax on service pages).
  let { service, others = [] } = $props();

  let section;
  let ctx;

  onMount(() => {
    ctx = motion(section, () => {
      lines(section.querySelector('.service-title'));
      reveals(section);
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
    });
  });

  onDestroy(() => ctx?.revert());
</script>

<section class="service-detail" id="service-detail" bind:this={section}>
  <p class="eyebrow">Service</p>
  <h1 class="service-title">
    <span class="line-mask"><span class="line">{service.title}</span></span>
  </h1>
  <p class="service-lede" data-reveal>{service.lede}</p>

  <div class="service-gallery">
    {#each service.gallery as item}
      <article class="live-card">
        <figure class="live-frame"><img src={item.src} alt={item.alt} width={item.width} height={item.height} loading="lazy" /></figure>
        <p class="live-meta">{item.meta}</p>
        <h2 class="live-name">{item.name}</h2>
      </article>
    {/each}
  </div>

  <nav class="service-more" aria-label="Other services">
    <p class="service-more-head">Other services</p>
    {#each others as o}
      <a class="service-more-link" href="{o.slug}.html">{o.title}</a>
    {/each}
  </nav>
</section>
