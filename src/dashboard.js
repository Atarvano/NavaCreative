import { mount } from 'svelte';
import './styles/theme.css';
import DashboardApp from './DashboardApp.svelte';

// Minimal entry like login.js: no motion helper, no preloader.
document.body.classList.add('svelte-shell');

mount(DashboardApp, { target: document.getElementById('app') });
