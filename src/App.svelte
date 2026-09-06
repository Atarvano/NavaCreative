<script>
  import Nav from './components/Nav.svelte';
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

  // Ticket 03: Work lands with its desktop pin + card motion. Remaining
  // page animation (preloader, reveals, marquee, team stack) is ticket 04.
  let menuOpen = $state(false);
</script>

<Nav onmenu={() => (menuOpen = true)} open={menuOpen} />
<MenuOverlay open={menuOpen} onclose={() => (menuOpen = false)} />

<main>
  <Hero />
  <Marquee />
  <About />
  <Services />
  <Work />
  <Live />
  <Team />
  <Cta />
</main>

<Footer />
