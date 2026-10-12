import {readSaveText} from '../support/save-file';
import { test, expect, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.goto('/'); await expect(page.locator('#world')).toBeVisible(); await page.locator('#window-bank').click();
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  return JSON.parse(readSaveText((await (await pending).path())!));
}

test('Bank terminal preserves source geometry and HTML captions; keypad, clear, help, borrow and full repayment work', async ({ page }) => {
  await start(page); const before = await save(page);
  const bank = page.getByRole('dialog', { name: 'Bank', exact: true });
  expect(await bank.boundingBox()).toMatchObject({ x: 176, y: 96, width: 288, height: 240 });
  // Shared frame around a CSS-built 272×216 terminal: no artwork image; keys are shared bevel buttons.
  expect(await page.locator('.bank-terminal').boundingBox()).toEqual({ x: 184, y: 112, width: 272, height: 216 });
  await expect(bank.locator('img,canvas')).toHaveCount(0);
  expect(await bank.locator('.bank-key.bevel-button').count()).toBe(15);
  const keys = bank.getByRole('button');
  await expect(keys).toHaveText(['','7','8','9','C','4','5','6','?','1','2','3','0','REPAY','OK','CLOSE']); // keypad order, then actions
  await keys.getByText('1', { exact: true }).click(); // Visible captions are real text.
  await bank.getByRole('button', { name: '0', exact: true }).click();
  await expect(page.locator('#loan-amount')).toHaveValue('10');
  await bank.getByRole('button', { name: 'Clear loan amount' }).click();
  await expect(page.locator('#loan-amount')).toHaveValue('0');
  await bank.getByRole('button', { name: 'Bank help' }).click();
  await expect(bank.getByRole('note')).toHaveText('Loan AmountEntry PadBorrowAmountRepayLoanIn Full');
  await bank.getByRole('button', { name: 'Bank help' }).click();
  await page.locator('#loan-panel').focus(); await page.keyboard.type('1000');
  await expect(page.locator('#loan-amount')).toHaveValue('1000');
  await page.keyboard.press('Enter');
  await expect(page.locator('#loan-amount')).toHaveValue('0');
  await expect(page.locator('#loan-balance')).toHaveText('$1,000');
  await expect(page.locator('#loan-installment')).toHaveText('$57');
  await page.screenshot({ path: 'artifacts/browser-bank-terminal.png' });
  const borrowed = await save(page);
  expect(borrowed.runtime.finances.loan.principal).toBe(1000);
  await page.locator('#repay-loan').click();
  await expect(page.locator('#loan-balance')).toHaveText('$0');
  await expect(page.locator('#loan-installment')).toHaveText('$0');
  expect((await save(page)).scenario.farm.cash).toBe(before.scenario.farm.cash);
});

test('Bank entry clamps credit, keyboard period clears, zero OK and Close leave the farm intact', async ({ page }) => {
  await start(page); const before = await save(page);
  const limit = Number((await page.locator('#loan-credit').textContent())!.replace(/[^0-9]/g, ''));
  await page.locator('#loan-amount').fill('999999999999999999999');
  await expect(page.locator('#loan-amount')).toHaveValue(String(limit));
  await page.locator('#loan-amount').press('.'); await expect(page.locator('#loan-amount')).toHaveValue('0');
  await page.locator('#borrow-loan').click(); await expect(page.getByRole('dialog', { name: 'Bank', exact: true })).toHaveCount(0);
  await page.locator('#window-bank').click(); await page.locator('#loan-amount').fill('1000');
  await page.getByRole('button', { name: 'Close Bank terminal', exact: true }).click();
  expect(await save(page)).toEqual(before);
  // The source zero-key mismatch (SF-155) must not create a wrapped loan.
  before.scenario.farm.cash = 9000000; before.runtime.finances.accounts.buildingBookValue = 3000000;
  await page.locator('#load-farm-file').setInputFiles({ name: 'high-cash.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await page.locator('#window-bank').click();
  expect(Number((await page.locator('#loan-credit').textContent())!.replace(/[^0-9]/g, ''))).toBeGreaterThan(1000000);
  await page.locator('#loan-amount').fill('100000');
  await page.getByRole('dialog', { name: 'Bank', exact: true }).getByRole('button', { name: '0', exact: true }).click();
  await expect(page.locator('#loan-amount')).toHaveValue('999999'); await page.locator('#borrow-loan').click();
  await expect(page.locator('#farm-cash')).toHaveText('$9,999,999');
  await expect(page.locator('#loan-balance')).toHaveText('$999,999');
});
