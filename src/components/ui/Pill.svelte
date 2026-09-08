<!-- Pill: black pill CTA / labels. Replaces .btn + .menu-btn/.menu-close. -->
<script>
  let {
    href = null,
    onclick = null,
    variant = 'accent', // 'accent' | 'ghost' | 'light'
    size = 'md', // 'md' | 'lg' | 'menu'
    magnetic = false,
    class: cls2 = '',
    ...rest
  } = $props();

  const cls = [
    'inline-block whitespace-nowrap rounded-pill font-normal transition-[opacity,border-color] duration-200 active:scale-[0.98]',
    size === 'lg' ? 'px-10 py-[18px] text-body' : '',
    size === 'menu' ? 'px-6 py-3 text-body' : '',
    size === 'md' ? 'px-7 py-[14px] text-body-sm' : '',
    variant === 'accent' && 'bg-ink-black text-bone-white hover:opacity-85',
    variant === 'ghost' &&
      'border border-ash bg-transparent text-ink-black hover:border-ink-black',
    variant === 'light' && 'bg-bone-white text-ink-black hover:opacity-90',
    magnetic ? 'magnetic' : '',
    cls2,
  ]
    .filter(Boolean)
    .join(' ');
</script>

{#if href}
  <a {href} class={cls} {...rest}><slot /></a>
{:else}
  <button class={cls} {onclick} {...rest}><slot /></button>
{/if}
