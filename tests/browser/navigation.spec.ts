import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';

const controls = (page: Page) => page.getByRole('navigation', { name: 'Farm controls' });
async function checkpoint(page: Page, name: string) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const path = `artifacts/navigation-${name}.json`; await (await pending).saveAs(path);
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('visible shortcuts open and focus planner and loans; navigation alone preserves the farm checkpoint', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('original terrain');
  const before = await checkpoint(page, 'before');
  const planner = controls(page).getByRole('button', { name: 'Crop planner', exact: true });
  await planner.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#field-planner > summary')).toBeFocused();
  await expect(page.locator('#field-planner > summary')).toBeInViewport();
  await page.keyboard.press('Tab'); await expect(page.locator('#planner-field')).toBeFocused();
  await page.locator('#planner-field').selectOption('1');
  await expect(page.locator('#field')).toHaveValue('1');
  await expect(page.locator('#field-planner > summary')).toHaveText('Crop plan · Field 1');
  await expect(page.locator('.plan-calendar')).toBeVisible();
  await page.locator('#plan-year').selectOption('4');
  await page.locator('#field-planner > summary').click();
  await planner.click(); // Shortcut must reopen a manually closed disclosure.
  await expect(page.locator('#plan-year')).toHaveValue('4');
  await page.locator('#planner-field').selectOption('2');
  await expect(page.locator('#field')).toHaveValue('2');
  await expect(page.locator('#plan-year')).toHaveValue('0');
  await controls(page).getByRole('button', { name: 'Loans', exact: true }).click();
  await expect(page.locator('#loan-panel > summary')).toBeFocused();
  await expect(page.locator('#loan-amount')).toBeVisible();
  await page.locator('#loan-panel > summary').press('Enter');
  await expect(page.locator('#loan-amount')).not.toBeVisible();
  await controls(page).getByRole('button', { name: 'Loans', exact: true }).click();
  await expect(page.locator('#loan-amount')).toBeVisible();
  expect(await checkpoint(page, 'after')).toEqual(before);
  await page.locator('#scenario').selectOption('1');
  await expect(page.locator('#map-status')).toContainText('Scenario 2');
  await expect(page.locator('#loan-panel')).not.toHaveAttribute('open');
  await expect(page.locator('#field-planner')).not.toHaveAttribute('open');
  await expect(page.locator('#field')).toHaveValue('');
  await page.screenshot({ path: 'artifacts/browser-navigation-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('narrow-screen shortcuts lead through land purchase, new-field planting and its planner', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.locator('#scenario').selectOption('4'); await expect(page.locator('#map-status')).toContainText('Scenario 5');
  await page.locator('#zoom').selectOption('0.5');
  await controls(page).getByRole('button', { name: 'Buy land', exact: true }).click();
  await expect(page.locator('#land-heading')).toHaveText('Buy land');
  await expect(page.locator('#land-heading')).toBeFocused(); await expect(page.locator('#land-heading')).toBeInViewport();
  await expect(page.locator('#buy-land')).toBeDisabled();
  await page.getByRole('button', { name: 'Choose on map', exact: true }).click();
  await expect(page.locator('#viewport')).toBeFocused(); await expect(page.locator('#viewport')).toBeInViewport();
  await page.locator('#viewport').evaluate(v => v.scrollTo(0, 0));
  await page.locator('#viewport').click({ position: { x: 4, y: 132 } });
  await page.getByRole('button', { name: 'Review plot', exact: true }).click();
  await expect(page.locator('#land-heading')).toBeFocused();
  await expect(page.locator('#land-quote')).toHaveText('Plot at 0, 16 · $18,060');
  await page.locator('#buy-land').click();
  await expect(page.locator('#farm-cash')).toHaveText('$21,940');
  await expect(page.locator('#land-heading')).toHaveText('New field');
  await controls(page).getByRole('button', { name: 'New field', exact: true }).click();
  await expect(page.locator('#land-heading')).toBeFocused();
  await page.locator('#auto-clear').check(); await page.locator('#create-field').click();
  await expect(page.locator('#field-status')).toContainText('Field 9 · Planting');
  await controls(page).getByRole('button', { name: 'Crop planner', exact: true }).click();
  await expect(page.locator('#planner-field')).toHaveValue('9');
  await expect(page.locator('#field-planner > summary')).toBeInViewport();
  await page.locator('#plan-year').selectOption('4'); await page.locator('[data-plan-week="239"]').click();
  await page.locator('#plan-action').selectOption('clear'); await page.locator('#apply-plan').click();
  await expect(page.locator('#plan-result')).toContainText('Plan updated');
  await controls(page).getByRole('button', { name: 'Loans', exact: true }).click();
  await page.locator('#loan-amount').fill('1000'); await page.locator('#borrow-loan').click();
  await expect(page.locator('#loan-result')).toHaveText('Borrowed $1,000.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await controls(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/browser-navigation-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('an empty farm offers a path from the planner to creating a field and resets navigation on load', async ({ page }) => {
  await page.goto('/'); const f = shopFixture(), text = f.load().withAllCrops(browserCrops).save(4);
  const load = async () => {
    await page.locator('#load-farm-file').setInputFiles({ name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  };
  await load(); await controls(page).getByRole('button', { name: 'Crop planner', exact: true }).click();
  await expect(page.locator('#field-planner')).toContainText('This farm has no fields yet');
  await page.getByRole('button', { name: 'Create a field', exact: true }).click();
  await expect(page.locator('#land-heading')).toHaveText('New field'); await expect(page.locator('#land-heading')).toBeFocused();
  await expect(page.locator('#create-field')).toBeDisabled();
  await load(); await expect(page.locator('#field-planner')).not.toHaveAttribute('open');
  await expect(page.locator('#map-tool')).toHaveValue('inspect');
  expect(await checkpoint(page, 'empty')).toEqual(JSON.parse(text));
});
