<!-- Tag: small uppercase pill label. Replaces .live-meta (ticket 02);
     Work/Team/ServiceDetail equivalents migrate in tickets 03-05. -->
<script>
  let { class: cls = '', children, ...rest } = $props();
</script>

<span
  class={`inline-block rounded-pill border border-ash px-3 py-2 text-caption uppercase text-ink-black ${cls}`}
  {...rest}>{@render children()}</span
>
