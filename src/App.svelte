<script>
  import Nav from './sections/Nav.svelte';
  import Preloader from './sections/Preloader.svelte';
  import Hero from './sections/Hero.svelte';
  import Marquee from './sections/Marquee.svelte';
  import About from './sections/About.svelte';
  import Services from './sections/Services.svelte';
  import Work from './sections/Work.svelte';
  import Live from './sections/Live.svelte';
  import Team from './sections/Team.svelte';
  import Cta from './sections/Cta.svelte';
  import Footer from './sections/Footer.svelte';
  import MenuOverlay from './sections/MenuOverlay.svelte';
  import Cursor from './sections/Cursor.svelte';

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
