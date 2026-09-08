<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, lines, reveals } from '../lib/motion.js';

  // Statement line reveal + full-bleed band clip/settle + copy fade-up +
  // photo-pair rise. The band trigger fires once and drives all three
  // band tweens off the same start.
  let section;
  let ctx;

  onMount(() => {
    ctx = motion(section, () => {
      lines(section.querySelector('.about-statement'));
      reveals(section);
      const band = section.querySelector('.about-band');
      gsap.fromTo(
        band,
        { clipPath: 'inset(0% 0% 100% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 1.2,
          ease: 'expo.out',
          scrollTrigger: { trigger: band, start: 'top 80%', once: true },
        }
      );
      gsap.fromTo(
        band.querySelector('img'),
        { scale: 1.15 },
        {
          scale: 1,
          duration: 1.6,
          ease: 'expo.out',
          scrollTrigger: { trigger: band, start: 'top 80%', once: true },
        }
      );
      gsap.fromTo(
        section.querySelectorAll('.about-band-overlay > *'),
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          stagger: 0.1,
          delay: 0.5,
          scrollTrigger: { trigger: band, start: 'top 80%', once: true },
        }
      );
      section.querySelectorAll('.about-photos figure').forEach((fig, i) => {
        gsap.fromTo(
          fig,
          { opacity: 0, y: 48 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: 'power3.out',
            delay: i * 0.12,
            scrollTrigger: { trigger: fig, start: 'top 88%', once: true },
          }
        );
      });
    });
  });

  onDestroy(() => ctx?.revert());
</script>

<!-- About: statement + full-bleed BTS band with Caption plate + copy/photo pair. -->
<section id="about" bind:this={section}>
  <p class="mb-12 text-caption text-graphite uppercase">About</p>
  <h2 class="about-statement mb-16 max-w-[26ch] text-heading-sm leading-[1.25] font-light">
    <span class="line-mask"><span class="line">We are the makers</span></span>
    <span class="line-mask"><span class="line">behind the lens, the edit,</span></span>
    <span class="line-mask"><span class="line">and the moment.</span></span>
  </h2>
  <div class="about-band relative mx-[calc(var(--pad)*-1)] overflow-hidden">
    <img src="./img/about-set.jpg" alt="Production set in progress" width="2048" height="1366" loading="lazy" class="h-[56vh] min-h-[320px] w-full object-cover" />
    <div class="about-band-overlay absolute bottom-12 left-8 z-1 block w-fit max-w-[min(560px,80%)] bg-bone-white px-6 py-4 text-ink-black max-md:bottom-4 max-md:left-4">
      <p class="mb-2 text-caption text-graphite uppercase">Behind the scenes // Production diary</p>
      <p class="text-heading-sm leading-[1.25] font-light">The makers at work.</p>
    </div>
  </div>
  <div class="mt-16 grid grid-cols-[5fr_7fr] items-start gap-16 max-md:mt-12 max-md:grid-cols-1 max-md:gap-12">
    <p data-reveal class="max-w-[30ch] text-subheading font-light text-graphite sticky top-[calc(var(--nav-h)_+_32px)] max-md:static max-md:max-w-none">
      Based in Batam, we handle video editing, photo and video documentation,
      photoshoots, product photography, social media handling, graphic design,
      and live streaming. Open to discussion, flexible with budgeting.
    </p>
    <div class="about-photos grid grid-cols-2 items-start gap-6">
      <figure>
        <img src="./img/about-crew.jpg" alt="Nava Creative crew on location" width="2400" height="1350" loading="lazy" class="aspect-[4/5] w-full object-cover" />
        <figcaption class="mt-2 text-caption text-graphite">The crew on location.</figcaption>
      </figure>
      <figure class="mt-16 max-md:mt-8">
        <img src="./img/about-cam.jpg" alt="Camera gear ready for a shoot" width="2400" height="1600" loading="lazy" class="aspect-[3/4] w-full object-cover" />
        <figcaption class="mt-2 text-caption text-graphite">Kit checked before the call time.</figcaption>
      </figure>
    </div>
  </div>
</section>
