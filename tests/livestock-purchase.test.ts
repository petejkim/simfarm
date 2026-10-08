import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { purchaseSupply, checkSupplyPurchase } from '../src/simulation/livestock-purchase';
import { consumeAnimalSupply } from '../src/simulation/animal-needs';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
  for (const c of world.cells) { c.terrain = 15; c.overlay = 0x800; c.attribute = 0; }
  for (const a of world.animals) a.flags = 0;
  for (const b of world.buildings) b.flags = 0;
  for (const i of world.inventory) i.bytes[10] = 0;
  world.farm.cash = 100000; world.farm.autoClear = false;
  const buy = (type = 299, x = 10, y = 10, moisture = 0) => purchaseSupply(world, finances, type, x, y, moisture);
  return { world, finances, buy, cell: world.cells[worldIndex(10, 10)] };
}

test('supplies retain source allocator bytes, quantities, full images and cash-only accounting on every original farm', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x3a46f, '6a00680002'); exact(0x3a4a1, '6a00680001'); exact(0x15249, '817efe0002');
  exact(0x152a0, '26c787c4d50000'); exact(0x21a86, '268b875e0840');
  exact(0x24391, '260b060009'); exact(0x1ca0e, '817e06c409'); // Last debit category2500, no299/300 match.
  exact(0x1cf17, '26f687254c08'); exact(0x1cf1f, '837e1046'); // Only type70 bypasses final ownership.
  for (let id = 0; id < 8; id++) for (const type of [299, 300]) {
    const f = setup(id), d = f.finances.accounts.otherDefinitions[type - 288];
    const count = d.count, annual = structuredClone(f.finances.annual), statistics = structuredClone(f.finances.statistics);
    const raw = f.world.inventory[1].bytes; raw.fill(0xa5); raw[10] = 0;
    f.cell.terrain |= 0xb000; f.cell.overlay |= 0x9000;
    assert.deepEqual(f.buy(type), { ok: true, slot: 1, price: type === 299 ? 15 : 100, clearingCost: 0 });
    assert.deepEqual([...raw], [type & 255, type >> 8, 0, type === 299 ? 1 : 2, 0, 0, 0, 0, 10, 10, 32, 0xa5]);
    assert.equal(d.count, (count + 1) & 65535); assert.equal(f.world.farm.cash, 100000 - d.price);
    assert.equal(f.cell.terrain, type === 299 ? 0xb000 | 176 : 0xb800 | 15);
    assert.equal(f.cell.overlay, type === 299 ? 0x9800 : 0x9800 | 1020);
    assert.deepEqual(f.finances.annual, annual); assert.deepEqual(f.finances.statistics, statistics);
    assert.deepEqual(f.world.sourceBytes, new Uint8Array(source(`SCEN${id}.SSM`)));
  }
});

test('supply ground guards include final road ownership, generic exclusive bounds, capacity and atomic failures', () => {
  const f = setup(), state = () => JSON.stringify({ world: f.world, finances: f.finances });
  for (const type of [299, 300]) for (const terrain of [14, 31, 149, 172, 175, 176, 481, 535, 0x80f]) {
    f.cell.terrain = terrain; const before = state(); assert.equal(f.buy(type).ok, false); assert.equal(state(), before);
  }
  f.cell.terrain = 15;
  for (const [type, x, y] of [[298, 10, 10], [301, 10, 10], [299, -1, 0], [299, 0, 96], [300, 1.5, 0], [300, NaN, 0]]) {
    const before = state(); assert.equal(f.buy(type, x, y).ok, false); assert.equal(state(), before);
  }
  f.cell.overlay = 0; assert.deepEqual(f.buy(), { ok: false, reason: 'not-owned' });
  for (const terrain of [150, 160, 161, 171]) {
    f.cell.terrain = terrain; f.cell.overlay = 0; f.world.inventory[1].bytes[10] = 0;
    assert.deepEqual(f.buy(), { ok: false, reason: 'not-owned' });
    f.cell.overlay = 0x800; assert.ok(f.buy().ok);
  }
  f.world.inventory[1].bytes[10] = 0; f.cell.terrain = 150; f.cell.overlay = 0x4000;
  assert.deepEqual(f.buy(), { ok: false, reason: 'not-owned' });
  f.cell.terrain = 15; f.cell.overlay = 0x800;
  for (const i of f.world.inventory.slice(1)) { i.bytes[10] = 32; i.bytes[8] = i.bytes[9] = 1; }
  assert.deepEqual(f.buy(), { ok: false, reason: 'no-inventory-slots' });
  f.world.inventory[511].bytes[10] = 0; assert.equal((f.buy() as { slot: number }).slot, 511);
  assert.deepEqual(f.buy(), { ok: false, reason: 'occupied' });
  for (const [x, y] of [[0, 0], [95, 0], [0, 95], [95, 95]]) {
    f.world.inventory[510].bytes[10] = 0; assert.ok(f.buy(300, x, y).ok);
  }
  assert.throws(() => checkSupplyPurchase(f.world, f.finances, 299, 20, 20, 128), /state/);
});

test('supply clearing and signed prices preserve exact successful debits without failed mutation', () => {
  for (const type of [299, 300]) for (const tree of [131, 146, 535, 538]) {
    const f = setup(), d = f.finances.accounts.otherDefinitions[type - 288];
    f.world.farm.autoClear = true; f.cell.terrain = tree; d.price = 20;
    const cost = tree >= 535 ? 25 : 0, needed = Math.max(25, 20 + cost), expense = f.world.farm.workerExpenses;
    f.world.farm.cash = needed - 1; assert.deepEqual(f.buy(type), { ok: false, reason: 'insufficient-cash' });
    assert.equal(f.cell.terrain, tree); f.world.farm.cash++;
    assert.ok(f.buy(type, 10, 10, 2).ok); assert.equal(f.world.farm.cash, needed - 20 - cost);
    assert.equal(f.world.farm.workerExpenses, (expense + cost) >>> 0);
    assert.equal(f.cell.terrain & 0x7ff, type === 299 ? 176 : 17);
  }
  for (const price of [0, 32767, 32768, 65535]) {
    const f = setup(), d = f.finances.accounts.otherDefinitions[11];
    d.price = price; d.count = 65535; f.world.farm.cash = (price << 16 >> 16) >>> 0;
    assert.ok(f.buy().ok); assert.equal(f.world.farm.cash, 0); assert.equal(d.count, 0);
  }
});

test('purchased supplies feed and water actual animals, retaining empty troughs and freeing depleted feed slots', () => {
  const f = setup(), a = f.world.animals[1];
  a.flags = 32; a.bytes[0] = a.bytes[1] = 11;
  new DataView(a.bytes.buffer, a.bytes.byteOffset).setUint16(6, 161, true);
  assert.ok(f.buy().ok); assert.ok(f.buy(300, 12, 10).ok);
  a.bytes[14] = 255; assert.ok(consumeAnimalSupply(f.world, f.finances, a, 'water', 0));
  assert.equal(f.world.inventory[1].quantity, 1);
  assert.ok(consumeAnimalSupply(f.world, f.finances, a, 'water', 0));
  assert.equal(f.cell.terrain, 175); assert.ok(f.world.inventory[1].active);
  assert.equal(consumeAnimalSupply(f.world, f.finances, a, 'water', 0), false);
  const count = f.finances.accounts.otherDefinitions[12].count;
  a.bytes[13] = 255;
  for (let i = 0; i < 3; i++) assert.ok(consumeAnimalSupply(f.world, f.finances, a, 'feed', 0));
  assert.equal(f.world.inventory[2].active, false); assert.equal(f.finances.accounts.otherDefinitions[12].count, count - 1);
  assert.ok(f.buy(300, 12, 10).ok); assert.equal(f.world.inventory[2].quantity, 512);
});
