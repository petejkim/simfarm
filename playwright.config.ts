import { defineConfig } from '@playwright/test';
// Never reuse a developer server: another checkout may own its port.
export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:5190', viewport: { width: 1280, height: 900 },
    // Existing specs start from Scenario 1; the generated Region 9, 14 first start is opted out with this
    // override (src/ui/default-farm.ts) and covered by first-start.spec.ts with empty storage. The touch-screen notice
    // (TouchNotice.tsx) is marked seen likewise; touch-notice.spec.ts covers it.
    storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:5190', localStorage: [{ name: 'simfarm.startup.v1', value: 'scenario-1' }, { name: 'simfarm.touch-notice.v1', value: '1' }] }] },
    // Without the File System Access pickers (which Playwright cannot drive), Save to File... downloads
    // and Load from File... uses the file input, as in browsers that lack the API.
    launchOptions: { args: ['--disable-blink-features=FileSystemAccessLocal'] },
  },
  webServer: { command: './tools/bun run dev --port 5190 --strictPort', url: 'http://127.0.0.1:5190', reuseExistingServer: false },
});
