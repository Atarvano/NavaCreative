<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, lines, reveals } from '../lib/motion.js';
  import Tag from '../components/ui/Tag.svelte';

  // Statement + related Work/Live gallery + cross-links (.live-card reuse,
  // h2 names, lazy imgs with dimensions). Title line reveal, lede fade-up,
  // per-card cascade (no parallax on service pages).
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

<section class="pt-[calc(var(--nav-h)_+_64px)]" id="service-detail" bind:this={section}>
  <p class="mb-12 text-caption text-graphite uppercase">Service</p>
  <h1 class="service-title mb-8 text-[clamp(2.75rem,8vw,84px)] leading-none font-light tracking-[-0.04em]">
    <span class="line-mask"><span class="line">{service.title}</span></span>
  </h1>
  <p class="service-lede mb-16 max-w-[34ch] text-subheading font-light text-graphite" data-reveal>{service.lede}</p>

  <div class="grid grid-cols-3 gap-x-12 gap-y-16 max-md:grid-cols-1 max-md:gap-12">
    {#each service.gallery as item}
      <article class="live-card group">
        <figure class="aspect-[4/3] overflow-hidden"><img src={item.src} alt={item.alt} width={item.width} height={item.height} loading="lazy" class="h-full w-full object-cover grayscale transition-[filter] duration-500 ease-emphasis group-hover:grayscale-0" /></figure>
        <Tag class="mt-4">{item.meta}</Tag>
        <h2 class="mt-2 max-w-[36ch] text-subheading font-light">{item.name}</h2>
      </article>
    {/each}
  </div>

  <nav class="mt-16 flex flex-wrap items-center gap-4 border-t border-ash pt-8" aria-label="Other services">
    <p class="w-full text-caption text-graphite uppercase">Other services</p>
    {#each others as o}
      <a class="rounded-pill border border-ash px-4 py-2 text-body-sm transition-[border-color] duration-200 hover:border-ink-black" href="{o.slug}.html">{o.title}</a>
    {/each}
  </nav>
</section>
