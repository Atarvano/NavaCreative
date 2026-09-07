<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, lines } from '../lib/motion.js';

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
<section class="services" id="services" bind:this={section}>
  <h2 class="section-title">
    <span class="line-mask"><span class="line">What we do</span></span>
  </h2>
  <ul class="services-list" id="servicesList">
    <li class="service"><a class="service-row" href="photo-video.html" data-img="img/about-live.jpg"><span class="service-num">01</span><span class="service-name">Photo &amp; Video Documentation</span><span class="service-arrow" aria-hidden="true">→</span></a></li>
    <li class="service"><a class="service-row" href="photo-product.html" data-img="img/hero-wide.jpg"><span class="service-num">02</span><span class="service-name">Photo Product</span><span class="service-arrow" aria-hidden="true">→</span></a></li>
    <li class="service"><a class="service-row" href="graphic-design.html" data-img="img/gd-double-g.jpg"><span class="service-num">03</span><span class="service-name">Graphic Design</span><span class="service-arrow" aria-hidden="true">→</span></a></li>
    <li class="service"><a class="service-row" href="social-media.html" data-img="img/about-bts.jpg"><span class="service-num">04</span><span class="service-name">Social Media Handling</span><span class="service-arrow" aria-hidden="true">→</span></a></li>
    <li class="service"><a class="service-row" href="live-streaming.html" data-img="img/about-set.jpg"><span class="service-num">05</span><span class="service-name">Live Streaming</span><span class="service-arrow" aria-hidden="true">→</span></a></li>
  </ul>
  <div class="services-preview" id="servicesPreview" aria-hidden="true">
    <img src="./img/about-cam.jpg" alt="" width="1200" height="1500" />
  </div>
</section>
