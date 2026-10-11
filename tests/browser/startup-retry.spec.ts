import {test,expect} from '@playwright/test';
import {farmSnapshot} from '../support/field-checkpoint';

test('failed startup can retry the same farm without the interim scenario selector',async({page})=>{
  let fail=true,requests=0;
  await page.route('**/assets/raw/SCEN0.SSM',route=>{
    requests++;return fail?route.fulfill({status:503,body:'Temporarily unavailable'}):route.continue();
  });
  await page.goto('/');
  const retry=page.getByRole('button',{name:'Retry loading farm',exact:true});
  await expect(retry).toBeVisible();await expect(page.locator('#world')).toHaveCount(0);
  await retry.click();await expect(retry).toBeVisible();expect(requests).toBeGreaterThanOrEqual(2);
  fail=false;await retry.click();
  await expect(page.locator('#map-status')).toHaveText('Scenario 1 · original terrain');
  await expect(page.locator('#world')).toBeVisible();await expect(retry).toHaveCount(0);
  const recovered=await farmSnapshot(page);
  await page.reload();await expect(page.locator('#map-status')).toHaveText('Scenario 1 · original terrain');
  expect(await farmSnapshot(page)).toEqual(recovered);
});

test('failed startup terrain artwork can be retried after the asset recovers',async({page})=>{
  await page.route('**/assets/scenario0.tiles.png',route=>route.abort());
  await page.goto('/');await expect(page.locator('.loading')).toContainText('Cannot load scenario0.tiles.png');
  await expect(page.locator('#world')).toHaveCount(0);
  await page.unroute('**/assets/scenario0.tiles.png');
  await page.getByRole('button',{name:'Retry loading farm',exact:true}).click();
  await expect(page.locator('#world')).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit message history'})).toBeVisible();
  await page.locator('#options-menu-button').click();
  await expect(page.getByRole('menuitemcheckbox',{name:'Music',exact:true})).toBeChecked();
});
