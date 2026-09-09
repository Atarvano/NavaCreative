<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, lines, drift } from '../lib/motion.js';
  import SectionTitle from '../components/ui/SectionTitle.svelte';
  import Tag from '../components/ui/Tag.svelte';

  // Editorial photo grid: all four Makers visible at once, photos dominant.
  // Title line reveal + one grid stagger on entry. No pin anywhere: the
  // Work Pin stays the single scroll-hijack on the page.
  let section;
  let ctx;

  onMount(() => {
    ctx = motion(section, () => {
      lines(section.querySelector('.section-title'));
      drift(section.querySelector('.section-title'));
      gsap.fromTo(
        section.querySelectorAll('.team-card'),
        { opacity: 0, y: 48 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: {
            trigger: section.querySelector('.team-grid'),
            start: 'top 82%',
            once: true,
          },
        }
      );
    });
  });

  onDestroy(() => ctx?.revert());
</script>

<!-- Team: the four Makers as an editorial photo grid. -->
<section id="team" bind:this={section}>
  <SectionTitle lines={['Meet the makers']} />
  <div class="team-grid grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
    <article class="team-card group block bg-mint-wash p-6">
      <figure class="aspect-[4/5] overflow-hidden"><img src="./img/team-1.jpg" alt="Portrait of Hangga" width="1080" height="1350" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter] duration-500 ease-emphasis group-hover:grayscale-0" /></figure>
      <p class="mt-4 text-caption uppercase text-graphite">01</p>
      <h3 class="mt-2 text-subheading font-light">Hangga</h3>
      <div class="mt-2 flex flex-wrap gap-2" aria-label="Skills">
        <Tag class="border-ink-black">Operator</Tag><Tag class="border-ink-black">Graphic Design</Tag><Tag class="border-ink-black">Editor</Tag>
      </div>
      <p class="mt-2 text-body-sm text-graphite">Freelance 3 years</p>
      <p class="mt-4 grid gap-2 text-body-sm"><a href="https://instagram.com/hngga_" target="_blank" rel="noopener" class="text-forest-teal">@hngga_</a><span class="text-graphite">0851-2191-5504</span></p>
    </article>
    <article class="team-card group block">
      <figure class="aspect-[4/5] overflow-hidden"><img src="./img/team-2.jpg" alt="Portrait of Zidny" width="1080" height="1350" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter] duration-500 ease-emphasis group-hover:grayscale-0" /></figure>
      <p class="mt-4 text-caption uppercase text-graphite">02</p>
      <h3 class="mt-2 text-subheading font-light">Zidny</h3>
      <div class="mt-2 flex flex-wrap gap-2" aria-label="Skills">
        <Tag>Operator</Tag><Tag>Photographer</Tag><Tag>Videographer</Tag><Tag>Editor</Tag>
      </div>
      <p class="mt-2 text-body-sm text-graphite">Freelance 3 years, 6 month internship at PT Simple Kreasi Mandiri</p>
    </article>
    <article class="team-card group block">
      <figure class="aspect-[4/5] overflow-hidden"><img src="./img/team-3.jpg" alt="Portrait of Luthfi" width="1080" height="1350" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter] duration-500 ease-emphasis group-hover:grayscale-0" /></figure>
      <p class="mt-4 text-caption uppercase text-graphite">03</p>
      <h3 class="mt-2 text-subheading font-light">Luthfi</h3>
      <div class="mt-2 flex flex-wrap gap-2" aria-label="Skills">
        <Tag>Editor</Tag><Tag>Photographer</Tag><Tag>Videographer</Tag>
      </div>
      <p class="mt-2 text-body-sm text-graphite">Freelance 3 years, 6 month internship at PT Tacita Event Organizer</p>
    </article>
    <article class="team-card group block">
      <figure class="aspect-[4/5] overflow-hidden"><img src="./img/team-4.jpg" alt="Portrait of M. Alfajrin" width="1080" height="1350" loading="lazy" class="h-full w-full object-cover grayscale transition-[filter] duration-500 ease-emphasis group-hover:grayscale-0" /></figure>
      <p class="mt-4 text-caption uppercase text-graphite">04</p>
      <h3 class="mt-2 text-subheading font-light">M. Alfajrin</h3>
      <div class="mt-2 flex flex-wrap gap-2" aria-label="Skills">
        <Tag>Videographer</Tag><Tag>Editor</Tag>
      </div>
      <p class="mt-2 text-body-sm text-graphite">Freelance 2 years</p>
    </article>
  </div>
</section>
