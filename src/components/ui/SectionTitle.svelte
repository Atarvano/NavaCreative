<!-- SectionTitle: 54px light statement with masked line reveal. Replaces
     .section-title; keeps the hook class so motion.js lines() still finds it. -->
<script>
  let { lines: linesProp = [], class: cls = '', ...rest } = $props();
</script>

<h2 class={`section-title text-heading font-light ${cls}`} {...rest}>
  {#each linesProp as l}
    <span class="line-mask"><span class="line">{l}</span></span>
  {/each}
</h2>

<style>
  /* Exact legacy geometry beyond what text-heading carries */
  .section-title {
    margin-bottom: 32px;
  }
  @media (max-width: 767px) {
    .section-title {
      /* fluid scale replaces the legacy clamp, same endpoints */
      font-size: clamp(2rem, 8.5vw, 3rem);
      letter-spacing: -0.02em;
    }
  }
</style>
