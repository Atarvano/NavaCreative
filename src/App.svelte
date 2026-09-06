<script>
  import Nav from './components/Nav.svelte';
  import Preloader from './components/Preloader.svelte';
  import Hero from './components/Hero.svelte';
  import Marquee from './components/Marquee.svelte';
  import About from './components/About.svelte';
  import Services from './components/Services.svelte';
  import Work from './components/Work.svelte';
  import Live from './components/Live.svelte';
  import Team from './components/Team.svelte';
  import Cta from './components/Cta.svelte';
  import Footer from './components/Footer.svelte';
  import MenuOverlay from './components/MenuOverlay.svelte';

  // Ticket 04: preloader owns the intro gate and plays the hero's paused
  // timeline when it lifts (or immediately under reduced motion).
  let menuOpen = $state(false);
  let hero;
</script>

<Nav onmenu={() => (menuOpen = true)} open={menuOpen} />
<MenuOverlay open={menuOpen} onclose={() => (menuOpen = false)} />
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
