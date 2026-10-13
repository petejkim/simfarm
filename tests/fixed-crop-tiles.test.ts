import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {readArchive} from '../src/formats/archive';
import {readScenario} from '../src/formats/scenario';
import {patchCropGraphics} from '../src/formats/crop-graphics';
import {allCropFiles,fixedCropTiles,FIXED_CROP_FILES,isCropStageTile} from '../src/formats/crop-slots';

const dos=(name:string)=>new Uint8Array(readFileSync(new URL('../../simfarm-dos/'+name,import.meta.url)));
const archive=readArchive(dos('MEGADATA.IDX'),dos('MEGADATA.EEA')),base=archive.find(e=>e.name==='ega16til.til')!.bytes;
const crop=(file:string)=>dos('CROPS/'+file.toUpperCase());
const tileBytes=(atlas:Uint8Array,tile:number)=>atlas.subarray(tile*128,tile*128+128);

test('every tile of each scenario\'s own slot atlas equals its mapped tile in the fixed atlas',()=>{
  const fixed=patchCropGraphics(base,FIXED_CROP_FILES.map(crop));
  for(let id=0;id<8;id++){
    const files=allCropFiles(readScenario(dos(`SCEN${id}.SSM`)).cropFiles),own=patchCropGraphics(base,files.map(crop)),map=fixedCropTiles(files);
    for(let tile=0;tile<1392;tile++)expect(tileBytes(fixed,map[tile])).toEqual(tileBytes(own,tile));
  }
});
test('the mapping is a permutation of crop tiles that leaves every other tile alone',()=>{
  const files=allCropFiles(readScenario(dos('SCEN0.SSM')).cropFiles),map=fixedCropTiles(files);
  expect(files.slice(0,2)).toEqual(['almonds.crp','grapes.crp']);
  expect(new Set(map).size).toBe(2048);
  expect(map[688]).toBe(688);expect(map[688+8]).toBe(688+7*8); // slot 1 (grapes) is fixed crop 7
  for(let tile=0;tile<2048;tile++)if(map[tile]!==tile)expect(isCropStageTile(tile)||tile>=539&&tile<603||tile>=816&&tile<848||tile>=1344&&tile<1392).toBe(true);
  expect(fixedCropTiles([...files])).toBe(map); // cached by crop order
  expect(fixedCropTiles(FIXED_CROP_FILES).every((tile,i)=>tile===i)).toBe(true);
});
