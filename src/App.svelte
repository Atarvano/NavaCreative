<script>
  import Nav from './sections/index/Nav.svelte';
  import Preloader from './sections/index/Preloader.svelte';
  import Hero from './sections/index/Hero.svelte';
  import Marquee from './sections/index/Marquee.svelte';
  import About from './sections/index/About.svelte';
  import Services from './sections/index/Services.svelte';
  import Work from './sections/index/Work.svelte';
  import Live from './sections/index/Live.svelte';
  import Team from './sections/index/Team.svelte';
  import Cta from './sections/index/Cta.svelte';
  import Footer from './sections/index/Footer.svelte';
  import MenuOverlay from './sections/index/MenuOverlay.svelte';
  import Cursor from './sections/index/Cursor.svelte';

  // Preloader owns the intro gate and plays the hero's paused
  // timeline when it lifts (or immediately under reduced motion).
  let menuOpen = $state(false);
  let hero;
</script>

<Nav onmenu={() => (menuOpen = true)} open={menuOpen} />
<MenuOverlay open={menuOpen} onclose={() => (menuOpen = false)} />
<Cursor />
<Preloader ondone={() => hero?.play?.()} />

<main>
  <Hero bind:this={hero} />
  <Marquee />
  <About />
  <Services />
  <Work />
  <Live />
  <Team />
  <Cta />
</main>

<Footer />
