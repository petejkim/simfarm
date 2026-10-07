import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { checkBuildingPlacement, purchaseBuilding, PURCHASABLE_BUILDINGS } from '../src/simulation/building-placement';
import { BUILDING_GRAPHICS } from '../src/simulation/building-storage';
import { reserveHarvestStorage, deliverStoredHarvest } from '../src/simulation/harvest-storage';
import { sellStoredHarvest } from '../src/simulation/harvest-sale';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) world.cells[worldIndex(x, y)] = { terrain: 0xa00f, overlay: 0xfabc, attribute: 0 };
  world.farm.cash = 100000; world.farm.autoClear = true;
  return { world, finances };
}

test('construction evidence pins allocation, debit, category clearing, origin ownership and row-major paint', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x1cbed, '9ab410e624'); exact(0x1cc18, '9a1a0f8c14');
  exact(0x1cf17, '26f687254c08'); exact(0x1cf1f, '837e1046');
  exact(0x1cf80, '034efa0bc1'); exact(0x1d047, 'ff46faff46f4');
  exact(0x26fce, '6a006a199a0600661a'); exact(0x26aaa, '6a006a1968f4019a2e00661a');
  exact(0x1cca0, '8b46fe');
  for (const [offset, n] of [[0x85e, 15], [0x866, 150], [0x868, 161], [0x980, 535], [0x8da, 131]])
    assert.equal(e.readUInt16LE(0x4ec60 + offset), n);
  for (const [graphic, tile] of Object.entries(BUILDING_GRAPHICS)) assert.equal(e.readUInt16LE(0x4ec60 + 0x85e + Number(graphic) * 2), tile);
});

test('all eight farms allocate original records, retain unknown byte, post accounts and paint all supported footprints', () => {
  for (let id = 0; id < 8; id++) for (const type of PURCHASABLE_BUILDINGS) {
    const { world, finances } = setup(id), d = world.buildingDefinitions[type - 64];
    const free = world.buildings.find(b => b.slot && !b.active)!;
    free.bytes.fill(0xa5); free.flags = 0;
    const count = d.count, cells = world.cells.map(c => ({ ...c })), oldExpense = finances.annual.ds3e90;
    finances.accounts.buildingBookValue = 0xfffffff0;
    const result = purchaseBuilding(world, finances, type, 0, 0, 0);
    assert.deepEqual(result, { ok: true, slot: free.slot, price: d.price, clearingCost: 0 });
    assert.deepEqual(Array.from(free.bytes.slice(0, 10)), [type, 0, 32, 0, 0, 0, 0, 0xa5, 0, 0]);
    for (let i = 0; i < 12; i++) assert.deepEqual(free.content(i), { graphic: 217, type: -1, slot: 0 });
    assert.equal(d.count, count + 1); assert.equal(world.farm.cash, 100000 - d.price);
    assert.equal(finances.annual.ds3e90, (oldExpense + d.price) >>> 0);
    assert.equal(finances.accounts.buildingBookValue, (0xfffffff0 + d.price) >>> 0);
    for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) {
      const before = cells[worldIndex(x, y)], after = world.cells[worldIndex(x, y)];
      assert.deepEqual(after, x < d.width && y < d.height
        ? { ...before, terrain: 0xa000 | (BUILDING_GRAPHICS[d.graphic] + y * d.width + x) } : before);
    }
    assert.deepEqual(world.sourceBytes, Uint8Array.from(source(`SCEN${id}.SSM`)));
  }
});

test('rejected construction is atomic at bounds, terrain, ownership, capacity and sparse occupied records', () => {
  const { world, finances } = setup();
  function reject(type: number, x: number, y: number, reason: string) {
    const before = JSON.stringify({ world, finances });
    assert.deepEqual(purchaseBuilding(world, finances, type, x, y, 0), { ok: false, reason });
    assert.equal(JSON.stringify({ world, finances }), before);
  }
  for (const type of [63, 70, 71, 72, 73, 65.5, NaN]) reject(type, 0, 0, 'unsupported-building');
  for (const [x, y] of [[-1, 0], [95, 0], [0, 95], [0.5, 0], [0, NaN], [Infinity, 0]]) reject(65, x, y, 'outside-map');
  world.cells[0].overlay = 0; reject(65, 0, 0, 'not-owned'); world.cells[0].overlay = 0x800;
  for (const tile of [14, 31, 36, 149, 172, 440, 0x800 | 15, 534, 539]) {
    world.cells[0].terrain = tile; reject(65, 0, 0, 'blocked-terrain');
  }
  world.cells[0].terrain = 15;
  // Inactive low records must not hide high active ones or block retained coordinates.
  const b = world.buildings[126]; b.bytes[0] = 65; b.bytes[1] = 0; b.bytes[4] = b.bytes[5] = 1; b.flags = 32;
  reject(65, 0, 0, 'occupied'); b.flags = 0;
  assert.ok(checkBuildingPlacement(world, 65, 0, 0, 0).ok);
  for (const b of world.buildings.slice(1)) { b.bytes[0] = 64; b.bytes[1] = 0; b.bytes[4] = b.bytes[5] = 90; b.flags = 32; }
  reject(65, 0, 0, 'no-building-slots');
});

test('original cash equality, origin-only ownership and exact terrain endpoints are retained', () => {
  const { world, finances } = setup();
  const check = (type: number) => checkBuildingPlacement(world, type, 0, 0, 0);
  world.farm.cash = 2400; assert.deepEqual(check(65), { ok: false, reason: 'insufficient-cash' });
  world.farm.cash++; assert.ok(check(65).ok);
  world.farm.cash = 799; assert.deepEqual(check(64), { ok: false, reason: 'insufficient-cash' });
  world.farm.cash = 800; assert.ok(check(64).ok);
  world.farm.cash = 100000;
  for (const tile of [15, 30, 150, 160, 161, 171]) { world.cells[0].terrain = tile; assert.ok(check(65).ok); }
  world.cells[worldIndex(1, 1)].overlay = 0; assert.ok(check(65).ok); // SF-085, retained.
  for (let x = 94; x < 96; x++) for (let y = 94; y < 96; y++) world.cells[worldIndex(x, y)] = { terrain: 15, overlay: 0x800, attribute: 0 };
  assert.ok(purchaseBuilding(world, finances, 65, 94, 94, 0).ok);
});

test('automatic clearing uses source families, post-purchase affordability and row order without partial charges', () => {
  const { world, finances } = setup();
  world.cells[0].terrain = 535; world.cells[worldIndex(1, 0)].terrain = 131;
  const check = () => checkBuildingPlacement(world, 65, 0, 0, 0);
  world.farm.autoClear = false; assert.deepEqual(check(), { ok: false, reason: 'blocked-terrain' }); world.farm.autoClear = true;
  // Paid first cell leaves <25 for the free tree; aggregate fees alone are insufficient.
  world.farm.cash = 2449; const before = JSON.stringify({ world, finances });
  assert.deepEqual(purchaseBuilding(world, finances, 65, 0, 0, 0), { ok: false, reason: 'insufficient-cash' });
  assert.equal(JSON.stringify({ world, finances }), before);
  world.farm.cash = 2450; assert.deepEqual(check(), { ok: true, slot: world.buildings.find(b => b.slot && !b.active)!.slot, price: 2400, clearingCost: 25 });
  world.cells[0].attribute = 64; assert.deepEqual(check(), { ok: false, reason: 'blocked-terrain' }); world.cells[0].attribute = 0;
  const workers = world.farm.workerExpenses; assert.ok(purchaseBuilding(world, finances, 65, 0, 0, 0).ok);
  assert.equal(world.farm.cash, 25); assert.equal(world.farm.workerExpenses, workers + 25);
});

test('new crop storage reserves, receives and sells harvest with original capacity and slot stride', () => {
  for (const type of [64, 65]) {
    const { world, finances } = setup();
    const result = purchaseBuilding(world, finances, type, 0, 0, 0); assert.ok(result.ok);
    const b = world.buildings[result.slot], delivered = [];
    for (let i = 0; i < (type === 64 ? 1 : 4); i++) {
      const reservation = reserveHarvestStorage(world, 0, 0)!; assert.equal(reservation.buildingSlot, b.slot);
      assert.deepEqual([reservation.x, reservation.y], [Math.floor(i / 2), i % 2]);
      const item = deliverStoredHarvest(world, b.slot, 0, 500, 0)!; assert.ok(item); delivered.push(item);
      assert.deepEqual(b.content(reservation.x * 3 + reservation.y), { graphic: 816, type: 168, slot: item.slot });
    }
    assert.notEqual(reserveHarvestStorage(world, 0, 0)?.buildingSlot, b.slot);
    const priorCash = world.farm.cash;
    for (const item of delivered) assert.ok(sellStoredHarvest(world, item.slot, 0).ok);
    assert.ok(world.farm.cash > priorCash); assert.equal(reserveHarvestStorage(world, 0, 0)?.buildingSlot, b.slot);
  }
});
