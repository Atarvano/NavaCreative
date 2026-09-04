/* NAVA CREATIVE - GSAP animation layer
   Modules: preloader, hero intro, nav, line reveals, fade-ups, marquee,
   services cursor preview, horizontal work pin, team sticky stack, magnetic.
   Motion gated by prefers-reduced-motion (early return). No window scroll
   listeners; everything runs through ScrollTrigger. */

(function () {
  "use strict";

  var body = document.body;
  var noGsap = typeof gsap === "undefined";
  var reduced = !noGsap && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (noGsap) body.classList.add("no-js");
  else if (!reduced) body.classList.remove("no-js");

  var nav = document.getElementById("nav");
  var overlay = document.getElementById("menuOverlay");
  var menuBtn = document.getElementById("menuBtn");
  var menuClose = document.getElementById("menuClose");
  var menuOpen = false;

  /* Menu: plain class toggle for reduced-motion / no-JS visitors */
  function setMenu(open) {
    menuOpen = open;
    overlay.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    overlay.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("menu-locked", open);
  }
  if (noGsap || reduced) {
    menuBtn.addEventListener("click", function () { setMenu(!menuOpen); });
    menuClose.addEventListener("click", function () { setMenu(false); });
    overlay.querySelectorAll(".menu-link").forEach(function (l) {
      l.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuOpen) setMenu(false);
    });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  // Late font swap changes text metrics -> stale pin-spacer heights -> sections overlap.
  // Refresh once fonts are final.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }

  /* Full-screen menu: clip reveal, links cascade, close reverses */
  var menuTl = gsap.timeline({ paused: true });
  menuTl
    .set(overlay, { visibility: "visible" })
    .to(overlay, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.7, ease: "expo.inOut" })
    .fromTo(
      overlay.querySelectorAll(".menu-link .menu-line"),
      { yPercent: 115 },
      { yPercent: 0, duration: 0.8, ease: "expo.out", stagger: 0.06, immediateRender: false },
      "-=0.25"
    )
    .fromTo(
      ".menu-meta a",
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.06 },
      "-=0.4"
    );

  function openMenu() {
    setMenu(true);
    nav.classList.remove("nav--hidden");
    menuTl.timeScale(1).play();
  }
  function closeMenu() {
    setMenu(false);
    menuTl.timeScale(1.6).reverse();
  }
  menuBtn.addEventListener("click", openMenu);
  menuClose.addEventListener("click", closeMenu);
  overlay.querySelectorAll(".menu-link").forEach(function (l) {
    l.addEventListener("click", closeMenu);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menuOpen) closeMenu();
  });

  /* Nav: hide on scroll down (never while the menu is open) */
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: function (self) {
      if (menuOpen) return;
      nav.classList.toggle(
        "nav--hidden",
        self.direction === 1 && self.scroll() > 160
      );
    },
  });

  /* Fade-up reveals */
  gsap.utils.toArray("[data-reveal]").forEach(function (el) {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });

  /* Marquee: constant drift, speed reacts to scroll velocity */
  var track = document.getElementById("marqueeTrack");
  if (track) {
    var base = track.innerHTML;
    track.innerHTML = base + base + base + base;
    var marqueeTween = gsap.to(track, {
      xPercent: -50,
      ease: "none",
      duration: 30,
      repeat: -1,
    });
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: function (self) {
        var v = gsap.utils.clamp(0, 3, Math.abs(self.getVelocity()) / 900);
        gsap.to(marqueeTween, { timeScale: 1 + v, duration: 0.4, overwrite: true });
      },
    });
  }

  /* Hero intro timeline */
  var heroTl = gsap.timeline({ paused: true });
  heroTl
    .to(".hero-title .line", { y: 0, duration: 1.25, ease: "expo.out", stagger: 0.09 }, 0)
    .fromTo(".hero-frame img", { scale: 1.18 }, { scale: 1, duration: 1.6, ease: "expo.out" }, 0.1)
    .to(".hero-frame", { clipPath: "inset(0% 0% 0% 0%)", duration: 1.2, ease: "expo.out" }, 0.15)
    .to(".hero-side > *", { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.1 }, 0.7);

  /* Preloader */
  var preloader = document.getElementById("preloader");
  if (preloader) {
    var plTl = gsap.timeline();
    plTl
      .fromTo(
        ".preloader-letter",
        { yPercent: 115 },
        { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.07, delay: 0.15 }
      )
      .to(".preloader-letter", { yPercent: -110, duration: 0.7, ease: "expo.in", stagger: 0.05 }, "+=0.2")
      .to(preloader, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "-=0.35")
      .add(function () {
        preloader.style.display = "none";
        heroTl.play();
        ScrollTrigger.refresh();
      }, "-=0.45");
    // Failsafe: never hold the page hostage
    setTimeout(function () {
      if (preloader.style.display !== "none") plTl.progress(1);
    }, 4000);
  } else {
    heroTl.play();
  }

  /* Masked line reveals on scroll.
     Triggers living inside the pinned .work section must declare pinnedContainer,
     or the pin-spacer offset breaks their start math and they clash with the
     section above. */
  gsap.utils
    .toArray(".section-title, .about-statement, .cta-title, .footer-word")
    .forEach(function (heading) {
      gsap.to(heading.querySelectorAll(".line"), {
        y: 0,
        duration: 1.15,
        ease: "expo.out",
        stagger: 0.09,
        scrollTrigger: {
          trigger: heading,
          start: "top 85%",
          once: true,
          pinnedContainer: heading.closest(".work") || null,
        },
      });
    });

  /* About: full-bleed band - clip reveal + slow scale settle */
  var band = document.querySelector(".about-band");
  if (band) {
    gsap.fromTo(
      band,
      { clipPath: "inset(0% 0% 100% 0%)" },
      {
        clipPath: "inset(0% 0% 0% 0%)",
        duration: 1.2,
        ease: "expo.out",
        scrollTrigger: { trigger: band, start: "top 80%", once: true },
      }
    );
    gsap.fromTo(
      band.querySelector("img"),
      { scale: 1.15 },
      {
        scale: 1,
        duration: 1.6,
        ease: "expo.out",
        scrollTrigger: { trigger: band, start: "top 80%", once: true },
      }
    );
    gsap.fromTo(
      ".about-band-overlay > *",
      { opacity: 0, y: 18 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.1,
        delay: 0.5,
        scrollTrigger: { trigger: band, start: "top 80%", once: true },
      }
    );
  }

  /* About: offset photo pair rises in sequence */
  gsap.utils.toArray(".about-photos figure").forEach(function (fig, i) {
    gsap.fromTo(
      fig,
      { opacity: 0, y: 48 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        delay: i * 0.12,
        scrollTrigger: { trigger: fig, start: "top 88%", once: true },
      }
    );
  });

  /* Services: rows cascade */
  gsap.fromTo(
    ".service",
    { opacity: 0, y: 36 },
    {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: "power3.out",
      stagger: 0.07,
      scrollTrigger: { trigger: "#servicesList", start: "top 82%", once: true },
    }
  );

  /* Live: cards cascade per row */
  gsap.utils.toArray(".live-card").forEach(function (card, i) {
    gsap.fromTo(
      card,
      { opacity: 0, y: 44 },
      {
        opacity: 1,
        y: 0,
        duration: 0.85,
        ease: "power3.out",
        delay: (i % 2) * 0.12,
        scrollTrigger: { trigger: card, start: "top 86%", once: true },
      }
    );
  });

  /* CTA strip: plates rise (scale/opacity, CSS translateY offsets preserved) */
  gsap.fromTo(
    ".cta-strip img",
    { opacity: 0, scale: 0.92 },
    {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: "power3.out",
      stagger: 0.12,
      scrollTrigger: { trigger: ".cta-strip", start: "top 90%", once: true },
    }
  );

  /* Work cards on mobile: batch fade-up (desktop uses containerAnimation below) */
  gsap.matchMedia().add("(max-width: 768px)", function () {
    gsap.utils.toArray(".work-card").forEach(function (card) {
      gsap.fromTo(
        card,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: card, start: "top 92%", once: true },
        }
      );
    });
  });

  /* ======================================================================
     DESKTOP ONLY (min-width 769px) - auto-reverts on resize across breakpoint
     ====================================================================== */

  gsap.matchMedia().add("(min-width: 769px)", function () {
    var ac = new AbortController();
    var signal = { signal: ac.signal };

    /* Parallax frames */
    gsap.utils.toArray(".parallax img").forEach(function (img) {
      gsap.fromTo(
        img,
        { yPercent: -7 },
        {
          yPercent: 7,
          ease: "none",
          scrollTrigger: {
            trigger: img.closest(".parallax"),
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    });

    /* Services: cursor-follow preview */
    var preview = document.getElementById("servicesPreview");
    var pImg = preview.querySelector("img");
    var pX = gsap.quickTo(preview, "x", { duration: 0.5, ease: "power3.out" });
    var pY = gsap.quickTo(preview, "y", { duration: 0.5, ease: "power3.out" });
    var list = document.getElementById("servicesList");

    gsap.set(preview, { xPercent: -50, yPercent: -50, scale: 0.85, autoAlpha: 0 });

    list.addEventListener("pointermove", function (e) {
      pX(e.clientX);
      pY(e.clientY);
    }, signal);
    gsap.utils.toArray(".service").forEach(function (row) {
      row.addEventListener("pointerenter", function () {
        var src = row.getAttribute("data-img");
        if (pImg.getAttribute("src") !== src) pImg.setAttribute("src", src);
        gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.4, ease: "power3.out" });
      }, signal);
      row.addEventListener("pointerleave", function () {
        gsap.to(preview, { autoAlpha: 0, scale: 0.85, duration: 0.35, ease: "power3.out" });
      }, signal);
    });

    /* Work: horizontal scroll pin (canonical: start top top, scrub, invalidate) */
    var wTrack = document.getElementById("workTrack");
    var distance = function () {
      return wTrack.scrollWidth - window.innerWidth;
    };
    var scrollTween = gsap.to(wTrack, {
      x: function () { return -distance(); },
      ease: "none",
      scrollTrigger: {
        trigger: document.querySelector(".work"),
        start: "top top",
        end: function () { return "+=" + distance(); },
        pin: true,
        pinSpacing: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    /* Cards rise as they enter the pinned viewport */
    gsap.utils.toArray(".work-card").forEach(function (card) {
      gsap.fromTo(
        card,
        { y: 60 },
        {
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: card,
            containerAnimation: scrollTween,
            start: "left 95%",
            once: true,
          },
        }
      );
    });

    /* Team: sticky stack (canonical: start top top, pinSpacing false) */
    var cards = gsap.utils.toArray(".team-card");
    var last = cards[cards.length - 1];
    cards.forEach(function (card, i) {
      if (i === cards.length - 1) return;
      ScrollTrigger.create({
        trigger: card,
        start: "top top",
        endTrigger: last,
        end: "top top",
        pin: true,
        pinSpacing: false,
      });
      gsap.to(card, {
        scale: 0.94,
        opacity: 0.55,
        ease: "none",
        scrollTrigger: {
          trigger: cards[i + 1],
          start: "top bottom",
          end: "top top",
          scrub: true,
        },
      });
    });

    /* Magnetic buttons */
    gsap.utils.toArray(".magnetic").forEach(function (btn) {
      var xTo = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3.out" });
      var yTo = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3.out" });
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.3);
        yTo((e.clientY - r.top - r.height / 2) * 0.4);
      }, signal);
      btn.addEventListener("pointerleave", function () {
        gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
      }, signal);
    });

    return function () {
      ac.abort(); // remove pointer listeners when crossing the breakpoint
    };
  });
})();
