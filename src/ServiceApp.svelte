<script>
  import Backbar from './components/Backbar.svelte';
  import ServiceDetail from './components/ServiceDetail.svelte';
  import Cta from './components/Cta.svelte';
  import Footer from './components/Footer.svelte';
  import { SERVICES } from './lib/services.js';

  // One app for all five service pages; the entry HTML picks the page via
  // <div id="app" data-service="photo-video">. Back bar + detail gallery +
  // shared CTA strip and Footer (index-form anchors via base).
  let { slug } = $props();

  const service = SERVICES.find((s) => s.slug === slug);
  const others = SERVICES.filter((s) => s.slug !== slug);
</script>

<Backbar />

<main>
  <ServiceDetail {service} {others} />
  <Cta />
</main>

<Footer base="index.html" />
