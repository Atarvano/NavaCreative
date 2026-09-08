<!-- Tag: small uppercase pill label. Replaces .team-tag/.work-meta/.live-meta/.service-more-link. -->
<script>
  let { class: cls = '', ...rest } = $props();
</script>

<span
  class={`inline-block rounded-pill border border-ash px-3 py-2 text-caption uppercase text-ink-black ${cls}`}
  {...rest}><slot /></span
>
