import { mount } from 'svelte';
import './styles/theme.css';
import LoginApp from './LoginApp.svelte';

// Minimal entry: no motion helper (no GSAP on the login page), no preloader.
// The Svelte shell class is still set so reveal-gated styles stay released.
document.body.classList.add('svelte-shell');

mount(LoginApp, { target: document.getElementById('app') });
