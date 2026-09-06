import { mount } from 'svelte';
import '../styles.css';
import App from './App.svelte';

// Import the motion helper so gsap/ScrollTrigger register once per page and
// the fonts.ready refresh is armed before any component mounts.
import './lib/motion.js';

// Marks the Svelte shell so the stylesheet releases the reveal-gated initial
// states (lines visible, hero frame unclipped). Each component's ticket-04
// animation will own its own initial states via fromTo + immediateRender.
document.body.classList.add('svelte-shell');

mount(App, { target: document.getElementById('app') });
