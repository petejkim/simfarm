import { constructTownDistrict } from '../src/simulation/town-construction';
import { animateTownEventMap, changeTownEventMap } from '../src/simulation/town-event-map';
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readArchive } from '../src/formats/archive';
import { readScenario, terrainTile, worldIndex } from '../src/formats/scenario';
import { TownLayouts, readTownConstructionState } from '../src/formats/town';
import { FarmRandom } from '../src/simulation/random';
import { changeTownLevel, demolishTownDistrict, developTown, repaintTownDistrict, type TownDevelopmentState } from '../src/simulation/town-development';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const raw = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')).find(a => a.name === 'townly0.cmp')!.bytes;
const layouts = new TownLayouts(raw), site = { regionX: 4, regionY: 5 };
const ri = (x: number, y: number) => (x * 12 + y) * 7;
function setup(id = 4) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes);
  world.regionalConditions.fill(0); world.farm.townRegionX = 6; world.farm.townRegionY = 6;
  for (const c of world.cells) { c.terrain = 0xb80f; c.overlay = 0xf234; c.attribute = 37; }
  world.regionalConditions[ri(site.regionX, site.regionY) + 1] = 2;
  const state: TownDevelopmentState = { ...readTownConstructionState(bytes), activeSite: { ...site }, townRevenue: 1000, developmentSpent: 0 };
  const random = new FarmRandom({ visual: 319, simulation: 987, bounded: 55 });
  const cell = (dx: number, dy: number) => world.cells[worldIndex(site.regionX * 8 + dx, site.regionY * 8 + dy)];
  const set = (type: number, level: number) => { world.regionalConditions[ri(site.regionX, site.regionY)] = type | level << 4; };
  return { world, state, random, cell, set };
}

test('town growth dispatch, level cap, visual RNG and finance caller match executable bytes', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, hex: string) => assert.equal(e.subarray(o, o + hex.length / 2).toString('hex'), hex);
  const targets = (off: number, n: number) => Array.from({ length: n }, (_, i) => e.readUInt16LE(off + i * 2) + 0x3aba0);
  assert.deepEqual(targets(0x3be08, 16), [0x3b64e, ...Array(3).fill(0x3b7ce), 0x3b54e, 0x3b54e, ...Array(10).fill(0x3b7ce)]);
  assert.deepEqual(targets(0x3bdde, 14), [0x3b7d6, ...Array(7).fill(0x3b834), 0x3b996, 0x3ba64, 0x3bb14, 0x3bbc4, 0x3bd22, 0x3be28]);
  assert.deepEqual([...e.subarray(0x8e39c, 0x8e3ac)], Array(16).fill(13));
  exact(0x3b922, '9a7d00fd052403d0e0'); exact(0x3b3cb, '80b89c9405');
  exact(0xcbb3, '9af60fe624'); exact(0x28059, 'eac205ce270f00');
  exact(0x3b1bb, '832e8a7519831e8c75008306147519');
  exact(0x3bee1, '2680a7254cb7'); exact(0x3c53d, '807efc0c7fd5');
  assert.equal(e.readUInt16LE(0x4ec60 + 0x860), 39); assert.equal(e[0x4ec60 + 0x99f], 30);
});

test('all ordinary districts at levels 1..7 use one visual draw per anchor, correct four-cell order and retained records', () => {
  for (const type of [1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14]) for (let level = 1; level <= 7; level++) {
    const { world, random, cell, set } = setup(); set(type, level);
    const expected = new FarmRandom(random.snapshot()), painted = new Map<string, number>();
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
      const tile = layouts.tile(type, x, y);
      if (tile >= 252 && tile <= 280 && !(tile & 1)) {
        const v = ((expected.nextVisual() & 3) + (level >>> 1)) * 2;
        painted.set(`${x},${y}`, 252 + v); painted.set(`${x + 1},${y}`, 253 + v);
        painted.set(`${x},${y + 1}`, 292 + v); painted.set(`${x + 1},${y + 1}`, 293 + v);
      }
    }
    const before = Buffer.from(world.sourceBytes), regions = Uint8Array.from(world.regionalConditions);
    repaintTownDistrict(world, layouts, site, random);
    for (const [key, tile] of painted) {
      const [x, y] = key.split(',').map(Number), template = layouts.tile(type, x, y);
      // Type 3's anchor 280 has companions 281/246/247, outside the
      // source skip ranges. The later loop iterations overwrite those three.
      const kept = (template >= 252 && template <= 280) || (template >= 292 && template <= 320);
      assert.equal(cell(x, y).terrain, kept ? tile : template, `${type}/${level} at ${key}`);
    }
    assert.deepEqual(random.snapshot(), expected.snapshot()); assert.deepEqual(world.regionalConditions, regions);
    assert.deepEqual(Buffer.from(world.sourceBytes), before);
    for (const c of world.cells) { assert.equal(c.overlay, 0xf234); assert.equal(c.attribute, 37); }
  }
});

test('all fifteen district types and sixteen level nibbles preserve the source stage distinctions', () => {
  for (let type = 0; type < 15; type++) for (let level = 0; level < 16; level++) {
    const { world, random, cell, set } = setup(); set(type, level);
    const randomBefore = random.snapshot();
    repaintTownDistrict(world, layouts, site, random);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
      const template = layouts.tile(type, x, y), isRoad = template >= 161 && template <= 172;
      if ([0, 4, 5].includes(type)) {
        if (isRoad) assert.ok(terrainTile(cell(x, y)) >= 150 && terrainTile(cell(x, y)) <= 160);
        else assert.equal(cell(x, y).terrain, template);
      } else if (level === 0) assert.equal(cell(x, y).terrain, 20);
      else if (level === 8) {
        if (isRoad) assert.ok(terrainTile(cell(x, y)) >= 161 && terrainTile(cell(x, y)) <= 171);
        else assert.equal(cell(x, y).terrain, template);
      } else if (level >= 9) {
        const paved = level === 9 ? x < 4 && y < 4 : level === 10 ? y < 4 : level === 11 ? x < 4 || y < 4 : level === 12;
        if (isRoad && paved) assert.ok(terrainTile(cell(x, y)) >= 150 && terrainTile(cell(x, y)) <= 160);
        else assert.equal(cell(x, y).terrain, 0xb80f);
      }
    }
    if ([0, 4, 5].includes(type) || level === 0 || level >= 8) assert.deepEqual(random.snapshot(), randomBefore);
  }
  for (const type of [0, 4, 5, 6]) {
    const { world, random, cell, set } = setup(); set(type, 8);
    [71, 72, 111, 112].forEach((t, y) => cell(0, y).terrain = 0xb800 | t);
    repaintTownDistrict(world, layouts, site, random);
    if (type === 4 || type === 5) [71, 72, 111, 112].forEach((t, y) => assert.equal(cell(0, y).terrain, 0xb800 | t));
    else for (let y = 0; y < 4; y++) assert.notEqual(cell(0, y).terrain, 0xb800 | [71, 72, 111, 112][y]);
  }
});

test('development and decline obey signed revenue thresholds, level limits, demolition results and word wrapping', () => {
  const { world, state, random, set } = setup(); set(6, 0);
  for (const revenue of [0, 1, 24]) { state.townRevenue = revenue; developTown(world, state, layouts, 8, random); assert.equal(world.regionalConditions[ri(4, 5)], 6); }
  state.townRevenue = 25; state.developmentSpent = 65530;
  developTown(world, state, layouts, 8, random);
  assert.equal(world.regionalConditions[ri(4, 5)], 0x16); assert.equal(state.townRevenue, 0); assert.equal(state.developmentSpent, 19);
  state.townRevenue = 0xffffffff; developTown(world, state, layouts, 8, random);
  assert.equal(world.regionalConditions[ri(4, 5)], 6); assert.equal(state.townRevenue, 0); assert.equal(state.developmentSpent, 19);
  state.townRevenue = (-26) >>> 0; set(6, 1); developTown(world, state, layouts, 8, random);
  assert.equal(state.townRevenue, 0xffffffff);
  developTown(world, state, layouts, 8, random); // Demolition does not refund revenue.
  assert.equal(world.regionalConditions[ri(4, 5) + 1], 0); assert.equal(state.townRevenue, 0xffffffff);
  world.regionalConditions[ri(4, 5) + 1] = 2; state.activeSite = { ...site };
  for (const level of [13, 14, 15]) { set(6, level); state.townRevenue = 100;
    assert.equal(changeTownLevel(world, state, layouts, site, 1, 8, random), false);
    developTown(world, state, layouts, 8, random); assert.equal(state.townRevenue, 100); }
  set(5, 10); assert.equal(changeTownLevel(world, state, layouts, site, 1, 8, random), true);
  assert.equal(world.regionalConditions[ri(4, 5)], 0xb5); // Whole-byte airport guard.
  set(5, 0); state.townRevenue = 100; developTown(world, state, layouts, 8, random);
  assert.equal(world.regionalConditions[ri(4, 5)], 5); assert.equal(state.townRevenue, 75);
});

test('demolition protects origin, preserves trees/flags/unknown bytes and retargets using the original asymmetric search', () => {
  const { world, state, cell, set } = setup(); set(4, 0); state.recreationCount = 2; state.recreationCoordinates.set([32,40,24,32]);
  const coords = Uint8Array.from(state.recreationCoordinates), airports = state.airportCount;
  world.regionalConditions[ri(4, 5) + 2] = 93;
  for (let t = 38; t <= 69; t++) cell((t - 38) >> 3, (t - 38) & 7).terrain = 0xb800 | t;
  world.regionalConditions[ri(3, 4) + 1] = 2; world.regionalConditions[ri(4, 4) + 1] = 2;
  assert.equal(demolishTownDistrict(world, state, site, -3), true);
  assert.deepEqual(state.activeSite, { regionX: 3, regionY: 4 });
  assert.equal(state.recreationCount, 1); assert.equal(state.airportCount, airports);
  coords.set([24,32,0,0]); assert.deepEqual(state.recreationCoordinates, coords); assert.equal(world.regionalConditions[ri(4, 5)], 4);
  assert.equal(world.regionalConditions[ri(4, 5) + 2], 93);
  for (let t = 38; t <= 69; t++) {
    const c = cell((t - 38) >> 3, (t - 38) & 7);
    assert.equal(c.terrain, 0xb800 | (t >= 39 && t < 69 ? t : 21)); assert.equal(c.overlay, 0xb234);
  }
  const before = JSON.stringify([world, state]);
  assert.equal(demolishTownDistrict(world, state, { regionX: 6, regionY: 6 }, 8), false);
  assert.equal(JSON.stringify([world, state]), before);
  // Candidates on either origin axis are skipped, even when nearer.
  world.regionalConditions.fill(0); state.activeSite = { regionX: 7, regionY: 7 };
  world.regionalConditions[ri(6, 7) + 1] = 2; world.regionalConditions[ri(7, 6) + 1] = 2;
  world.regionalConditions[ri(4,5)+1]=2;
  demolishTownDistrict(world, state, site, 8); assert.deepEqual(state.activeSite, { regionX: 6, regionY: 6 });
  state.activeSite = { regionX: 11, regionY: 11 };
  assert.doesNotThrow(() => demolishTownDistrict(world, state, site, 8));
});

test('development bounds reject malformed input atomically and original layouts fit every map corner', () => {
  const { world, state, random, set } = setup(); set(6, 0);
  const bytes = Uint8Array.from(raw), index = 2 * (320 + 8 + 7); // Type 6, x=7, y=0.
  bytes[index] = 252; bytes[index + 1] = 0;
  const before = JSON.stringify([world, state, random.snapshot()]);
  assert.throws(() => changeTownLevel(world, state, new TownLayouts(bytes), site, 1, 8, random));
  assert.equal(JSON.stringify([world, state, random.snapshot()]), before);
  for (const moisture of [-129, 128, NaN]) assert.throws(() => developTown(world, state, layouts, moisture, random));
  for (const invalid of [{ regionX: -1, regionY: 0 }, { regionX: 12, regionY: 0 }]) assert.throws(() => repaintTownDistrict(world, layouts, invalid, random));
  set(15, 0); assert.throws(() => changeTownLevel(world, state, layouts, site, 1, 8, random));
  for (let farm = 0; farm < 8; farm++) {
    const { world: s, random: r } = setup(farm);
    for (const x of [0, 11]) for (const y of [0, 11]) for (let type = 0; type < 15; type++) {
      s.regionalConditions[ri(x, y)] = 0x10 | type;
      assert.doesNotThrow(() => repaintTownDistrict(s, layouts, { regionX: x, regionY: y }, r));
    }
  }
});


test('recreation removal compacts every active position, preserves unused bytes and is idempotent at all levels',()=>{
  for(let count=1;count<=7;count++)for(let removed=0;removed<count;removed++)for(const level of [0,1,13,15]) {
    const {world,state,set}=setup();set(4,level);state.recreationCount=count;
    state.recreationCoordinates.fill(197);const active=Array.from({length:count},(_,i)=>[i*8,8]);active[removed]=[32,40];
    state.recreationCoordinates.set(active.flat());const unused=state.recreationCoordinates.slice(count*2);
    assert.equal(demolishTownDistrict(world,state,site,0),true);assert.equal(state.recreationCount,count-1);
    assert.deepEqual([...state.recreationCoordinates.slice(0,(count-1)*2)],active.filter((_,i)=>i!==removed).flat());
    assert.deepEqual([...state.recreationCoordinates.slice((count-1)*2,count*2)],[0,0]);
    assert.deepEqual(state.recreationCoordinates.slice(count*2),unused);
    const before=JSON.stringify([world.regionalConditions,state]);assert.equal(demolishTownDistrict(world,state,site,0),false);assert.equal(JSON.stringify([world.regionalConditions,state]),before);
  }
  const {world,state,set}=setup();set(4,0);state.recreationCount=0;
  assert.equal(demolishTownDistrict(world,state,site,0),true);assert.equal(state.recreationCount,0);
});

test('airport demolition decrements once without underflow and protects the town origin',()=>{
  for(const count of [0,1,2])for(const level of [0,1,10,15]) {
    const {world,state,set}=setup();set(5,level);state.airportCount=count;
    const coordinates=state.recreationCoordinates.slice();assert.equal(demolishTownDistrict(world,state,site,0),true);
    assert.equal(state.airportCount,Math.max(0,count-1));assert.deepEqual(state.recreationCoordinates,coordinates);
    assert.equal(demolishTownDistrict(world,state,site,0),false);assert.equal(state.airportCount,Math.max(0,count-1));
  }
});


test('shrink then rebuild retains surviving recreation sites and carnival never repaints the demolished site',()=>{
  const {world,state,set,random}=setup();for(let i=0;i<144;i++)world.regionalConditions[i*7+1]=2;
  set(4,0);state.recreationCount=3;state.recreationCoordinates.set([24,32,32,40,40,32]);
  assert.ok(demolishTownDistrict(world,state,site,0));assert.equal(state.recreationCount,2);
  assert.ok(constructTownDistrict(world,state,layouts,{regionX:8,regionY:8},4).ok);
  assert.deepEqual([...state.recreationCoordinates.slice(0,6)],[24,32,40,32,64,64]);
  const removed=world.cells[worldIndex(35,42)].terrain;
  const animation={mode:0 as 0|1|2,lastTick:0,rodeoFrame:0,rodeoX:0,rodeoY:0};
  assert.ok(changeTownEventMap(world,state,animation,2));assert.ok(animateTownEventMap(world,state,animation,8,random));
  assert.equal(world.cells[worldIndex(35,42)].terrain,removed);
  for(const [x,y] of [[24,32],[40,32],[64,64]])assert.ok([492,526].includes(world.cells[worldIndex(x+3,y+2)].terrain));
});
