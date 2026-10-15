import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Build before running: test the uploadable dist/ tree, never the development public/ tree.
export default defineConfig({
  ...base,
  projects: [{ name: 'production' }],
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:5191',
    storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:5191', localStorage: [
      { name: 'simfarm.startup.v1', value: 'scenario-1' }, { name: 'simfarm.touch-notice.v1', value: '1' },
    ] }] },
  },
  webServer: { command: './tools/bun run preview --port 5191 --strictPort', url: 'http://127.0.0.1:5191', reuseExistingServer: false },
});
