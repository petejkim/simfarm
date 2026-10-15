import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { runtimeRawFiles, runtimePublicFiles } from '../../tools/runtime-assets';
import { decodeVoc } from '../../src/formats/voc';

test('the deployed asset tree contains only runtime originals and every retained raw endpoint serves exact bytes', async ({ page }, info) => {
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const directory=info.project.name==='production'?'dist':'public';
  if(info.project.name==='production'){
    const files=readdirSync(directory,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile())
      .map(entry=>`${entry.parentPath}/${entry.name}`.replace(`${directory}/`,''));
    // Hashed JS/CSS/font/synth files belong to Vite; every copied public file is allowlisted.
    const bundled=/^assets\/(?:index-|libadlmidi\.|(?:roboto|dm-serif-display)-)/;
    expect(files.filter(file=>file!=='index.html'&&!bundled.test(file)).sort()).toEqual([...runtimePublicFiles].sort());
  }
  expect(readdirSync(`${directory}/assets/raw`).sort()).toEqual([...runtimeRawFiles].sort());
  for(const name of runtimeRawFiles){
    const response=await page.request.get(`/assets/raw/${name}`);
    expect(response.ok(),name).toBe(true);
    expect(response.headers()['content-type'],name).not.toContain('text/html');
    const bytes=await response.body();
    expect(bytes,name).toEqual(readFileSync(`artifacts/original-assets/${name}`));
    if(name.endsWith('.voc'))expect(decodeVoc(bytes).samples.length,name).toBeGreaterThan(0);
  }
  for(const path of ['assets/manifest.json','assets/raw/about.bmp','assets/raw/genfarm.xmi',
    'assets/raw/events.dat','assets/raw/crops/apples.crp','assets/raw/bird1.voc','assets/raw/thunder.voc',
    ...(info.project.name==='production'?['assets/.gitkeep','assets/.DS_Store','.DS_Store']:[])]){
    const response=await page.request.get(`/${path}`);
    // Vite/Pages may serve the app's HTML fallback for an absent file.
    expect(response.status()===404||response.headers()['content-type']?.includes('text/html'),path).toBeTruthy();
  }
  expect(errors).toEqual([]);
});
