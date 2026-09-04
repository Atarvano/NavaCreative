# Nava Creative - Landing Page

Rebuild of `navacreative.my.canva.site/homee` as a hand-coded, GSAP-animated
landing page. All content and photography scraped from the original Canva site.

## Run

```bash
npx http-server -p 4173
# open http://127.0.0.1:4173
```

Any static server works. GSAP loads from jsDelivr CDN (falls back to a static
page if blocked).

## Stack

- Vanilla HTML/CSS/JS, GSAP 3 + ScrollTrigger (CDN)
- Dark theme, single accent `#ff5757`, Space Grotesk + JetBrains Mono
- 23 scraped photos in `img/`

## Motion inventory

- Preloader with masked letter reveal
- Hero: masked line intro, image clip-path + scale reveal
- Scroll velocity-reactive marquee
- Masked line reveals on section titles, statement, CTA
- Fade-up reveals on copy blocks
- About frames: scrubbed parallax (desktop)
- Services list: cursor-following image preview (desktop)
- Work: pinned horizontal scroll with per-card containerAnimation (desktop),
  native scroll-snap carousel (mobile)
- Team: sticky-stack cards that pin and scale down (desktop), plain cards (mobile)
- Magnetic CTAs (desktop)
- All motion collapses under `prefers-reduced-motion`, and the page renders
  fully without JS (`no-js` state)

## License / content note

Photography and portfolio items belong to Nava Creative (Batam, Indonesia).
This rebuild is for the site owner's use.
