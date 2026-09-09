<script>
  import { onMount, onDestroy } from 'svelte';
  import { gsap, motion, magnetic } from '../lib/motion.js';
  import Pill from '../components/ui/Pill.svelte';

  // Pinned scrollytelling stage: the hero photo holds for two extra
  // viewports while three caption beats swap per scroll step with a dot
  // indicator, then releases into the marquee. The paused intro timeline
  // IS beat one (not stacked beside it): the preloader plays it via
  // play(), beats only ever move on scrub with snap settling whole beats.
  // Static-first markup: beats stack readably until JS adds .is-staged
  // inside motion(), so reduced-motion / no-JS visitors get every beat
  // with no pin. Beat copy reuses verbatim on-page lines (plate, About
  // statement, hero sub) — no new copy. Magnetic CTAs are desktop-only.
  let section;
  let stage;
  let intro;
  let ctx;
  let mm;

  const BEATS = 3;

  export function play() {
    intro?.play();
  }

  onMount(() => {
    ctx = motion(section, () => {
      intro = gsap.timeline({ paused: true });
      intro
        .fromTo(
          section.querySelectorAll('.hero-title .line'),
          { yPercent: 115 },
          { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.09 },
          0
        )
        .fromTo(
          section.querySelector('.hero-frame img'),
          { scale: 1.18 },
          { scale: 1, duration: 1.6, ease: 'expo.out' },
          0.1
        )
        .fromTo(
          section.querySelector('.hero-frame'),
          { clipPath: 'inset(0% 0% 100% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out' },
          0.15
        )
        .fromTo(
          section.querySelectorAll('.hero-side > *'),
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 },
          0.7
        );

      // Stage: beat one is the loaded state (shown by the intro above);
      // beats two/three rest hidden until the scrub swaps them in.
      // Opacity-only (never visibility) keeps every beat in natural DOM
      // order for assistive tech; plates hold no focusables, so nothing
      // tabs into a hidden beat. One viewport of scroll per beat with
      // snap stops exactly on the whole-beat rests (0, 0.5, 1).
      stage.classList.add('is-staged');
      const beats = stage.querySelectorAll('.hero-beat');
      const dots = stage.querySelectorAll('.hero-dot');
      const show = (i) =>
        dots.forEach((d, j) => d.classList.toggle('is-active', i === j));
      gsap.set(beats[0], { opacity: 1, y: 0 });
      gsap.set([beats[1], beats[2]], { opacity: 0, y: 24 });
      show(0);

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: stage,
          start: 'top top',
          end: () => '+=' + window.innerHeight * 2,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          snap: {
            snapTo: [0, 1 / (BEATS - 1), 1],
            duration: { min: 0.15, max: 0.4 },
            ease: 'power1.inOut',
          },
          onUpdate: (self) =>
            show(
              Math.min(BEATS - 1, Math.round(self.progress * (BEATS - 1)))
            ),
        },
      });
      // Beats rest hidden until their swap: fromTo with immediateRender
      // false owns each beat's hidden state on the timeline itself, so a
      // scrubbed-back playhead can never strand two beats visible. Each
      // swap is centred on its half of the scroll, so the rests sit whole
      // at 0 / 0.5 / 1 — exactly where snap stops.
      const swap = (out, inn, at) => {
        tl.to(out, { opacity: 0, y: -24, duration: 0.2, ease: 'none' }, at);
        tl.fromTo(
          inn,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.2, ease: 'none', immediateRender: false },
          at + 0.15
        );
      };
      swap(beats[0], beats[1], 0.15);
      swap(beats[1], beats[2], 0.65);

      mm = gsap.matchMedia();
      mm.add('(min-width: 769px)', () => {
        const ac = new AbortController();
        section
          .querySelectorAll('.magnetic')
          .forEach((btn) => magnetic(btn, ac.signal));
        return () => ac.abort();
      });
    });
  });

  onDestroy(() => {
    mm?.revert();
    ctx?.revert();
  });
</script>

<!-- Hero: editorial manifesto + pinned photo stage with caption beats. -->
<section id="home" bind:this={section} class="pb-12">
  <div class="pt-[calc(var(--nav-h)_+_64px)] max-md:pt-[calc(var(--nav-h)_+_24px)]">
    <h1 class="hero-title mb-12 text-[clamp(2.75rem,8.4vw,84px)] leading-none font-light tracking-[-0.04em] max-md:text-[clamp(2.1rem,9.5vw,4rem)]">
      <span class="line-mask"><span class="line">Crafting Moments,</span></span>
      <span class="line-mask"><span class="line">Creating Impact.</span></span>
    </h1>
  </div>
  <div class="hero-side mb-16 flex items-end justify-between gap-8 max-md:flex-col max-md:items-start">
    <p class="max-w-[30rem] text-subheading text-graphite">A creative entity bringing fresh, solution-oriented ideas to today's visual and communication needs.</p>
    <div class="flex flex-wrap gap-2">
      <Pill href="https://wa.me/6285817999140" target="_blank" rel="noopener" magnetic>Start a Project</Pill>
      <Pill href="#work" variant="ghost" magnetic>See Work</Pill>
    </div>
  </div>
  <div class="hero-stage relative mx-[calc(var(--pad)*-1)]" bind:this={stage}>
    <div class="hero-frame h-[72vh] min-h-[380px] w-full max-md:h-[52vh]">
      <img src="./img/hero-main.jpg" alt="Nava Creative photographer on set" width="1800" height="2400" fetchpriority="high" class="h-full w-full object-cover" />
    </div>
    <ol class="hero-beats mt-4 grid list-none gap-4 px-(--pad)">
      <li class="hero-beat block w-fit max-w-[min(560px,80%)] bg-bone-white px-6 py-4 text-ink-black">
        <p class="mb-2 text-caption text-graphite uppercase">Nava Creative Studio // Batam</p>
        <p class="text-heading-sm leading-[1.25] font-light">On set with the crew.</p>
      </li>
      <li class="hero-beat block w-fit max-w-[min(560px,80%)] bg-bone-white px-6 py-4 text-ink-black">
        <p class="mb-2 text-caption text-graphite uppercase">The makers // Behind the lens</p>
        <p class="text-heading-sm leading-[1.25] font-light">The edit, and the moment.</p>
      </li>
      <li class="hero-beat block w-fit max-w-[min(560px,80%)] bg-bone-white px-6 py-4 text-ink-black">
        <p class="mb-2 text-caption text-graphite uppercase">Crafting Moments // Creating Impact</p>
        <p class="text-heading-sm leading-[1.25] font-light">Fresh, solution-oriented ideas.</p>
      </li>
    </ol>
    <div class="hero-steps" aria-hidden="true">
      <span class="hero-dot is-active"></span><span class="hero-dot"></span><span class="hero-dot"></span>
    </div>
  </div>
</section>

<style>
  /* Static path (no-JS / reduced motion): beats stay stacked in flow and
     the indicator stays hidden. .is-staged (added only inside motion())
     pins the frame viewport-tall and overlays the beats + dots on it. */
  .hero-steps {
    display: none;
  }
  .hero-dot {
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: rgb(255 254 247 / 0.45);
  }
  .hero-dot.is-active {
    background: #fffef7;
  }
  .is-staged .hero-frame {
    height: 100svh;
    min-height: 0;
  }
  .is-staged .hero-beats {
    display: block;
    margin: 0;
    padding: 0;
  }
  .is-staged .hero-beat {
    position: absolute;
    bottom: 3rem;
    left: 2rem;
    z-index: 1;
    margin: 0;
  }
  .is-staged .hero-steps {
    position: absolute;
    right: 2rem;
    bottom: 3rem;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  @media (max-width: 767px) {
    .is-staged .hero-beat {
      bottom: 1rem;
      left: 1rem;
      max-width: min(560px, 72%);
    }
    .is-staged .hero-steps {
      top: calc(var(--nav-h) + 1rem);
      right: 1rem;
      bottom: auto;
    }
  }
</style>
