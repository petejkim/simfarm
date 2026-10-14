import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { reserveHarvestStorage, deliverStoredHarvest, createInventoryItem } from '../src/simulation/harvest-storage';
import { sellStoredHarvest, storedHarvestValue } from '../src/simulation/harvest-sale';
import { toggleBuildingInterior } from '../src/simulation/building-storage';

const farm = (id = 4) => readScenario(readFileSync(new URL(`../../simfarm-dos/SCEN${id}.SSM`, import.meta.url)));
function stored(id = 4, cropSlot = 0, loss = 0) {
  const world = farm(id), reservation = reserveHarvestStorage(world, 40, 40)!;
  const item = deliverStoredHarvest(world, reservation.buildingSlot, cropSlot, 289, loss)!;
  const building = world.buildings[reservation.buildingSlot];
  return { world, item, building, index: (item.x - building.x) * 3 + item.y - building.y };
}

test('stored harvest valuation uses crop trade prices and original loss/word arithmetic', () => {
  const { world, item } = stored();
  world.cropDefinitions[0].price = 150; world.harvestDefinitions[0].price = 999;
  assert.equal(storedHarvestValue(item, world), 4334);
  world.cropDefinitions[0].price = 151;
  assert.equal(storedHarvestValue(item, world), 4334);
  const b = new DataView(item.bytes.buffer, item.bytes.byteOffset, item.bytes.byteLength);
  b.setUint16(4, 51000, true); assert.equal(storedHarvestValue(item, world), 961);
  b.setUint16(4, 51001, true); assert.equal(storedHarvestValue(item, world), 0);
  b.setUint16(4, 0, true); b.setUint16(2, 1000, true); world.cropDefinitions[0].price = 1000;
  assert.equal(storedHarvestValue(item, world), 34463); // SF-020 low-word product.
});

test('sales remove every crop type from original barns, free storage and credit exactly once in cash', () => {
  for (let id = 0; id < 6; id++) for (let crop = 0; crop < 16; crop++) {
    const { world, item, building, index } = stored(id, crop);
    if (crop & 1) toggleBuildingInterior(building, world);
    const flags = building.flags, before = Uint8Array.from(item.bytes), otherItems = world.inventory.map(i => Uint8Array.from(i.bytes));
    const cash = world.farm.cash, income = world.farm.cropIncome, sales = world.farm.salesAccumulator;
    const value = storedHarvestValue(item, world);
    assert.deepEqual(sellStoredHarvest(world, item.slot, 3), { ok: true, slot: item.slot, value });
    assert.equal(world.farm.cash, cash + value);
    assert.equal(world.farm.salesAccumulator, sales + value);
    assert.equal(world.farm.cropIncome, income + value); // SF-026: one posting.
    before[10] &= ~32; assert.deepEqual(item.bytes, before);
    for (const other of world.inventory) if (other.slot !== item.slot) assert.deepEqual(other.bytes, otherItems[other.slot]);
    assert.equal(world.harvestDefinitions[crop].count, 0);
    assert.deepEqual(building.content(index), { type: -1, graphic: 217, slot: 0 });
    assert.equal(building.flags, flags);
    if (flags & 1) assert.equal(world.cells[worldIndex(item.x, item.y)].terrain, 217);
    assert.deepEqual(sellStoredHarvest(world, item.slot, 3), { ok: false, reason: 'invalid-item' });
    assert.equal(world.farm.cash, cash + value);
    assert.ok(reserveHarvestStorage(world, item.x, item.y));
  }
});

test('worthless crop sales still remove their lot; cash cap and original ledger wraps remain', () => {
  const { world, item } = stored(4, 0, 65535);
  const cash = world.farm.cash;
  assert.deepEqual(sellStoredHarvest(world, item.slot, 0), { ok: true, slot: item.slot, value: 0 });
  assert.equal(item.active, false); assert.equal(world.farm.cash, cash);
  const second = stored(); second.world.cropDefinitions[0].price = 150;
  second.world.farm.cash = 9_999_999; second.world.farm.cropIncome = 0xfffffff0; second.world.farm.salesAccumulator = 0xffffffff;
  sellStoredHarvest(second.world, second.item.slot, 0);
  assert.equal(second.world.farm.cash, 9_999_999);
  assert.equal(second.world.farm.cropIncome, 4318); assert.equal(second.world.farm.salesAccumulator, 4333);
});

test('inconsistent inventory and storage fail before money, map or item mutation (SF-027)', () => {
  for (const corruption of ['count', 'slot', 'type', 'position']) {
    const { world, item, building, index } = stored();
    if (corruption === 'count') world.harvestDefinitions[0].count = 0;
    if (corruption === 'slot') building.setContent(index, 816, 168, item.slot + 1);
    if (corruption === 'type') building.setContent(index, 816, 169, item.slot);
    if (corruption === 'position') item.bytes[8] = 255;
    const before = JSON.stringify(world);
    assert.deepEqual(sellStoredHarvest(world, item.slot, 0), { ok: false, reason: 'inconsistent-inventory' });
    assert.equal(JSON.stringify(world), before);
  }
  const world = farm();
  for (const slot of [0, -1, 512, 1.5, NaN]) assert.deepEqual(sellStoredHarvest(world, slot, 0), { ok: false, reason: 'invalid-item' });
  const seed = createInventoryItem(world, 192, 1, 0, 0, 0)!;
  assert.deepEqual(sellStoredHarvest(world, seed.slot, 0), { ok: false, reason: 'invalid-item' });
});

test('outdoor sale restores grass while retaining upper flags and unknown inventory bytes', () => {
  const world = farm(6), item = createInventoryItem(world, 168, 10, 0, 0, 0)!;
  world.harvestDefinitions[0].count++;
  item.bytes[11] = 197; item.bytes[10] |= 4;
  const cell = world.cells[worldIndex(0, 0)]; cell.terrain = 0xf800 | 816; cell.attribute = 12; cell.overlay = 0xabcd;
  sellStoredHarvest(world, item.slot, 2);
  assert.equal(cell.terrain, 0xf800 | 20); assert.equal(cell.overlay, 0xabcd);
  assert.equal(item.bytes[10], 4); assert.equal(item.bytes[11], 197);
});
