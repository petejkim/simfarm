import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { careForAnimal } from '../src/simulation/animal-care';
import { increaseAnimalNeeds } from '../src/simulation/animal-needs';
import { readCrop } from '../src/formats/crop';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { GameSimulation } from './support/game';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(type = 160, id = 4) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
  for (const animal of world.animals) animal.flags = 0;
  for (const building of world.buildings) building.flags = 0;
  for (const item of world.inventory) item.bytes[10] &= ~32;
  for (const cell of world.cells) { cell.terrain = 15; cell.overlay = 0x800; }
  const a = world.animals[255]; a.bytes.fill(0xa5); a.flags = 0x122; a.bytes[0] = a.bytes[1] = 10;
  a.bytes[6] = type; a.bytes[7] = 0; a.bytes[8] = 200; a.bytes[13] = a.bytes[14] = 0;
  const cell = world.cells[worldIndex(10, 10)]; cell.terrain = 0xb80f; cell.overlay = 0xa800 | 946;
  const definition = finances.accounts.assets.animalDefinitions[type - 160]; definition.count = 1;
  const care = () => careForAnimal(world, finances, a.slot, 0);
  const supply = (type: number, quantity: number) => {
    const item = world.inventory[type - 298], v = new DataView(item.bytes.buffer, item.bytes.byteOffset, item.bytes.byteLength);
    v.setUint16(0, type, true); v.setUint16(2, quantity, true); item.bytes[8] = 11; item.bytes[9] = type - 289; item.bytes[10] |= 32;
    finances.accounts.otherDefinitions[type - 288].count = 1;
    const cell = world.cells[worldIndex(item.x, item.y)];
    if (type === 299) cell.terrain = 176;
    else { cell.terrain |= 0x800; cell.overlay = 0x800 | 1020; }
    return item;
  };
  const store = () => {
    const building = world.buildings[1]; building.flags = 33; building.bytes[0] = 68; building.bytes[1] = 0;
    building.bytes[4] = building.bytes[5] = 10;
    for (let i = 0; i < 12; i++) building.clearContent(i);
    building.setContent(0, 946, a.type, a.slot); a.flags |= 4; a.bytes[16] = 1; a.bytes[17] = 0;
    return building;
  };
  return { world, finances, a, definition, cell, care, supply, store };
}

test('health thresholds and asymmetric warnings match source for every byte value and ordinary species', () => {
  const e = source('SIMFARM.EXE');
  assert.deepEqual([...e.subarray(0x869c8, 0x869d0)], [50, 35, 56, 56, 160, 160, 80, 64]);
  assert.equal(e.subarray(0x12b0a, 0x12b11).toString('hex'), '26388f0e647316');
  assert.equal(e.subarray(0x12bcc, 0x12bd0).toString('hex'), '76166a3b');
  for (let species = 0; species < 4; species++) for (const kind of ['water', 'feed'] as const) {
    const f = setup(160 + species), limit = kind === 'water' ? [50, 35, 56, 56][species] : [160, 160, 80, 64][species];
    const ledger = JSON.stringify({ farm: f.world.farm, annual: f.finances.annual, statistics: f.finances.statistics });
    for (let need = 0; need <= 255; need++) {
      f.a.flags = 0x122; f.definition.count = 1; f.cell.terrain = 0xb80f; f.a.bytes[8] = 200;
      f.a.bytes[13] = kind === 'feed' ? need : 0; f.a.bytes[14] = kind === 'water' ? need : 0;
      const before = [...f.a.bytes], count = f.finances.statistics.fieldPresence[6], result = f.care(), died = need > limit;
      assert.equal(f.finances.statistics.fieldPresence[6], Math.min(255, count + Number(died)));
      const warning = need > Math.floor(limit / 2) && (kind === 'feed' || need < limit);
      const notices = [...(warning ? [kind === 'water' ? 57 : 59] : []), ...(died ? [kind === 'water' ? 58 : 56] : [])];
      assert.deepEqual(result, { died: died ? kind : null, notices });
      assert.equal(f.a.conditionByte, 200 - Number(warning)); assert.equal(f.a.active, !died);
      assert.equal(f.definition.count, died ? 0 : 1); assert.equal(f.cell.terrain, died ? 0xb00f : 0xb80f);
      assert.equal(f.cell.overlay, 0xa800 | 946); // Removal clears occupancy, not the retained image.
      const expected = [...before]; expected[8] -= Number(warning); if (died) expected[2] &= ~32;
      assert.deepEqual([...f.a.bytes], expected);
    }
    f.finances.statistics.fieldPresence[6] = 0;
    assert.equal(JSON.stringify({ farm: f.world.farm, annual: f.finances.annual, statistics: f.finances.statistics }), ledger);
  }
});

test('water is consumed before feed, partial supply satisfies the full need, and water death short-circuits feeding', () => {
  for (let id = 0; id < 8; id++) {
    const f = setup(160, id); f.a.bytes[13] = f.a.bytes[14] = 255;
    const water = f.supply(299, 1), feed = f.supply(300, 1);
    assert.deepEqual(f.care(), { died: null, notices: [] });
    assert.equal(f.a.bytes[13], 0); assert.equal(f.a.bytes[14], 0); assert.equal(f.a.conditionByte, 200);
    assert.equal(water.quantity, 0); assert.equal(water.active, true); assert.equal(feed.active, false);
    f.a.bytes[13] = f.a.bytes[14] = 255; const spare = f.supply(300, 512);
    assert.deepEqual(f.care(), { died: 'water', notices: [58] });
    assert.equal(spare.quantity, 512); assert.equal(f.a.bytes[13], 255);
  }
  const f = setup(); f.a.bytes[13] = 81; f.a.bytes[14] = 26; f.a.bytes[8] = 1;
  assert.deepEqual(f.care(), { died: null, notices: [57, 59] }); assert.equal(f.a.conditionByte, 0);
  f.a.bytes[13] = f.a.bytes[14] = 0;
  assert.deepEqual(f.care(), { died: null, notices: [] }); assert.equal(f.a.active, true);
});

test('stored recovery is gated by water need and saturates condition without consuming nearby supplies', () => {
  for (const condition of [0, 224, 225, 226, 255]) {
    const f = setup(); const b = f.store(); f.a.bytes[8] = condition; f.a.bytes[13] = 255; f.a.bytes[14] = 1;
    const water = f.supply(299, 100), feed = f.supply(300, 100), before = [...b.bytes];
    assert.deepEqual(f.care(), { died: null, notices: [] });
    assert.equal(f.a.conditionByte, Math.min(255, condition + 30)); assert.equal(f.a.bytes[13], 0); assert.equal(f.a.bytes[14], 0);
    assert.equal(water.quantity, 100); assert.equal(feed.quantity, 100); assert.deepEqual([...b.bytes], before);
    const recovered = f.a.conditionByte; f.care(); assert.equal(f.a.conditionByte, recovered);
  }
  const f = setup(); const b = f.store(); f.a.bytes[13] = 161; f.a.bytes[14] = 0;
  const flags = b.flags;
  assert.deepEqual(f.care(), { died: 'feed', notices: [59, 56] });
  assert.deepEqual(b.content(0), { graphic: 217, type: -1, slot: 0 }); assert.equal(b.flags, flags);
  assert.equal(f.cell.terrain, 217); assert.equal(f.definition.count, 0); assert.equal(f.a.flags, 0x106);
});

test('care rejects invalid animal, count and stored references before changing health, supplies or terrain', () => {
  const f = setup(); f.a.bytes[13] = f.a.bytes[14] = 255; const water = f.supply(299, 100);
  const state = () => JSON.stringify({ animal: [...f.a.bytes], quantity: water.quantity, cells: f.world.cells, finances: f.finances });
  for (const slot of [0, -1, 256, 1.5, NaN]) { const before = state(); assert.throws(() => careForAnimal(f.world, f.finances, slot, 0)); assert.equal(state(), before); }
  f.definition.count = 0;
  let before = state(); assert.throws(f.care, /definition/); assert.equal(state(), before); f.definition.count = 1;
  const b = f.store(); b.clearContent(0);
  before = state(); assert.throws(f.care, /storage mismatch/); assert.equal(state(), before);
  b.setContent(0, 946, f.a.type, f.a.slot); f.a.bytes[16] = 126;
  before = state(); assert.throws(f.care, /storage/); assert.equal(state(), before);
});

test('native saves preserve care bytes, depleted supplies and exact subsequent needs and death', () => {
  const f = setup(); f.a.bytes[13] = 75; f.a.bytes[14] = 20;
  f.supply(299, 21); f.supply(300, 76);
  const crops = f.world.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const { state } = readNativeSave(new GameSimulation(f.world, crops).save(4)); state.finances = f.finances;
  careForAnimal(state.scenario, state.finances, 255, 0);
  const saved = writeNativeSave(state, 4), restored = readNativeSave(saved).state;
  assert.deepEqual(JSON.parse(writeNativeSave(restored, 4)), JSON.parse(saved));
  for (let day = 0; day < 30; day++) {
    const results = [state, restored].map(s => {
      if (!s.scenario.animals[255].active) return null;
      increaseAnimalNeeds(s.scenario, 31);
      return careForAnimal(s.scenario, s.finances, 255, 0);
    });
    assert.deepEqual(results[0], results[1]);
  }
  assert.equal(state.scenario.animals[255].active, false);
  assert.equal(state.scenario.inventory[1].quantity, 0); assert.equal(state.scenario.inventory[1].active, true);
  assert.equal(state.scenario.inventory[2].active, false);
  assert.deepEqual(JSON.parse(writeNativeSave(restored, 4)), JSON.parse(writeNativeSave(state, 4)));
});

test('death increments the original report byte with saturation, not a sound request, and saves nonboolean counts', () => {
  const e = source('SIMFARM.EXE');
  assert.equal(e.subarray(0x12b66, 0x12b6d).toString('hex'), '6a069a5609781c');
  assert.equal(e.subarray(0x1f2e6, 0x1f2f3).toString('hex'), '80bf8e44ff7304fe878e44c9cb');
  const f = setup(), crops = f.world.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const { state } = readNativeSave(new GameSimulation(f.world, crops).save(4));
  state.finances = f.finances; state.finances.statistics.distinctFieldStatuses = 3;
  for (const count of [0, 1, 2, 253, 254, 255]) {
    f.a.flags = 32; f.definition.count = 1; f.a.bytes[14] = 255; f.finances.statistics.fieldPresence[6] = count;
    assert.deepEqual(f.care(), { died: 'water', notices: [58] });
    assert.equal(f.finances.statistics.fieldPresence[6], Math.min(255, count + 1));
    assert.equal(f.finances.statistics.distinctFieldStatuses, 3);
    assert.deepEqual(readNativeSave(writeNativeSave(state, 4)).state.finances.statistics, f.finances.statistics);
  }
  for (const count of [-1, 256, NaN]) {
    f.a.flags = 32; f.definition.count = 1; f.finances.statistics.fieldPresence[6] = count;
    assert.throws(f.care, /report counter/); assert.equal(f.a.active, true); assert.equal(f.definition.count, 1);
  }
});
