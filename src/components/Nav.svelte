<!-- Nav: editorial lockup + inline links + mobile Menu pill. Plain onclick here, no GSAP — the hide-on-scroll + menu timeline land in ticket 04. 1:1 with legacy/index.html markup. -->
<script>
  let { onmenu, open = false } = $props();
</script>

<header class="nav" id="nav">
  <a class="nav-lockup" href="#home">
    <span class="nav-mark" aria-hidden="true"></span>
    <span class="nav-eyebrow">Nava Creative //<br />Photo &amp; Video Studio</span>
  </a>
  <nav class="nav-links" aria-label="Primary">
    <a href="#about">About</a>
    <a href="#services">Services</a>
    <a href="#work">Work</a>
    <a href="#live">Live</a>
    <a href="#team">Team</a>
    <a href="#contact">Contact</a>
  </nav>
  <button class="menu-btn" id="menuBtn" aria-expanded={String(open)} aria-controls="menuOverlay" onclick={() => onmenu?.()}>Menu</button>
</header>
