import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { purchaseAnimal, checkAnimalPurchase, PURCHASABLE_ANIMALS } from '../src/simulation/animal-purchase';
import { sellAnimal } from '../src/simulation/asset-sale';
import { FarmRandom } from '../src/simulation/random';
import { readCrop } from '../src/formats/crop';
import { readNativeSave } from '../src/formats/native-save';
import { GameSimulation } from './support/game';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const b = source(`SCEN${id}.SSM`), world = readScenario(b), finances = readFinancialState(b);
  for (const cell of world.cells) { cell.terrain = 15; cell.overlay = 0x800; cell.attribute = 0; }
  for (const a of world.animals) a.flags = 0;
  for (const b of world.buildings) b.flags = 0;
  for (const d of finances.accounts.assets.animalDefinitions) d.count = 0;
  world.farm.cash = 100000; world.farm.autoClear = false;
  const random = new FarmRandom({ visual: 0x1234, simulation: 2, bounded: 99 });
  const buy = (type = 160, x = 10, y = 10, moisture = 0) => purchaseAnimal(world, finances, random, type, x, y, moisture);
  return { world, finances, random, buy, cell: world.cells[worldIndex(10, 10)] };
}

test('animal purchase pins source initializer, random streams, price/account postings and original definitions', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x11a8d, '817efe0001'); exact(0x11ac7, '9a7d00fd052407'); exact(0x11b2d, '9ad000fd05a801');
  exact(0x11b1a, '8b5e0a8a87f421'); exact(0x1cb59, '8946fe995250');
  exact(0x1c973, '0106983e11169a3e'); exact(0x3a3c5, '2601065c3e2611165e3e');
  assert.deepEqual([...e.subarray(0x86984, 0x86988)], [48, 40, 44, 24]);
  for (let id = 0; id < 8; id++) for (const type of PURCHASABLE_ANIMALS) {
    const { world, finances, random, buy, cell } = setup(id), d = finances.accounts.assets.animalDefinitions[type - 160];
    const original = Uint8Array.from(world.sourceBytes), before = { expense: finances.annual.livestockExpenses, asset: finances.statistics.ds3e5c };
    const raw = world.animals[1].bytes; raw.fill(0xa5); world.animals[1].flags = 0;
    const expected = Uint8Array.from(raw), v = new DataView(expected.buffer);
    expected[0] = expected[1] = 10; v.setUint16(2, 34, true); expected[4] = 2; expected[5] = 1; v.setUint16(6, type, true);
    expected[8] = 255; v.setUint16(10, 0, true); expected[12] = 1; expected[13] = expected[14] = 0;
    v.setUint16(16, 0, true); expected[18] = 0; v.setUint16(20, 0, true);
    v.setUint16(26, [48, 40, 44, 24][type - 160], true); expected[28] = 0;
    cell.terrain |= 0xb000; cell.overlay |= 0x9000;
    assert.deepEqual(buy(type), { ok: true, slot: 1, price: d.price, clearingCost: 0 });
    assert.deepEqual(raw, expected); assert.deepEqual(random.snapshot(), { visual: 0x9712, simulation: 1, bounded: 99 });
    assert.equal(cell.terrain, 0xb80f); assert.equal(cell.overlay, 0x9800 | [946, 962, 978, 994][type - 160]);
    assert.equal(d.count, 1); assert.equal(world.farm.cash, 100000 - d.price);
    assert.equal(finances.annual.livestockExpenses, (before.expense + d.price) >>> 0);
    assert.equal(finances.statistics.ds3e5c, (before.asset + d.price) >>> 0);
    assert.deepEqual(world.sourceBytes, original);
  }
});

test('animal purchases preflight ownership, occupied ground, sparse/full slots and every map boundary without consuming randomness', () => {
  const { world, finances, random, buy, cell } = setup();
  const state = () => JSON.stringify({ world, finances, random: random.snapshot() });
  for (const [type, x, y] of [[159, 10, 10], [164, 10, 10], [167, 10, 10], [160, -1, 0], [160, 96, 0], [160, 1.5, 0], [160, 0, NaN]]) {
    const saved = state(); assert.equal(buy(type, x, y).ok, false); assert.equal(state(), saved);
  }
  for (const terrain of [14, 31, 32, 87, 149, 172, 481, 535, 0x80f]) {
    cell.terrain = terrain; const saved = state(); assert.equal(buy().ok, false); assert.equal(state(), saved);
  }
  cell.terrain = 15;
  for (const overlay of [0, 0x4800]) { cell.overlay = overlay; assert.deepEqual(buy(), { ok: false, reason: 'not-owned' }); }
  cell.overlay = 0x800;
  for (const a of world.animals.slice(1)) { a.flags = 32; a.bytes[0] = a.bytes[1] = 1; }
  assert.deepEqual(buy(), { ok: false, reason: 'no-animal-slots' }); world.animals[255].flags = 0;
  assert.deepEqual(buy(), { ok: true, slot: 255, price: 880, clearingCost: 0 });
  assert.deepEqual(buy(), { ok: false, reason: 'occupied' });
  for (const [x, y] of [[0, 0], [0, 95], [95, 0], [95, 95]]) { world.animals[254].flags = 0; assert.ok(buy(163, x, y).ok); }
  assert.throws(() => checkAnimalPurchase(world, finances, 160, 20, 20, 128), /state/);
});

test('single-cell clearing precedes the animal price and signed word prices retain original unsigned affordability and wrapped ledgers', () => {
  for (const tree of [131, 146, 535, 538]) {
    const { world, finances, buy, cell } = setup(); world.farm.autoClear = true; cell.terrain = tree;
    const clearing = tree >= 535 ? 25 : 0, price = finances.accounts.assets.animalDefinitions[0].price;
    world.farm.cash = price + clearing - 1;
    assert.deepEqual(buy(), { ok: false, reason: 'insufficient-cash' }); assert.equal(cell.terrain, tree);
    world.farm.cash++; assert.ok(buy(160, 10, 10, 2).ok); assert.equal(world.farm.cash, 0);
    assert.equal(cell.terrain & 0x7ff, 17);
  }
  // Free tree clearing requires25 BEFORE the purchase, not25 after a20 purchase.
  const f = setup(); f.world.farm.autoClear = true; f.cell.terrain = 131;
  f.finances.accounts.assets.animalDefinitions[0].price = 20; f.world.farm.cash = 24;
  assert.equal(f.buy().ok, false); f.world.farm.cash = 25; assert.ok(f.buy().ok); assert.equal(f.world.farm.cash, 5);
  for (const price of [0, 32767, 32768, 65535]) {
    const { world, finances, buy } = setup(); finances.accounts.assets.animalDefinitions[0].price = price;
    const amount = (price << 16 >> 16) >>> 0; world.farm.cash = amount;
    finances.annual.livestockExpenses = finances.statistics.ds3e5c = 0xffffffff;
    assert.ok(buy().ok); assert.equal(world.farm.cash, 0);
    assert.equal(finances.annual.livestockExpenses, (0xffffffff + amount) >>> 0);
    assert.equal(finances.statistics.ds3e5c, (0xffffffff + amount) >>> 0);
  }
});

test('purchased animals persist complete records, accounts and generators through native saves and sell through original primitives', () => {
  const { world, finances, random, buy, cell } = setup();
  const crops = world.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  assert.ok(buy(162).ok);
  const base = new GameSimulation(world, crops), { state } = readNativeSave(base.save(4));
  state.finances = finances; state.random = random.snapshot();
  const game = new GameSimulation(state.scenario, crops, state.random, state), saved = game.save(4);
  const restored = GameSimulation.load(saved, crops).simulation;
  assert.deepEqual(JSON.parse(restored.save(4)), JSON.parse(saved));
  const copy = restored.getSnapshot(); assert.deepEqual(copy.scenario.animals[1].bytes, world.animals[1].bytes);
  assert.equal(copy.finances.statistics.ds3e5c, finances.statistics.ds3e5c);
  const assetBefore = finances.statistics.ds3e5c, flags = world.animals[1].flags;
  assert.deepEqual(sellAnimal(world, finances.accounts.assets, 1), { ok: true, slot: 1, value: 380 });
  assert.equal(world.farm.cash, 100000); assert.equal(cell.terrain, 15);
  assert.equal(world.animals[1].flags, flags & ~32); assert.equal(finances.accounts.assets.animalDefinitions[2].count, 0);
  assert.equal(finances.statistics.ds3e5c, assetBefore); // Source generic removal has no matching posting; lifecycle remains under investigation.
});
