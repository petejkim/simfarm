import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { damageDisasterCell, disasterRemovesTerrain } from '../src/simulation/disaster-damage';
import { purchaseBuilding } from '../src/simulation/building-placement';
import { purchaseEquipment } from '../src/simulation/equipment-purchase';
import { purchaseSupply } from '../src/simulation/livestock-purchase';
import { purchaseAnimal } from '../src/simulation/animal-purchase';
import { FarmRandom } from '../src/simulation/random';
import { shopFixture } from './support/livestock';
import { GameSimulation } from './support/game';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const put = (b: Uint8Array, o: number, n: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).setUint16(o, n, true);
const word = (b: Uint8Array, o: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint16(o, true);

test('disaster damage pins direct cleanup, crop loss saturation, raw inventory deletion and exceptional worker debit', () => {
  const exe = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x265c8, '9a3e02d417'); exact(0x26657, '9a840e8c14'); exact(0x26662, '9a2a00d417'); exact(0x2667a, '9aaa10e624');
  exact(0x266b0, '81f9a8027303e9f80081f948037203e9ef00'); exact(0x266c2, '81e224f880ca24'); exact(0x266d5, '680001509a56005719');
  exact(0x1b7d5, '8b8744242bd203460813d28946fc0bd275053dffff7605c746fcffff8b46fc6b5e064489874424b801');
  exact(0x2672d, '509a80000313'); exact(0x26790, '509a80000313'); exact(0x267ab, '2680a42504f7');
  exact(0x26aaa, '6a006a1968f4019a2e00661a83c406'); exact(0x1c9c4, '8b46080106883e11168a3e'); exact(0x26c58, '9a7815c221');
  for (const [offset, countOffset, base, count] of [[0x868, 0x9a3, 161, 11], [0x866, 0x9a2, 150, 11], [0x904, 0x9f1, 87, 11],
    [0x906, 0x9f2, 98, 11], [0x8fa, 0x9ec, 177, 11], [0x8fe, 0x9ee, 188, 4], [0x8da, 0x9dc, 131, 16],
    [0x8fc, 0x9ed, 175, 2], [0x960, 0xa1f, 122, 4], [0x95e, 0xa1e, 172, 2], [0x980, 0xa2f, 535, 4], [0x8ce, 0x9d6, 122, 4]]) {
    assert.equal(exe.readUInt16LE(0x4ec60 + offset), base); assert.equal(exe[0x4ec60 + countOffset], count);
  }
});

test('all original farms lose every building and its stored contents without cash proceeds or a demolition fee', () => {
  let destroyed = 0;
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), w = readScenario(bytes), a = readFinancialState(bytes);
    const cash = w.farm.cash, worker = w.farm.workerExpenses, other = a.annual.otherExpenses;
    for (const b of w.buildings.filter(b => b.slot && b.active)) {
      const def = w.buildingDefinitions[b.type - 64], count = def.count, book = a.accounts.buildingBookValue;
      const result = damageDisasterCell(w, a, b.x + def.width - 1, b.y + def.height - 1, 2); assert.ok(result.ok);
      assert.equal(result.buildingSlot, b.slot); assert.equal(result.cost, 0); assert.equal(b.active, false);
      assert.equal(def.count, count - 1); assert.equal(a.accounts.buildingBookValue, (book - (def.price << 16 >> 16)) >>> 0); destroyed++;
      for (let x = 0; x < def.width; x++) for (let y = 0; y < def.height; y++) {
        const content = b.content(x * 3 + y);
        if (content.type >= 0 && content.type <= 8) assert.equal(w.equipment[content.slot].active, false);
        else if (content.type >= 160 && content.type <= 164) assert.equal(w.animals[content.slot].active, false);
        else if (content.type >= 220 && content.type <= 223) assert.equal(w.chemicals[content.slot].active, false);
        else if ((content.type >= 168 && content.type <= 183) || (content.type >= 192 && content.type <= 207)) assert.equal(w.inventory[content.slot].active, false);
      }
    }
    assert.equal(w.farm.cash, cash); assert.equal(w.farm.workerExpenses, worker); assert.equal(a.annual.otherExpenses, other);
    assert.deepEqual(w.sourceBytes, Uint8Array.from(bytes));
  }
  assert.ok(destroyed > 40);
});

test('crop hits preserve every field state and assignment, paint36 once and add saturating256 loss only for680..839', () => {
  const f = shopFixture(), w = f.state.scenario, a = f.state.finances, field = w.fields[1];
  field.bytes[7] |= 1; field.bytes[10] = field.bytes[11] = 20; field.bytes[12] = field.bytes[13] = 8;
  const cell = w.cells[worldIndex(20, 20)]; cell.overlay = 0x4000;
  for (let state = 0; state < 256; state++) {
    field.bytes[2] = state; put(field.bytes, 18, state * 256); cell.terrain = 0xf800 | 688;
    const raw = Uint8Array.from(field.bytes), expected = Math.min(65535, state * 256 + 256);
    const r = damageDisasterCell(w, a, 20, 20, 0); assert.ok(r.ok); assert.equal(r.fieldSlot, field.slot);
    put(raw, 18, expected); assert.deepEqual(field.bytes, raw); assert.equal(cell.terrain, 0xf824);
    assert.equal(cell.overlay, 0x4000); assert.equal(a.clearing.count, 0);
    damageDisasterCell(w, a, 20, 20, 0); assert.equal(word(field.bytes, 18), expected);
  }
  for (let tile = 0; tile < 2048; tile++) {
    cell.terrain = tile; put(field.bytes, 18, 1000);
    damageDisasterCell(w, a, 20, 20, 0);
    assert.equal(word(field.bytes, 18), tile >= 680 && tile < 840 ? 1256 : 1000);
  }
  assert.equal(field.active, true);
});

test('all2048 terrain IDs preserve exact disaster eligibility, flags and town ownership without invoking shoreline reconstruction', () => {
  const f = shopFixture(), w = f.state.scenario, a = f.state.finances, c = w.cells[worldIndex(20, 20)];
  const accepted = (t: number) => [[150, 171], [87, 108], [177, 191], [131, 146], [175, 176], [122, 125], [172, 173], [535, 538]].some(([low, high]) => t >= low && t <= high);
  const cash = w.farm.cash, worker = w.farm.workerExpenses, rng = { ...f.state.random };
  c.attribute = 0x34; c.overlay = 0x4800;
  for (let tile = 0; tile < 2048; tile++) {
    c.terrain = 0x3800 | tile;
    assert.equal(disasterRemovesTerrain(tile), accepted(tile)); const r = damageDisasterCell(w, a, 20, 20, -2); assert.ok(r.ok);
    assert.equal(r.terrainCleared, accepted(tile)); assert.equal(c.terrain, accepted(tile) ? 0x381a : 0x3800 | tile);
    assert.equal(c.overlay, 0x4800);
  }
  assert.equal(w.farm.cash, cash - 100); assert.equal(w.farm.workerExpenses, worker + 100); assert.equal(a.clearing.count, 0);
  assert.deepEqual(f.state.random, rng);
});

test('disaster network repair updates only ordinary roads/fences/ditches, retaining isolated, gate, valve and crossing asymmetries', () => {
  for (const [removed, neighbor, continuation, expected] of [[150, 151, 150, 150], [161, 162, 161, 161], [177, 178, 177, 177],
    [87, 88, 87, 87], [98, 99, 98, 98], [188, 178, 177, 178], [122, 88, 87, 88], [172, 151, 150, 151]]) {
    const f = shopFixture(), w = f.state.scenario, cells = w.cells;
    cells[worldIndex(20, 20)].terrain = 0x3000 | removed;
    cells[worldIndex(20, 19)].terrain = neighbor; cells[worldIndex(20, 18)].terrain = continuation;
    const r = damageDisasterCell(w, f.state.finances, 20, 20, 0); assert.ok(r.ok);
    assert.equal(cells[worldIndex(20, 19)].terrain, expected); assert.equal(cells[worldIndex(20, 20)].terrain, 0x300f);
  }
});

test('trough/feed raw destruction preserves definition counts and secondary graphics while clearing animations and saves continue exactly', () => {
  const f = shopFixture(), w = f.state.scenario, a = f.state.finances;
  for (const [type, x] of [[299, 10], [300, 12]]) assert.ok(purchaseSupply(w, a, type, x, 10, 0).ok);
  const raw = w.inventory.slice(1, 3).map(i => Uint8Array.from(i.bytes)), defs = a.accounts.otherDefinitions.map(d => Uint8Array.from(d.bytes));
  const cash = w.farm.cash, secondary = w.cells[worldIndex(12, 10)].overlay;
  for (const [slot, x] of [[1, 10], [2, 12]]) {
    const result = damageDisasterCell(w, a, x, 10, 0); assert.ok(result.ok); assert.equal(result.inventorySlot, slot);
    raw[slot - 1][10] &= ~32; assert.deepEqual(w.inventory[slot].bytes, raw[slot - 1]);
    assert.equal(w.cells[worldIndex(x, 10)].terrain & 0x7ff, 664);
  }
  assert.equal(w.cells[worldIndex(12, 10)].terrain & 0x800, 0); assert.equal(w.cells[worldIndex(12, 10)].overlay, secondary);
  assert.deepEqual(a.accounts.otherDefinitions.map(d => d.bytes), defs); assert.equal(a.clearing.count, 2); assert.equal(w.farm.cash, cash);
  const game = f.load(), restored = GameSimulation.load(game.save(4), f.crops).simulation;
  for (let day = 0; day < 35; day++) for (const g of [game, restored]) g.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().finances.clearing.count, 0); assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
});

test('paid terrain uses cash equality and wrapping worker expenses; bounds and malformed demolition reject before mutation', () => {
  const f = shopFixture(), w = f.state.scenario, a = f.state.finances, cell = w.cells[worldIndex(10, 10)]; cell.terrain = 535;
  w.farm.cash = 24; let before = JSON.stringify(f.state);
  assert.deepEqual(damageDisasterCell(w, a, 10, 10, 0), { ok: false, reason: 'insufficient-cash' }); assert.equal(JSON.stringify(f.state), before);
  for (const [x, y] of [[-1, 0], [96, 0], [0, 96], [NaN, 0], [0.5, 0]]) assert.deepEqual(damageDisasterCell(w, a, x, y, 0), { ok: false, reason: 'outside-map' });
  assert.equal(JSON.stringify(f.state), before); w.farm.cash = 25; w.farm.workerExpenses = 0xfffffff0;
  assert.ok(damageDisasterCell(w, a, 10, 10, 0).ok); assert.equal(w.farm.cash, 0); assert.equal(w.farm.workerExpenses, 9);
  w.farm.cash = 100000; assert.ok(purchaseBuilding(w, a, 67, 20, 20, 0).ok);
  assert.ok(purchaseEquipment(w, a, 0, 20, 20, 0).ok); w.buildings[1].bytes[58] = 255;
  before = JSON.stringify(f.state); assert.throws(() => damageDisasterCell(w, a, 20, 20, 0), /demolished equipment/); assert.equal(JSON.stringify(f.state), before);
});

test('pump/windmill destruction releases irrigation sources, while loose chemicals, animals and machines are not independently deleted', () => {
  const f = shopFixture(), w = f.state.scenario, a = f.state.finances;
  for (const [type, x] of [[70, 20], [71, 30]]) {
    assert.ok(purchaseBuilding(w, a, type, x, 20, 0).ok); const count = w.irrigation.sourceCount;
    assert.ok(damageDisasterCell(w, a, x, 20, 0).ok); assert.equal(w.irrigation.sourceCount, count - 1);
  }
  assert.ok(purchaseEquipment(w, a, 0, 40, 40, 0).ok);
  const bytes = Uint8Array.from(w.equipment[1].bytes); assert.ok(damageDisasterCell(w, a, 40, 40, 0).ok);
  assert.deepEqual(w.equipment[1].bytes, bytes);
  const chemical = w.chemicals[1]; put(chemical.bytes, 0, 220);
  chemical.bytes[2] = 32; chemical.bytes[5] = 50; chemical.bytes[6] = 50;
  w.chemicalDefinitions[0].count = 1;
  w.cells[worldIndex(50, 50)].terrain = 0x80f; w.cells[worldIndex(50, 50)].overlay = 0x800 | 915;
  const raw = Uint8Array.from(chemical.bytes), chemicalCell = { ...w.cells[worldIndex(50, 50)] };
  assert.ok(damageDisasterCell(w, a, 50, 50, 0).ok); assert.deepEqual(chemical.bytes, raw);
  assert.deepEqual(w.cells[worldIndex(50, 50)], chemicalCell);
  assert.ok(purchaseAnimal(w, a, new FarmRandom(f.state.random), 161, 60, 60, 0).ok);
  const animal = w.animals[1], animalBytes = Uint8Array.from(animal.bytes);
  assert.ok(damageDisasterCell(w, a, animal.x, animal.y, 0).ok); assert.deepEqual(animal.bytes, animalBytes);
});
