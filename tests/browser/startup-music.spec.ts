import {test,expect} from '@playwright/test';
import {encodeMidi} from '../../src/formats/xmidi';
const intro=(endTick:number)=>Buffer.from(encodeMidi({ticksPerSecond:120,events:[{tick:0,data:[0x90,60,100]},{tick:endTick,data:[0x80,60,0]}],endTick,sourceMetadata:[]}));

test('amain finishes once and hands off to genfarm',async({page})=>{
  // Shorten only the fixture duration; exercise the real Web Audio completion.
  await page.route('**/amain.mid',route=>route.fulfill({body:intro(24),contentType:'audio/midi'}));
  const tracks:string[]=[];page.on('request',r=>{if(r.url().endsWith('.mid'))tracks.push(r.url().split('/').pop()!);});
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#options-menu-button').click();
  await expect(page.locator('#audio-status')).toContainText('Playing genfarm');
  expect(tracks).toEqual(['amain.mid','genfarm.mid']);
});

test('muting the introduction cancels its automatic handoff',async({page})=>{
  await page.route('**/amain.mid',route=>route.fulfill({body:intro(120),contentType:'audio/midi'}));
  const tracks:string[]=[];page.on('request',r=>{if(r.url().endsWith('.mid'))tracks.push(r.url().split('/').pop()!);});
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#options-menu-button').click();await expect(page.locator('#audio-status')).toContainText('Playing amain');
  await page.getByRole('menuitemcheckbox',{name:'Music',exact:true}).click();
  await expect(page.locator('#audio-status')).toHaveText('Music off');
  await page.waitForTimeout(1500);expect(tracks).toEqual(['amain.mid']);
  await expect(page.locator('#audio-status')).toHaveText('Music off');
});
