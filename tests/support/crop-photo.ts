import {expect,type Locator} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {readArchive} from '../../src/formats/archive';
import {readPalette,decodePlanar} from '../../src/formats/graphics';
const source=(name:string)=>readFileSync(new URL(`../../../simfarm-dos/${name}`,import.meta.url));
const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const palette=readPalette(entries.find(e=>e.name==='simfarm.pal')!.bytes);

/** Compare the rendered crop region to its original CRP, independent of atlas offsets. */
export async function expectCropPhoto(photo:Locator,id:string){
  await expect(photo).toHaveCSS('background-image',/\/crop-cards\.png"\)$/);
  const raster=PNG.sync.read(await photo.screenshot());
  expect([raster.width,raster.height]).toEqual([112,64]);
  expect(Array.from(raster.data)).toEqual(Array.from(decodePlanar(source(`CROPS/${id.toUpperCase()}.CRP`).subarray(0x400,0x1200),112,64,palette).rgba));
}
