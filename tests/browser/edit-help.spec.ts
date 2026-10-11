import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {EDIT_HELP_LABELS} from '../../src/formats/edit-help';
async function start(page:Page){await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readFileSync((await(await pending).path())!,'utf8'));}

test('Edit help restores source-size leaders and real text, supports dismissal and leaves checkpoints untouched',async({page})=>{
  await start(page);const before=await save(page),button=page.getByRole('button',{name:'Edit tools and help',exact:true});
  await button.focus();await page.keyboard.press('Enter');const help=page.getByRole('complementary',{name:'Edit tool help'});
  await expect(help).toBeFocused();expect(await help.locator('.edit-help-artwork').boundingBox()).toEqual({x:48,y:48,width:88,height:200});
  expect(await help.locator('span').allTextContents()).toEqual(EDIT_HELP_LABELS.map(([text])=>text));
  expect(await help.locator('span').evaluateAll(els=>els.every(e=>e.childNodes[0]?.nodeType===Node.TEXT_NODE))).toBe(true);
  const actual=PNG.sync.read(await help.locator('.edit-help-artwork').screenshot()),original=PNG.sync.read(readFileSync('public/assets/edithelp.bmp.png'));
  for(let y=0;y<200;y++)for(let x=0;x<19;x++){const p=(y*88+x)*4;expect(actual.data.subarray(p,p+4)).toEqual(original.data.subarray(p,p+4));}
  await page.screenshot({path:'artifacts/browser-edit-help.png'});await page.keyboard.press('Escape');await expect(help).toHaveCount(0);await expect(button).toBeFocused();expect(await save(page)).toEqual(before);
  await button.click();await button.click();await expect(help).toHaveCount(0);
  await button.click();await page.locator('.original-control-bar').click({position:{x:600,y:8}});await expect(help).toHaveCount(0);expect(await save(page)).toEqual(before);
});

test('Advanced controls retain access and choosing a palette tool closes help without buying anything',async({page})=>{
  await start(page);const before=await save(page),button=page.getByRole('button',{name:'Edit tools and help',exact:true});
  await button.click();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Advanced controls',exact:true})).toBeFocused();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'Edit tools',exact:true})).toBeVisible();await expect(page.locator('#zoom')).toBeVisible();
  await page.getByRole('button',{name:'Close Edit tools',exact:true}).click();await button.click();await page.getByRole('button',{name:'Trees',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'Edit tool help'})).toHaveCount(0);await expect(page.locator('#cancel-construction')).toBeVisible();
  await button.click();await expect(page.locator('#cancel-construction')).toHaveCount(0);await page.keyboard.press('Escape');expect(await save(page)).toEqual(before);
});

test('missing help artwork fails before play',async({page})=>{
  await page.route('**/assets/edit-help.png',r=>r.abort());await page.goto('/');await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('#world')).toHaveCount(0);
});
