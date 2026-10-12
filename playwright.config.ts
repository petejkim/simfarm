import { defineConfig } from '@playwright/test';
// Never reuse a developer server: another checkout may own its port.
export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:5190', viewport: { width: 1280, height: 900 },
    // Without the File System Access pickers (which Playwright cannot drive), Save to File... downloads
    // and Load from File... uses the file input, as in browsers that lack the API.
    launchOptions: { args: ['--disable-blink-features=FileSystemAccessLocal'] },
  },
  webServer: { command: './tools/bun run dev --port 5190 --strictPort', url: 'http://127.0.0.1:5190', reuseExistingServer: false },
});
