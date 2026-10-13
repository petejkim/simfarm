import {FIXED_CROP_FILES} from '../src/formats/crop-slots';
import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {HarvestWorkerAnimation,harvestWorkerTile} from '../src/render/harvest-workers';
import {drawWorld} from '../src/render/world-renderer';
import type {Scenario} from '../src/formats/scenario';

const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
test('source map animation alternates1036/1037 with unchanged ownership flags',()=>{
  expect(createHash('sha256').update(exe).digest('hex')).toBe('8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  expect(exe.subarray(0xe5dd,0xe5f2).toString('hex')).toBe('3d0c047403e9e7fc81e10dfc81c90d0426898f244c');
  expect(exe.subarray(0xe2cc,0xe2ea).toString('hex')).toBe('3d0d0475196b5efa60035ef6d1e3268b87244c250cfc0d0c04268987244c');
  // Recover both masked-index writes for every combination of the five high flags.
  for(let flags=0;flags<=0xf800;flags+=0x800)for(const tile of [1036,1037]){
    const word=flags|tile,source=tile===1036?(word&0xfc0d)|1037:(word&0xfc0c)|1036;
    expect(flags|(harvestWorkerTile(tile-848,1)+848)).toBe(source);
  }
  for(let tile=0;tile<200;tile++){
    expect(harvestWorkerTile(tile,0)).toBe(tile);
    if(tile!==188&&tile!==189)expect(harvestWorkerTile(tile,1)).toBe(tile);
  }
});
test('native worker presentation clock preserves remainder across pause and skips hidden catch-up',()=>{
  const clock=new HarvestWorkerAnimation();clock.advance(1000);
  expect(clock.advance(1249)).toBe(false);expect(clock.phase).toBe(0);
  expect(clock.advance(1250)).toBe(true);expect(clock.phase).toBe(1);
  clock.advance(1300);clock.suspend();expect(clock.advance(99999)).toBe(false);
  expect(clock.advance(100198)).toBe(false);expect(clock.advance(100199)).toBe(true);expect(clock.phase).toBe(0);
  expect(clock.advance(101949)).toBe(true);expect(clock.phase).toBe(1);
  clock.reset();expect(clock.phase).toBe(0);expect(clock.advance(200000)).toBe(false);
});
test('world composition animates only visible worker overlays without mutating saved cells',()=>{
  for(const terrain of [15,15|0x800])for(const overlay of [1035,1036,1037,1038]){
    const scenario={cells:[{terrain,overlay:overlay|0xf800,attribute:0}],fields:[],cropFiles:FIXED_CROP_FILES} as unknown as Scenario;
    const before=structuredClone(scenario),calls:unknown[][]=[];
    const context={drawImage:(...args:unknown[])=>calls.push(args)} as unknown as CanvasRenderingContext2D;
    const base={} as CanvasImageSource,mask={} as CanvasImageSource;
    drawWorld(context,scenario,base,mask,undefined,1);
    expect(calls).toHaveLength(terrain&0x800?2:1);
    if(terrain&0x800){const tile=harvestWorkerTile(overlay-848,1);expect(calls[1]).toEqual([mask,tile%32*16,Math.floor(tile/32)*16,16,16,0,0,16,16]);}
    expect(scenario).toEqual(before);
  }
});
