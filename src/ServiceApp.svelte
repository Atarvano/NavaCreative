<script>
  import Backbar from './sections/Backbar.svelte';
  import ServiceDetail from './sections/ServiceDetail.svelte';
  import Footer from './sections/Footer.svelte';
  import { SERVICES } from './lib/services.js';

  // One app for all five service pages; the entry HTML picks the page via
  // <div id="app" data-service="photo-video">. Back bar + detail gallery +
  // Footer (index-form anchors via base). No Cta: detail flows straight
  // into the footer; the strip stays on the index page only.
  let { slug } = $props();

  const service = SERVICES.find((s) => s.slug === slug);
  const others = SERVICES.filter((s) => s.slug !== slug);
</script>

<Backbar />

<main>
  <ServiceDetail {service} {others} />
</main>

<Footer base="index.html" />
