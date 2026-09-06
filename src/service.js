import { mount } from 'svelte';
import '../styles.css';
import ServiceApp from './ServiceApp.svelte';

// Import the motion helper so gsap/ScrollTrigger register once per page and
// the fonts.ready refresh is armed before any component mounts.
import './lib/motion.js';

// Marks the Svelte shell so the stylesheet releases the reveal-gated initial
// states. Each component owns its own initial states via fromTo.
document.body.classList.add('svelte-shell');

const app = document.querySelector('#app');

mount(ServiceApp, { target: app, props: { slug: app.dataset.service } });
