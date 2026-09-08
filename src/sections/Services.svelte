<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, lines } from '../lib/motion.js';
  import SectionTitle from '../components/ui/SectionTitle.svelte';

  // Heading line reveal + row cascade; desktop adds the cursor-follow
  // preview with quickTo, cleaned up by the AbortController on breakpoint
  // revert. Preview borrows the service-row data-img swap.
  let section;
  let ctx;
  let mm;

  onMount(() => {
    ctx = motion(section, () => {
      lines(section.querySelector('.section-title'));
      gsap.fromTo(
        section.querySelectorAll('.service-row'),
        { opacity: 0, y: 36 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          stagger: 0.07,
          scrollTrigger: {
            trigger: section.querySelector('#servicesList'),
            start: 'top 82%',
            once: true,
          },
        }
      );

      mm = gsap.matchMedia();
      mm.add('(min-width: 769px)', () => {
        const ac = new AbortController();
        const preview = section.querySelector('#servicesPreview');
        const list = section.querySelector('#servicesList');
        if (preview && list) {
          const pImg = preview.querySelector('img');
          const pX = gsap.quickTo(preview, 'x', { duration: 0.5, ease: 'power3.out' });
          const pY = gsap.quickTo(preview, 'y', { duration: 0.5, ease: 'power3.out' });
          gsap.set(preview, { xPercent: -50, yPercent: -50, scale: 0.85, autoAlpha: 0 });
          list.addEventListener('pointermove', (e) => { pX(e.clientX); pY(e.clientY); }, { signal: ac.signal });
          section.querySelectorAll('.service-row').forEach((row) => {
            row.addEventListener('pointerenter', () => {
              const src = row.getAttribute('data-img');
              if (pImg.getAttribute('src') !== src) pImg.setAttribute('src', src);
              gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'power3.out' });
            }, { signal: ac.signal });
            row.addEventListener('pointerleave', () => {
              gsap.to(preview, { autoAlpha: 0, scale: 0.85, duration: 0.35, ease: 'power3.out' });
            }, { signal: ac.signal });
          });
        }
        return () => ac.abort();
      });
    });
  });

  onDestroy(() => {
    mm?.revert();
    ctx?.revert();
  });
</script>

<!-- Services: editorial index of the five Service pages. -->
<section id="services" bind:this={section}>
  <SectionTitle lines={["What we do"]} />
  <ul id="servicesList" class="border-t border-ash">
    <li class="border-b border-ash group"><a href="photo-video.html" data-img="img/about-live.jpg" class="service-row grid cursor-pointer grid-cols-[4rem_1fr_auto] items-center gap-6 px-2 py-8 transition-[padding] duration-300 ease-emphasis group-hover:px-6 max-md:grid-cols-[2.5rem_1fr_auto] max-md:gap-4 max-md:py-6"><span class="text-caption text-graphite uppercase">01</span><span class="text-heading-sm leading-[1.25] font-light max-md:text-[clamp(1.15rem,4.5vw,1.5rem)]">Photo &amp; Video Documentation</span><span aria-hidden="true" class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ash text-[14px] text-ink-black transition-all duration-200 group-hover:translate-x-[3px] group-hover:-translate-y-[3px] group-hover:border-ink-black">→</span></a></li>
    <li class="border-b border-ash group"><a href="photo-product.html" data-img="img/hero-wide.jpg" class="service-row grid cursor-pointer grid-cols-[4rem_1fr_auto] items-center gap-6 px-2 py-8 transition-[padding] duration-300 ease-emphasis group-hover:px-6 max-md:grid-cols-[2.5rem_1fr_auto] max-md:gap-4 max-md:py-6"><span class="text-caption text-graphite uppercase">02</span><span class="text-heading-sm leading-[1.25] font-light max-md:text-[clamp(1.15rem,4.5vw,1.5rem)]">Photo Product</span><span aria-hidden="true" class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ash text-[14px] text-ink-black transition-all duration-200 group-hover:translate-x-[3px] group-hover:-translate-y-[3px] group-hover:border-ink-black">→</span></a></li>
    <li class="border-b border-ash group"><a href="graphic-design.html" data-img="img/gd-double-g.jpg" class="service-row grid cursor-pointer grid-cols-[4rem_1fr_auto] items-center gap-6 px-2 py-8 transition-[padding] duration-300 ease-emphasis group-hover:px-6 max-md:grid-cols-[2.5rem_1fr_auto] max-md:gap-4 max-md:py-6"><span class="text-caption text-graphite uppercase">03</span><span class="text-heading-sm leading-[1.25] font-light max-md:text-[clamp(1.15rem,4.5vw,1.5rem)]">Graphic Design</span><span aria-hidden="true" class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ash text-[14px] text-ink-black transition-all duration-200 group-hover:translate-x-[3px] group-hover:-translate-y-[3px] group-hover:border-ink-black">→</span></a></li>
    <li class="border-b border-ash group"><a href="social-media.html" data-img="img/about-bts.jpg" class="service-row grid cursor-pointer grid-cols-[4rem_1fr_auto] items-center gap-6 px-2 py-8 transition-[padding] duration-300 ease-emphasis group-hover:px-6 max-md:grid-cols-[2.5rem_1fr_auto] max-md:gap-4 max-md:py-6"><span class="text-caption text-graphite uppercase">04</span><span class="text-heading-sm leading-[1.25] font-light max-md:text-[clamp(1.15rem,4.5vw,1.5rem)]">Social Media Handling</span><span aria-hidden="true" class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ash text-[14px] text-ink-black transition-all duration-200 group-hover:translate-x-[3px] group-hover:-translate-y-[3px] group-hover:border-ink-black">→</span></a></li>
    <li class="border-b border-ash group"><a href="live-streaming.html" data-img="img/about-set.jpg" class="service-row grid cursor-pointer grid-cols-[4rem_1fr_auto] items-center gap-6 px-2 py-8 transition-[padding] duration-300 ease-emphasis group-hover:px-6 max-md:grid-cols-[2.5rem_1fr_auto] max-md:gap-4 max-md:py-6"><span class="text-caption text-graphite uppercase">05</span><span class="text-heading-sm leading-[1.25] font-light max-md:text-[clamp(1.15rem,4.5vw,1.5rem)]">Live Streaming</span><span aria-hidden="true" class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ash text-[14px] text-ink-black transition-all duration-200 group-hover:translate-x-[3px] group-hover:-translate-y-[3px] group-hover:border-ink-black">→</span></a></li>
  </ul>
  <div id="servicesPreview" aria-hidden="true" class="pointer-events-none fixed top-0 left-0 z-30 aspect-[4/5] w-[clamp(200px,20vw,300px)] overflow-hidden border border-ash opacity-0 pointer-coarse:hidden">
    <img src="./img/about-cam.jpg" alt="" width="1200" height="1500" class="h-full w-full object-cover" />
  </div>
</section>
