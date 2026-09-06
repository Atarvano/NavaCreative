<script>
  import Nav from './components/Nav.svelte';
  import Hero from './components/Hero.svelte';
  import Marquee from './components/Marquee.svelte';
  import About from './components/About.svelte';
  import Services from './components/Services.svelte';
  import Live from './components/Live.svelte';
  import Team from './components/Team.svelte';
  import Cta from './components/Cta.svelte';
  import Footer from './components/Footer.svelte';
  import MenuOverlay from './components/MenuOverlay.svelte';

  // Ticket 02: all pilot sections except Work render statically, 1:1 with
  // legacy/index.html. The Work section lands in ticket 03, the Preloader +
  // all animation in ticket 04. Menu overlay is a plain class toggle here.
  let menuOpen = $state(false);
</script>

<Nav onmenu={() => (menuOpen = true)} open={menuOpen} />
<MenuOverlay open={menuOpen} onclose={() => (menuOpen = false)} />

<main>
  <Hero />
  <Marquee />
  <About />
  <Services />
  <Live />
  <Team />
  <Cta />
</main>

<Footer />
