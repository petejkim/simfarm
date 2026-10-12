import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {MAX_SAVE_BYTES} from '../../src/formats/native-save';
async function save(page:Page){
  const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();
  const download=await pending;return {name:download.suggestedFilename(),bytes:readFileSync((await download.path())!)};
}
test('compressed downloads shrink the checkpoint, reload exactly, and reject corrupt or oversized expansion',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const saved=await save(page),raw=gunzipSync(saved.bytes);
  expect(saved.name).toMatch(/\.simfarm\.json\.gz$/);expect([...saved.bytes.subarray(0,2)]).toEqual([31,139]);
  expect(saved.bytes.length).toBeLessThan(raw.length/4);
  console.log(`Checkpoint gzip: ${raw.length} → ${saved.bytes.length} bytes`);
  const load=async(buffer:Buffer,name:string)=>page.locator('#load-farm-file').setInputFiles({name,mimeType:'application/octet-stream',buffer});
  for(const [bytes,name] of [[saved.bytes,saved.name],[saved.bytes,'renamed.json'],[raw,'legacy.json']] as const){
    await load(bytes,name);await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
    expect(gunzipSync((await save(page)).bytes)).toEqual(raw);
  }
  const corrupt=Buffer.from(saved.bytes);corrupt[corrupt.length-5]^=0xff;
  for(const bytes of [saved.bytes.subarray(0,-8),corrupt,gzipSync('x'.repeat(MAX_SAVE_BYTES+1))]){
    await load(bytes,'broken.json.gz');await expect(page.locator('#file-error-text')).toContainText('Could not load farm');
    await page.locator('#file-error-ok').click();expect(gunzipSync((await save(page)).bytes)).toEqual(raw);
  }
});
