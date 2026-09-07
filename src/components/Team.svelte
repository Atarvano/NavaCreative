<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, ScrollTrigger, motion, lines } from '../lib/motion.js';

  // Heading line reveal everywhere; desktop adds the sticky stack (each
  // card pins until the last arrives, pinSpacing false, with a scale/fade
  // as the next card covers it).
  let section;
  let ctx;
  let mm;

  onMount(() => {
    ctx = motion(section, () => {
      lines(section.querySelector('.section-title'));
      mm = gsap.matchMedia();
      mm.add('(min-width: 769px)', () => {
        const cards = gsap.utils.toArray(section.querySelectorAll('.team-card'));
        if (!cards.length) return;
        const last = cards[cards.length - 1];
        cards.forEach((card, i) => {
          if (i === cards.length - 1) return;
          ScrollTrigger.create({
            trigger: card,
            start: 'top top',
            endTrigger: last,
            end: 'top top',
            pin: true,
            pinSpacing: false,
          });
          gsap.to(card, {
            scale: 0.94,
            opacity: 0.55,
            ease: 'none',
            scrollTrigger: {
              trigger: cards[i + 1],
              start: 'top bottom',
              end: 'top top',
              scrub: true,
            },
          });
        });
      });
    });
  });

  onDestroy(() => {
    mm?.revert();
    ctx?.revert();
  });
</script>

<!-- Team: the four Makers. -->
<section class="team" id="team" bind:this={section}>
  <h2 class="section-title team-title">
    <span class="line-mask"><span class="line">Meet the makers</span></span>
  </h2>
  <div class="team-stack" id="teamStack">
    <article class="team-card team-card--accent">
      <div class="team-photo"><img src="./img/team-1.jpg" alt="Portrait of Hangga" width="1080" height="1350" loading="lazy" /></div>
      <div class="team-info">
        <p class="team-index">01</p>
        <h3 class="team-name">Hangga</h3>
        <ul class="team-tags" aria-label="Skills">
          <li>Operator</li><li>Graphic Design</li><li>Editor</li>
        </ul>
        <p class="team-exp">Freelance 3 years</p>
        <p class="team-links"><a href="https://instagram.com/hngga_" target="_blank" rel="noopener">@hngga_</a><span>0851-2191-5504</span></p>
      </div>
    </article>
    <article class="team-card team-card--flip">
      <div class="team-photo"><img src="./img/team-2.jpg" alt="Portrait of Zidny" width="1080" height="1350" loading="lazy" /></div>
      <div class="team-info">
        <p class="team-index">02</p>
        <h3 class="team-name">Zidny</h3>
        <ul class="team-tags" aria-label="Skills">
          <li>Operator</li><li>Photographer</li><li>Videographer</li><li>Editor</li>
        </ul>
        <p class="team-exp">Freelance 3 years, 6 month internship at PT Simple Kreasi Mandiri</p>
      </div>
    </article>
    <article class="team-card">
      <div class="team-photo"><img src="./img/team-3.jpg" alt="Portrait of Luthfi" width="1080" height="1350" loading="lazy" /></div>
      <div class="team-info">
        <p class="team-index">03</p>
        <h3 class="team-name">Luthfi</h3>
        <ul class="team-tags" aria-label="Skills">
          <li>Editor</li><li>Photographer</li><li>Videographer</li>
        </ul>
        <p class="team-exp">Freelance 3 years, 6 month internship at PT Tacita Event Organizer</p>
      </div>
    </article>
    <article class="team-card team-card--flip">
      <div class="team-photo"><img src="./img/team-4.jpg" alt="Portrait of M. Alfajrin" width="1080" height="1350" loading="lazy" /></div>
      <div class="team-info">
        <p class="team-index">04</p>
        <h3 class="team-name">M. Alfajrin</h3>
        <ul class="team-tags" aria-label="Skills">
          <li>Videographer</li><li>Editor</li>
        </ul>
        <p class="team-exp">Freelance 2 years</p>
      </div>
    </article>
  </div>
</section>
