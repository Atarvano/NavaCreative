// Service-page catalogue (ticket 05). Verbatim port of the legacy flat pages:
// titles, ledes, gallery items (existing img/ only, placeholder reuse
// included), and per-page og meta. Cross-links derive from `slug`.
export const SERVICES = [
  {
    slug: 'photo-video',
    title: 'Photo & Video Documentation',
    lede: 'Photo and video documentation for prewedding, stage, ceremony, and event work — shot and edited in Batam, flexible with budgeting.',
    description:
      'Photo and video work by Nava Creative, Batam: prewedding, stage photography, photoshoots, and video documentation.',
    ogDescription: 'Prewedding, stage, and photoshoot work by Nava Creative, Batam.',
    ogImage: 'img/pv-ihsan-ochi.jpg',
    gallery: [
      { src: 'img/pv-ihsan-ochi.jpg', alt: 'Prewedding portrait of Ihsan and Ochi', width: 1200, height: 1800, meta: 'Photo Prewedding', name: 'Ihsan & Ochi' },
      { src: 'img/pv-banda-neira.jpg', alt: 'Banda Neira on stage', width: 1080, height: 1350, meta: 'Stage Photography', name: 'Banda Neira' },
      { src: 'img/pv-stage.jpg', alt: 'Stage performance photography', width: 1600, height: 2400, meta: 'Stage Photography', name: 'Rissau' },
      { src: 'img/pv-tsenja.jpg', alt: 'Tsenja photoshoot', width: 1600, height: 2400, meta: 'Photoshoot', name: 'Tsenja' },
      { src: 'img/pv-ceremony.jpg', alt: 'Ceremony photography', width: 1200, height: 1800, meta: 'Photo & Video', name: 'Titik Ngopi' },
      { src: 'img/vid-walimatul-ursy.jpg', alt: 'Walimatul Ursy of Lia and Fenda', width: 1080, height: 1920, meta: 'Video Documentation', name: 'Walimatul Ursy, Lia & Fenda' },
      { src: 'img/vid-walimatul-naqiah.jpg', alt: 'Walimatul Naqiah ceremony', width: 1600, height: 2400, meta: 'Video Documentation', name: "Walimatul Naqi'ah" },
      { src: 'img/vid-graduation.jpg', alt: 'Graduation live streaming', width: 1366, height: 2048, meta: 'Live Streaming', name: 'Wisuda, Batam' },
    ],
  },
  {
    slug: 'photo-product',
    title: 'Photo Product',
    lede: 'Clean, consistent product photography for catalogs, marketplaces, and social. Shot in Batam, open to discussion on budget.',
    description:
      'Photo and video work by Nava Creative, Batam: prewedding, stage photography, photoshoots, and video documentation.',
    ogDescription: 'Product photography by Nava Creative, Batam.',
    ogImage: 'img/hero-wide.jpg',
    gallery: [
      { src: 'img/hero-wide.jpg', alt: 'Product photography setup', width: 1920, height: 1080, meta: 'Product', name: 'Studio product frame' },
      { src: 'img/work-misc-1.jpg', alt: 'Recent production still', width: 1080, height: 1350, meta: 'Product', name: 'Catalog frame, muted set' },
      { src: 'img/work-misc-2.jpg', alt: 'Recent production still', width: 1080, height: 1350, meta: 'Product', name: 'Catalog frame, warm set' },
      { src: 'img/work-misc-3.jpg', alt: 'Recent production still', width: 1080, height: 1350, meta: 'Product', name: 'Catalog frame, close crop' },
      { src: 'img/about-cam.jpg', alt: 'Camera gear ready for a shoot', width: 2400, height: 1600, meta: 'Behind the scenes', name: 'Kit checked before the call time' },
    ],
  },
  {
    slug: 'graphic-design',
    title: 'Graphic Design',
    lede: 'Posters, feeds, and brand collateral designed to hold together across print and social. Based in Batam.',
    description:
      'Photo and video work by Nava Creative, Batam: prewedding, stage photography, photoshoots, and video documentation.',
    ogDescription: 'Graphic design work by Nava Creative, Batam.',
    ogImage: 'img/gd-double-g.jpg',
    gallery: [
      { src: 'img/gd-double-g.jpg', alt: 'Graphic design work for Double G', width: 1599, height: 2399, meta: 'Graphic Design', name: 'Double G' },
      { src: 'img/about-bts.jpg', alt: 'Behind the scenes during a production', width: 2399, height: 1756, meta: 'Behind the scenes', name: 'Layout pass on set' },
      { src: 'img/about-set.jpg', alt: 'Production set in progress', width: 2048, height: 1366, meta: 'Behind the scenes', name: "Reviewing the day's frames" },
    ],
  },
  {
    slug: 'social-media',
    title: 'Social Media Handling',
    lede: 'Content planning, shooting, and posting handled end to end — so the feed keeps moving without you managing it.',
    description:
      'Photo and video work by Nava Creative, Batam: prewedding, stage photography, photoshoots, and video documentation.',
    ogDescription: 'Social media handling by Nava Creative, Batam.',
    ogImage: 'img/about-bts.jpg',
    gallery: [
      { src: 'img/about-bts.jpg', alt: 'Behind the scenes during a production', width: 2399, height: 1756, meta: 'Behind the scenes', name: 'Shooting for the feed' },
      { src: 'img/about-live.jpg', alt: 'Live production in progress', width: 2400, height: 1600, meta: 'Behind the scenes', name: 'Capture day' },
      { src: 'img/about-crew.jpg', alt: 'Nava Creative crew on location', width: 2400, height: 1350, meta: 'Behind the scenes', name: 'Crew on location' },
      { src: 'img/about-cam.jpg', alt: 'Camera gear ready for a shoot', width: 2400, height: 1600, meta: 'Behind the scenes', name: 'Kit before the call time' },
    ],
  },
  {
    slug: 'live-streaming',
    title: 'Live Streaming',
    lede: 'Multi-camera live streaming for ceremonies, graduations, and events — recorded and delivered alongside the stream.',
    description:
      'Photo and video work by Nava Creative, Batam: prewedding, stage photography, photoshoots, and video documentation.',
    ogDescription: 'Live streaming and event documentation by Nava Creative, Batam.',
    ogImage: 'img/vid-graduation.jpg',
    gallery: [
      { src: 'img/vid-graduation.jpg', alt: 'Graduation live streaming', width: 1366, height: 2048, meta: 'Live Streaming', name: 'Wisuda, Batam' },
      { src: 'img/vid-walimatul-ursy.jpg', alt: 'Walimatul Ursy of Lia and Fenda', width: 1080, height: 1920, meta: 'Live Streaming', name: 'Walimatul Ursy, Lia & Fenda' },
      { src: 'img/vid-walimatul-naqiah.jpg', alt: 'Walimatul Naqiah ceremony', width: 1600, height: 2400, meta: 'Live Streaming', name: "Walimatul Naqi'ah" },
      { src: 'img/vid-livestream.jpg', alt: 'Live streaming setup during an event', width: 2400, height: 1600, meta: 'Live Streaming', name: 'On air' },
      { src: 'img/about-live.jpg', alt: 'Live production in progress', width: 2400, height: 1600, meta: 'Behind the scenes', name: 'Behind the switcher' },
    ],
  },
];
