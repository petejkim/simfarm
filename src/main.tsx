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
// iOS also shows its text-selection loupe when a double tap is held on the second touch, even with user-select none
// (user report). A quick second touch (within 400ms and 40px of the last one ending) on anything but a control or text
// field has its default action cancelled: no loupe, selection or native scroll for that touch. Pointer handlers still
// run (the terrain confirms on pointerdown), and controls are skipped so they keep their click.
let lastTouch = { time: -Infinity, x: 0, y: 0 };
document.addEventListener('touchend', event => {
  const touch = event.changedTouches[0]; if (touch) lastTouch = { time: event.timeStamp, x: touch.clientX, y: touch.clientY };
}, { passive: true });
document.addEventListener('touchstart', event => {
  const touch = event.touches[0];
  if (event.touches.length !== 1 || event.timeStamp - lastTouch.time > 400 || Math.hypot(touch.clientX - lastTouch.x, touch.clientY - lastTouch.y) > 40) return;
  if (event.target instanceof Element && event.target.closest('button, input, select, textarea, a, [role^=menuitem]')) return;
  if (event.cancelable) event.preventDefault();
}, { passive: false });

createRoot(document.getElementById('app')!).render(<StrictMode><App /></StrictMode>);
