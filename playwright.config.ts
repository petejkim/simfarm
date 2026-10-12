import { defineConfig } from '@playwright/test';
// Never reuse a developer server: another checkout may own its port.
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:5190', viewport: { width: 1280, height: 900 } },
  webServer: { command: './tools/bun run dev --port 5190 --strictPort', url: 'http://127.0.0.1:5190', reuseExistingServer: false },
});
