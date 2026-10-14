import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('startup and Expert navigation use one predecoded bundle without card or message binary requests', async ({ page }, testInfo) => {
  const requested: string[] = [], completed: string[] = [];
  page.on('request', request => { if (request.url().includes('/assets/')) requested.push(new URL(request.url()).pathname); });
  page.on('requestfinished', request => { if (request.url().endsWith('/assets/ui-content.json')) completed.push(new URL(request.url()).pathname); });
  // Ensure the page can play without these binary endpoints, even if a later navigation tries to load them.
  await page.route(/\/assets\/raw\/(card\d+\.hc|events\.dat|qmessage\.dat)$/, route => route.fulfill({ status: 404, body: 'Bundled at import' }));
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#window-expert').click();
  const expert = page.getByRole('region', { name: 'Farm Expert', exact: true });
  await expert.getByRole('button', { name: 'Crops', exact: true }).click();
  await expect(expert).toContainText('Crop Information');await expert.getByRole('button', { name: 'NEXT', exact: true }).click();
  await page.getByRole('dialog', { name: 'Farm Expert', exact: true }).getByRole('button', { name: 'Close Farm Expert', exact: true }).click();
  await page.getByRole('button', { name: 'Move object', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit message history' })).toContainText('Choose an object to move.');
  // Development StrictMode aborts the first mount's fetch and repeats it; only one bundle load completes.
  await expect.poll(() => completed.length).toBe(1);
  if (testInfo.project.name === 'production') expect(requested.filter(path => path.endsWith('/ui-content.json'))).toHaveLength(1);
  expect(requested.filter(path => /\/raw\/(card\d+\.hc|events\.dat|qmessage\.dat)$/.test(path))).toEqual([]);
});

test('missing event rows and malformed JSON fail before game creation', async ({ page }) => {
  const bundle = JSON.parse(readFileSync('public/assets/ui-content.json', 'utf8'));bundle.eventMessages.pop();
  for (const body of [JSON.stringify(bundle), '{invalid']) {
    await page.route('**/assets/ui-content.json', route => route.fulfill({ status: 200, contentType: 'application/json', body }));
    await page.goto('/');await expect(page.getByRole('heading', { name: 'SimFarm assets unavailable' })).toBeVisible();
    await expect(page.locator('#world')).toHaveCount(0);await page.unroute('**/assets/ui-content.json');
  }
});
