# Nava Creative - Landing Page

Rebuild of `navacreative.my.canva.site/homee` as a Svelte 5 + Vite static
site. All content and photography scraped from the original Canva site.

## Run

```bash
npm install
npm run dev      # Vite dev server
npm run build    # host-anywhere static output in dist/
```

The pre-Svelte hand-coded pages are frozen as read-only reference in
`legacy/` (deleted at cutover, ticket 06).

## Stack

- Svelte 5 + Vite MPA, GSAP 3 + ScrollTrigger (npm)
- "Creative Giants" style system (`design.md`): canvas `#f0efe9`, Plus Jakarta Sans, Caption plates
- 29 scraped photos in `public/img/`

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
