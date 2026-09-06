<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, lines, reveals } from '../lib/motion.js';

  // Statement line reveal + full-bleed band clip/settle + copy fade-up +
  // photo-pair rise. The band trigger fires once and drives all three
  // band tweens off the same start, exactly like legacy.
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

<!-- About: statement + full-bleed BTS band with Caption plate + copy/photo pair. 1:1 with legacy/index.html markup. -->
<section class="about" id="about" bind:this={section}>
  <p class="eyebrow">About</p>
  <h2 class="about-statement">
    <span class="line-mask"><span class="line">We are the makers</span></span>
    <span class="line-mask"><span class="line">behind the lens, the edit,</span></span>
    <span class="line-mask"><span class="line">and the moment.</span></span>
  </h2>
  <div class="about-band">
    <img src="./img/about-set.jpg" alt="Production set in progress" width="2048" height="1366" loading="lazy" />
    <div class="about-band-overlay">
      <p class="about-band-meta">Behind the scenes // Production diary</p>
      <p class="about-band-title">The makers at work.</p>
    </div>
  </div>
  <div class="about-lower">
    <p class="about-copy" data-reveal>
      Based in Batam, we handle video editing, photo and video documentation,
      photoshoots, product photography, social media handling, graphic design,
      and live streaming. Open to discussion, flexible with budgeting.
    </p>
    <div class="about-photos">
      <figure>
        <img src="./img/about-crew.jpg" alt="Nava Creative crew on location" width="2400" height="1350" loading="lazy" />
        <figcaption class="fig-cap">The crew on location.</figcaption>
      </figure>
      <figure>
        <img src="./img/about-cam.jpg" alt="Camera gear ready for a shoot" width="2400" height="1600" loading="lazy" />
        <figcaption class="fig-cap">Kit checked before the call time.</figcaption>
      </figure>
    </div>
  </div>
</section>
