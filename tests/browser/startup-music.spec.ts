import {test,expect} from '@playwright/test';

test('amain finishes once and hands off to genfarm',async({page})=>{
  // Shorten only the fixture duration; exercise the real Web Audio completion.
  await page.route('**/amain.music.json',route=>route.fulfill({json:{events:[],endTick:24}}));
  const tracks:string[]=[];page.on('request',r=>{if(r.url().endsWith('.music.json'))tracks.push(r.url().split('/').pop()!);});
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#options-menu-button').click();
  await expect(page.locator('#audio-status')).toContainText('Playing genfarm');
  expect(tracks).toEqual(['amain.music.json','genfarm.music.json']);
});

test('muting the introduction cancels its automatic handoff',async({page})=>{
  await page.route('**/amain.music.json',route=>route.fulfill({json:{events:[],endTick:120}}));
  const tracks:string[]=[];page.on('request',r=>{if(r.url().endsWith('.music.json'))tracks.push(r.url().split('/').pop()!);});
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#options-menu-button').click();await expect(page.locator('#audio-status')).toContainText('Playing amain');
  await page.getByRole('menuitemcheckbox',{name:'Music',exact:true}).click();
  await expect(page.locator('#audio-status')).toHaveText('Music off');
  await page.waitForTimeout(1500);expect(tracks).toEqual(['amain.music.json']);
  await expect(page.locator('#audio-status')).toHaveText('Music off');
});
