import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { purchaseEquipment, checkEquipmentPurchase, PURCHASABLE_EQUIPMENT } from '../src/simulation/equipment-purchase';
import { EQUIPMENT_GRAPHICS } from '../src/simulation/equipment-world';
import { purchaseBuilding } from '../src/simulation/building-placement';
import { reserveEquipment } from '../src/simulation/equipment-rental';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
  for (const c of world.cells) Object.assign(c, { terrain: 0xa00f, overlay: 0x8800, attribute: 0 });
  for (const b of world.buildings) b.flags = 0;
  for (const e of world.equipment) e.flags = 0;
  world.farm.cash = 100000; world.farm.autoClear = false; world.farm.timerTicks = 0x1234;
  return { world, finances };
}

test('purchase evidence pins original constructor, quantity/count, unsigned asset posting, expense and storage dispatch', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x3a2ea, '9ace005f0d'); exact(0x3a303, '018fbc6d');
  exact(0x3a312, 'f766082bd28e0666cc260106503e261116523e');
  exact(0x1c912, '837e06007c14837e063f7f0e8b460801067c3e11167e3e');
  exact(0x1cde3, '9a5606d417'); exact(0xf98d, '8e064ac726a19e138e0646c7268987d8a6');
  exact(0x22451, '998e0664c9263b164a3e776d7207263b06483e7364');
  for (const [graphic, base] of Object.entries(EQUIPMENT_GRAPHICS)) assert.equal(e.readUInt16LE(0x4ec60 + 0x85e + Number(graphic) * 2), base);
});

test('all source farms buy all eight ground types with exact retained bytes, cells and wrapping accounts', () => {
  for (let id = 0; id < 8; id++) for (const type of PURCHASABLE_EQUIPMENT) {
    const { world, finances } = setup(id), e = world.equipment[1], d = world.equipmentDefinitions[type];
    e.bytes.fill(0xa5); e.flags = 0;
    d.ownedCount = 65535; finances.accounts.equipmentExpenses = 0xfffffff0; finances.accounts.assets.equipmentBookValue = 0xfffffff0;
    const before = world.cells.map(c => ({ ...c }));
    assert.deepEqual(purchaseEquipment(world, finances, type, 10, 10, 0), { ok: true, slot: 1, price: d.price, clearingCost: 0, buildingSlot: null });
    const expected = new Uint8Array(56).fill(0xa5), v = new DataView(expected.buffer);
    v.setUint16(0, type, true); v.setUint16(2, 160, true);
    expected[5] = expected[6] = expected[50] = expected[51] = 10;
    for (const o of [4, 15, 16, 17, 22, 42, 48, 52, 55]) expected[o] = 0;
    for (const o of [18, 20, 32, 34, 36, 44, 46]) v.setUint16(o, 0, true);
    v.setUint16(30, 0x1234, true); expected[49] = 1; expected[53] = d.width; expected[54] = d.height;
    assert.deepEqual(e.bytes, expected); assert.equal(d.ownedCount, 0);
    assert.equal(world.farm.cash, 100000 - d.price);
    assert.equal(finances.accounts.equipmentExpenses, (0xfffffff0 + d.price) >>> 0);
    assert.equal(finances.accounts.assets.equipmentBookValue, (0xfffffff0 + d.price) >>> 0);
    for (let dy = 0; dy < d.height; dy++) before[worldIndex(10, 10 + dy)] = { terrain: 0xa80f, overlay: 0x8800 | EQUIPMENT_GRAPHICS[d.graphic] + dy, attribute: 0 };
    assert.deepEqual(world.cells, before); assert.deepEqual(world.sourceBytes, Uint8Array.from(source(`SCEN${id}.SSM`)));
  }
});

test('purchase rejection is atomic at map, ownership, terrain, capacity and signed-price boundaries', () => {
  const { world, finances } = setup();
  const reject = (type: number, x: number, y: number, reason: string) => {
    const before = JSON.stringify({ world, finances });
    assert.deepEqual(purchaseEquipment(world, finances, type, x, y, 0), { ok: false, reason });
    assert.equal(JSON.stringify({ world, finances }), before);
  };
  for (const type of [-1, 8, 9, 0.5, NaN]) reject(type, 10, 10, 'unsupported-equipment');
  for (const [x, y] of [[-1, 0], [0, 95], [NaN, 0], [0, 0.5], [96, 0]]) reject(4, x, y, 'outside-map');
  const c = world.cells[worldIndex(10, 10)]; c.overlay = 0; reject(0, 10, 10, 'not-owned');
  c.overlay = 0x4800; reject(0, 10, 10, 'not-owned'); c.overlay = 0x800;
  for (const tile of [14, 31, 149, 172, 440, 535, 0x80f]) { c.terrain = tile; reject(0, 10, 10, 'blocked-terrain'); }
  c.terrain = 15;
  for (const tile of [15, 30, 150, 171]) { c.terrain = tile; assert.ok(checkEquipmentPurchase(world, 0, 10, 10, 0).ok); }
  world.farm.cash = 400; assert.ok(checkEquipmentPurchase(world, 0, 10, 10, 0).ok); reject(4, 10, 10, 'insufficient-cash');
  world.farm.cash = 401; world.cells[worldIndex(10, 11)].overlay = 0; assert.ok(checkEquipmentPurchase(world, 4, 10, 10, 0).ok);
  new DataView(world.equipmentDefinitions[0].bytes.buffer).setUint16(6, 0x8000, true);
  world.farm.cash = 0xffff7fff; reject(0, 10, 10, 'insufficient-cash');
  world.farm.cash++; assert.ok(purchaseEquipment(world, finances, 0, 10, 10, 0).ok); assert.equal(world.farm.cash, 0);
  for (const e of world.equipment.slice(1)) e.flags = 32;
  reject(0, 20, 20, 'no-equipment-slots');
});

test('single-cell and multi-cell clearing preserve source affordability/order and paint cleared ground under machinery', () => {
  const { world, finances } = setup(), c = world.cells[worldIndex(10, 10)], next = world.cells[worldIndex(10, 11)];
  world.farm.autoClear = true; c.terrain = 535; world.farm.cash = 424;
  const before = JSON.stringify({ world, finances });
  assert.deepEqual(purchaseEquipment(world, finances, 0, 10, 10, 0), { ok: false, reason: 'insufficient-cash' });
  assert.equal(JSON.stringify({ world, finances }), before);
  world.farm.cash = 425; const workers = world.farm.workerExpenses;
  assert.ok(purchaseEquipment(world, finances, 0, 10, 10, 0).ok); assert.equal(world.farm.cash, 0);
  assert.equal(world.farm.workerExpenses, workers + 25); assert.equal(c.terrain, 0x80f);
  world.equipment[1].flags = 0; c.terrain = 535; next.terrain = 131; world.farm.cash = 449;
  assert.deepEqual(checkEquipmentPurchase(world, 4, 10, 10, 0), { ok: false, reason: 'insufficient-cash' });
  world.farm.cash = 450; assert.ok(purchaseEquipment(world, finances, 4, 10, 10, 0).ok); assert.equal(world.farm.cash, 25);
  assert.equal(next.terrain, 0x80f);
  c.terrain = 131; world.equipment[1].flags = 0; world.farm.cash = 400;
  assert.ok(purchaseEquipment(world, finances, 0, 10, 10, 0).ok); assert.equal(world.farm.cash, 0);
});

test('direct storage buys first-fit rotated equipment, rejects incompatible/full buildings and feeds the owned allocator', () => {
  const { world, finances } = setup();
  const built = purchaseBuilding(world, finances, 66, 10, 10, 0); assert.ok(built.ok);
  const b = world.buildings[built.slot];
  // Leave a 2x1 gap that forces the 1x2 harvester to rotate.
  for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) b.setContent(x * 3 + y, 217, -2, 0);
  b.clearContent(0); b.clearContent(3);
  const result = purchaseEquipment(world, finances, 4, 12, 11, 0); assert.ok(result.ok);
  assert.equal(result.buildingSlot, b.slot);
  const e = world.equipment[result.slot]; assert.deepEqual([e.x, e.y, e.direction, e.flags], [10, 10, 2, 164]);
  assert.deepEqual([e.bytes[50], e.bytes[51]], [12, 11]); // Constructor home retains requested coordinates.
  assert.deepEqual(b.content(0), { graphic: 862, type: 4, slot: e.slot });
  assert.deepEqual(b.content(3), { graphic: 863, type: 4, slot: e.slot });
  const prior = JSON.stringify({ world, finances });
  assert.deepEqual(purchaseEquipment(world, finances, 0, 10, 10, 0), { ok: false, reason: 'no-storage-space' });
  assert.equal(JSON.stringify({ world, finances }), prior);
  assert.equal(reserveEquipment(world, 4, 20, 20, 0), e); assert.equal(e.flags & 4, 0); assert.equal(e.flags & 64, 0);
  assert.equal(b.content(0).type, -1); assert.equal(b.content(3).type, -1);
  assert.ok(purchaseBuilding(world, finances, 64, 20, 20, 0).ok);
  assert.deepEqual(checkEquipmentPurchase(world, 0, 20, 20, 0), { ok: false, reason: 'no-storage-space' });
});
