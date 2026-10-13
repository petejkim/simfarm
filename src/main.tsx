import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
// Self-hosted Google Fonts (via @fontsource): Roboto for all UI text, DM Serif Display for the New Game titles.
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/700.css';
import '@fontsource/dm-serif-display/400.css';
import './style.css';

// The game is fixed to the screen and the page never scrolls, but iOS can leave the document or visual viewport
// offset after a rotation, so taps land away from what is drawn (user report: PLANT opened SPRAY). Put it back.
const settle = () => { if (scrollX || scrollY) scrollTo(0, 0); };
for (const target of [window, window.visualViewport]) for (const type of ['resize', 'scroll']) target?.addEventListener(type, settle);
addEventListener('orientationchange', settle);
// iOS Safari applies :active (the pressed bevel) to tapped buttons only when the page listens for touchstart; without it
// buttons show no feedback until the click lands after the finger lifts, which reads as a delay (user report).
document.addEventListener('touchstart', () => {}, { passive: true });

createRoot(document.getElementById('app')!).render(<StrictMode><App /></StrictMode>);
