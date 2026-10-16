import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { publicAssets } from './tools/public-assets.ts';

export default defineConfig({
  input: ['index.html', 'xplayer.html'],
  plugins: [react(), publicAssets()],
  build: { copyPublicDir: false },
});
