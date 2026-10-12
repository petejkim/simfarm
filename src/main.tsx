import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
// Self-hosted Google Fonts (via @fontsource): Roboto for all UI text, DM Serif Display for the New Game titles.
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/700.css';
import '@fontsource/dm-serif-display/400.css';
import './style.css';

createRoot(document.getElementById('app')!).render(<StrictMode><App /></StrictMode>);
