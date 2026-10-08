import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Binary } from '../src/formats/binary';
import { worldIndex, readScenario } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { purchaseBuilding } from '../src/simulation/building-placement';
import { fillWaterStorage, withdrawStoredWater, storedWater, ageBuildings } from '../src/simulation/water-storage';
import { ageInventoryAndRefillTroughs } from '../src/simulation/weekly-inventory';
import { FarmRandom } from '../src/simulation/random';
import { purchaseSupply } from '../src/simulation/livestock-purchase';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
  for (const c of world.cells) { c.terrain = 15; c.overlay = 0x800; c.attribute = 0; }
  for (const b of world.buildings) b.flags = 0;
  for (const a of world.animals) a.flags = 0;
  for (const i of world.inventory) i.bytes[10] = 0;
  world.farm.cash = 100000; world.farm.autoClear = false;
  const result = purchaseBuilding(world, finances, 72, 10, 10, 0); assert.ok(result.ok);
  const b = world.buildings[result.slot], v = new Binary(b.bytes).view;
  const random = new FarmRandom({ visual: 1792, simulation: 2, bounded: 99 });
  return { world, finances, b, v, random, cell: world.cells[worldIndex(10, 10)] };
}

test('water storage pins original initializer, production, weekly refill and wear instructions and all source definitions', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x1a0fc, '26c7870a84d900'); exact(0xc4e6, '2683870a8432');
  exact(0xc2e0, '6a40'); exact(0xc2ef, 'd1e0'); exact(0xc08c, '2681bf0884e001');
  exact(0xc09c, '243f3c07'); exact(0xc344, '26ff87c4d5');
  assert.equal(e.readUInt16LE(0x4ec60 + 0x906), 98); assert.equal(e[0x4ec60 + 0x9f2], 11);
  for (let id = 0; id < 8; id++) {
    const f = setup(id), def = f.world.buildingDefinitions[8];
    assert.deepEqual([def.graphic, def.price, def.width, def.height], [103, 200, 1, 1]);
    assert.equal(storedWater(f.b), 217); // Shared storage-cell initializer, not an invented empty tank.
    assert.equal(f.cell.terrain, 481); assert.equal(f.world.farm.cash, 99800);
    const count = f.world.buildingDefinitions[8].count;
    f.cell.terrain = 0xa1e1; f.b.flags |= 1; f.world.cells[worldIndex(11, 10)].terrain = 0xb800 | 98;
    fillWaterStorage(f.world); assert.equal(storedWater(f.b), 255); assert.equal(f.cell.terrain, 86);
    assert.equal(withdrawStoredWater(f.world, 64), 64); assert.equal(storedWater(f.b), 191);
    assert.equal(f.cell.terrain, 85); assert.equal(f.world.buildingDefinitions[8].count, count);
  }
});

test('water storage reads only cardinal wet ditches, respects flags/condition, preserves word arithmetic and bounds neighbors', () => {
  for (const tile of [87, 97, 98, 99, 108, 109, 120, 122, 176]) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const f = setup(); f.v.setUint16(10, 0, true); f.world.cells[worldIndex(10 + dx, 10 + dy)].terrain = tile;
    fillWaterStorage(f.world); assert.equal(storedWater(f.b), tile >= 98 && tile <= 108 ? 50 : 0);
  }
  for (const amount of [0, 205, 206, 217, 254, 255, 65485, 65486, 65535]) {
    const f = setup(); f.v.setUint16(10, amount, true); f.world.cells[worldIndex(11, 10)].terrain = 98;
    fillWaterStorage(f.world); assert.equal(storedWater(f.b), Math.min(255, (amount + 50) & 65535));
  }
  for (const flag of [0, 1, 2, 64]) for (const condition of [254, 255]) {
    const f = setup(); f.v.setUint16(10, 0, true); f.b.flags = 32 | flag; f.b.bytes[6] = condition;
    f.world.cells[worldIndex(11, 10)].terrain = 98;
    fillWaterStorage(f.world); assert.equal(storedWater(f.b), flag === 64 || condition === 255 ? 0 : 50);
  }
  for (const [x, y] of [[0, 0], [95, 95], [0, 95], [95, 0], [1, 0]]) {
    const f = setup(); f.b.bytes[4] = x; f.b.bytes[5] = y; f.v.setUint16(10, 0, true);
    // At(1,0) the original -2 read aliases(0,95); native must not treat it as adjacent.
    f.world.cells[worldIndex(0, 95)].terrain = 98; fillWaterStorage(f.world); assert.equal(storedWater(f.b), 0);
    const nx = x === 95 ? x - 1 : x + 1; f.world.cells[worldIndex(nx, y)].terrain = 98;
    fillWaterStorage(f.world); assert.equal(storedWater(f.b), 50);
  }
  const f = setup(); f.b.bytes[4] = 96; const before = Uint8Array.from(f.b.bytes);
  assert.throws(() => fillWaterStorage(f.world), /position/); assert.deepEqual(f.b.bytes, before);
});

test('weekly refills use inventory/building slot order and preserve surplus, partial supply, full troughs and financial state', () => {
  const f = setup(); f.v.setUint16(10, 50, true);
  const result = purchaseBuilding(f.world, f.finances, 72, 11, 10, 0); assert.ok(result.ok);
  const other = f.world.buildings[result.slot]; new Binary(other.bytes).view.setUint16(10, 100, true);
  for (let x = 20; x < 24; x++) {
    assert.ok(purchaseSupply(f.world, f.finances, 299, x, 20, 0).ok);
    const i = f.world.inventory[x - 19]; if (x !== 21) new Binary(i.bytes).view.setUint16(2, 0, true);
    f.world.cells[worldIndex(x, 20)].terrain = 0xa000 | (x === 21 ? 176 : 175);
  }
  const finances = JSON.stringify(f.finances), cash = f.world.farm.cash;
  ageInventoryAndRefillTroughs(f.world);
  assert.deepEqual(f.world.inventory.slice(1, 5).map(i => i.quantity), [128, 256, 128, 44]);
  assert.equal(storedWater(f.b), 0); assert.equal(storedWater(other), 0);
  for (let x = 20; x < 24; x++) assert.equal(f.world.cells[worldIndex(x, 20)].terrain, 0xa000 | 176);
  assert.equal(JSON.stringify(f.finances), finances); assert.equal(f.world.farm.cash, cash);
  const i = f.world.inventory[1]; new Binary(i.bytes).view.setUint16(2, 0, true);
  f.world.cells[worldIndex(20, 20)].terrain = 175; ageInventoryAndRefillTroughs(f.world);
  assert.equal(i.quantity, 0); assert.equal(f.world.cells[worldIndex(20, 20)].terrain, 175);
  assert.throws(() => withdrawStoredWater(f.world, -1), /request/);
  const before = JSON.stringify(f.world); i.bytes[8] = 96;
  const invalid = JSON.stringify(f.world); assert.notEqual(invalid, before);
  assert.throws(() => ageInventoryAndRefillTroughs(f.world), /position/); assert.equal(JSON.stringify(f.world), invalid);
});

test('weekly inventory loss saturates per source storage flags, leaves supply loss unchanged and wraps the age word', () => {
  for (const type of [167, 168, 191, 192, 215, 216, 299, 300]) for (const stored of [false, true]) for (const loss of [0, 65528, 65529, 65530, 65535]) {
    const f = setup(), i = f.world.inventory[1], v = new Binary(i.bytes).view;
    v.setUint16(0, type, true); v.setUint16(2, 1, true); v.setUint16(4, loss, true); v.setUint16(6, 65535, true);
    i.bytes[8] = i.bytes[9] = 20; i.bytes[10] = 32 | (stored ? 4 : 0);
    ageInventoryAndRefillTroughs(f.world);
    assert.equal(i.loss, type >= 168 && type <= 215 && loss < 65530 ? Math.min(65530, loss + (stored ? 1 : 4)) : loss);
    assert.equal(new Binary(i.bytes).u16(6), 0);
  }
});

test('weekly building aging preserves flags, threshold RNG, water failure and word wrap', () => {
  for (const age of [0, 3, 479, 480, 1019, 1020, 65535]) {
    const f = setup(); f.v.setUint16(8, age, true);
    const before = f.random.snapshot(), after = (age + 1) & 65535;
    const failed = ageBuildings(f.world, f.random);
    assert.equal(new Binary(f.b.bytes).u16(8), after);
    if (after > 480) {
      assert.deepEqual(failed, [f.b.slot]); assert.equal(f.b.bytes[6], 255); assert.equal(storedWater(f.b), 0);
      assert.equal(f.b.flags, 34); assert.equal(f.cell.terrain, 149); assert.notDeepEqual(f.random.snapshot(), before);
      const bytes = Uint8Array.from(f.b.bytes), rng = f.random.snapshot(); ageBuildings(f.world, f.random);
      assert.deepEqual(f.b.bytes, bytes); assert.deepEqual(f.random.snapshot(), rng);
    } else { assert.equal(f.b.bytes[6], after >>> 2); assert.deepEqual(f.random.snapshot(), before); }
  }
  const f = setup(); f.b.bytes[0] = 64; f.v.setUint16(8, 1019, true);
  assert.deepEqual(ageBuildings(f.world, f.random), []); assert.equal(f.b.bytes[6], 255);
  assert.equal(f.random.snapshot().visual, 1792);
});

test('water construction uses its one-cell town and clearing guards without requiring cash after free clearing', () => {
  const f = setup(), cell = f.world.cells[worldIndex(20, 20)]; f.world.farm.autoClear = true;
  cell.terrain = 131; f.world.farm.cash = 200;
  assert.ok(purchaseBuilding(f.world, f.finances, 72, 20, 20, 0).ok); assert.equal(f.world.farm.cash, 0);
  const next = f.world.cells[worldIndex(21, 20)]; next.terrain = 535; f.world.farm.cash = 224;
  assert.deepEqual(purchaseBuilding(f.world, f.finances, 72, 21, 20, 0), { ok: false, reason: 'insufficient-cash' });
  assert.equal(next.terrain, 535); f.world.farm.cash++;
  assert.ok(purchaseBuilding(f.world, f.finances, 72, 21, 20, 0).ok); assert.equal(f.world.farm.cash, 0);
  f.world.farm.cash = 200; f.world.cells[worldIndex(22, 20)].overlay = 0x4800;
  assert.deepEqual(purchaseBuilding(f.world, f.finances, 72, 22, 20, 0), { ok: false, reason: 'not-owned' });
});
