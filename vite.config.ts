import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { publicAssets } from './tools/public-assets.ts';

export default defineConfig({ plugins: [react(), publicAssets()], build: { copyPublicDir: false } });
