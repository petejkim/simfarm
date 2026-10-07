import { test, expect } from '@playwright/test';

test('original scenario maps, crop selection, navigation and audible MIDI', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Observe actual Web Audio output, not just the play button's label.
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    const audio = { contexts: [] as AudioContext[], analysers: [] as AnalyserNode[] };
    Object.assign(window, { __audioTest: audio });
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); audio.contexts.push(this);
        const original = this.createGain.bind(this);
        this.createGain = () => {
          const gain = original();
          if (!audio.analysers.length) { const analyser = this.createAnalyser(); gain.connect(analyser); audio.analysers.push(analyser); }
          return gain;
        };
      }
    };
  });
  await page.goto('/');
  await expect(page.locator('#map-status')).toHaveText('Scenario 1 · original terrain');
  const colors = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, 1536, 1536).data, colors = new Set<number>();
    for (let p = 0; p < data.length; p += 4) colors.add((data[p] << 16) | (data[p + 1] << 8) | data[p + 2]);
    return colors.size;
  });
  expect(colors).toBeGreaterThan(8);
  await page.locator('#viewport').click({ position: { x: 160, y: 160 } });
  await expect(page.locator('#cell-status')).toContainText('graphic');
  await page.locator('#crop').selectOption('corn');
  await expect(page.locator('#crop-name')).toHaveText('Corn');
  await expect(page.locator('#crop-description')).toContainText('Removes a lot of nutrients');
  expect(await page.locator('#crop-card').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 112)).toBeTruthy();
  for (let i = 1; i < 8; i++) {
    await page.locator('#scenario').selectOption(String(i));
    await expect(page.locator('#map-status')).toHaveText(`Scenario ${i + 1} · original terrain`);
  }
  await page.locator('#zoom').selectOption('0.5');
  await expect(page.locator('canvas')).toHaveCSS('width', '768px');
  await page.getByRole('button', { name: 'Play music' }).click();
  await expect(page.locator('#audio-status')).toContainText('Playing amain');
  await expect.poll(() => page.evaluate(() => {
    const audio = (window as unknown as { __audioTest: { contexts: AudioContext[]; analysers: AnalyserNode[] } }).__audioTest;
    const data = new Float32Array(2048);
    audio.analysers[0]?.getFloatTimeDomainData(data);
    return Math.max(...data.map(Math.abs));
  })).toBeGreaterThan(0.001);
  await page.getByRole('button', { name: 'Stop music' }).click();
  await expect(page.locator('#audio-status')).toHaveText('Music off');
  await expect.poll(() => page.evaluate(() => {
    const audio = (window as unknown as { __audioTest: { analysers: AnalyserNode[] } }).__audioTest;
    const data = new Float32Array(2048); audio.analysers[0].getFloatTimeDomainData(data);
    return Math.max(...data.map(Math.abs));
  })).toBeLessThan(0.0001);
  await page.locator('#scenario').selectOption('0');
  await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.screenshot({ path: 'artifacts/native-browser.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('missing assets give a useful startup error', async ({ page }) => {
  await page.route('**/assets/catalog.json', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SimFarm assets unavailable' })).toBeVisible();
  await expect(page.locator('#app')).toContainText('npm run import');
});
