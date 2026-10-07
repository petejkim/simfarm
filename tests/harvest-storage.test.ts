import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { Binary } from '../src/formats/binary';
import { GameSimulation } from './support/game';
import { readCrop } from '../src/formats/crop';
import { createInventoryItem, deliverStoredHarvest, releaseHarvestReservation, reserveHarvestStorage } from '../src/simulation/harvest-storage';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const farm = (id = 1) => readScenario(source(`SCEN${id}.SSM`));

test('harvest goods definitions match saved offsets and original tile table; snapshots own their bytes', () => {
  const exe = new Binary(source('SIMFARM.EXE'));
  for (let id = 0; id < 8; id++) {
    const s = farm(id), saved = source(`SCEN${id}.SSM`);
    s.harvestDefinitions.forEach((d, slot) => {
      assert.deepEqual(d.bytes, Uint8Array.from(saved.subarray(0x20d18 + slot * 18, 0x20d2a + slot * 18)));
      assert.equal(d.type, 168 + slot); assert.equal(d.width, 1); assert.equal(d.height, 1);
      assert.equal(exe.u16(0x4f4be + d.graphic * 2), 816 + slot);
    });
  }
  const s = farm(), crops = s.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const game = new GameSimulation(s, crops);
  s.harvestDefinitions[0].count = 70;
  assert.equal(game.getSnapshot().scenario.harvestDefinitions[0].count, 0);
  game.getSnapshot().scenario.harvestDefinitions[0].count = 42;
  game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.harvestDefinitions[0].count, 0);
  const bad = source('SCEN1.SSM'); bad[0x20d18 + 8] = 0;
  assert.throws(() => readScenario(bad), /goods definition/);
});

test('inventory creation chooses first free slot, initializes known words and retains unnamed byte 11', () => {
  const s = farm(); s.inventory[1].bytes.fill(0xff); s.inventory[1].bytes[10] = 0;
  const item = createInventoryItem(s, 168, 65535, 51000, 95, 0)!;
  assert.equal(item.slot, 1); assert.equal(item.quantity, 65535); assert.equal(item.loss, 51000);
  assert.equal(item.bytes[10], 32); assert.equal(item.bytes[11], 255);
  assert.equal(new Binary(item.bytes).u16(6), 0);
  assert.equal(createInventoryItem(s, 169, 42, 0, 0, 95)!.slot, 2);
  for (const record of s.inventory.slice(1)) record.bytes[10] |= 32;
  s.inventory[511].bytes[10] &= ~32;
  assert.equal(createInventoryItem(s, 169, 42, 0, 0, 95)!.slot, 511);
  assert.equal(createInventoryItem(s, 169, 42, 0, 0, 95), undefined);
  assert.throws(() => createInventoryItem(s, 168, 65536, 0, 0, 0), /Invalid inventory/);
  assert.throws(() => createInventoryItem(s, 168, 0, 0, 96, 0), /Invalid inventory/);
});

test('storage chooses nearest eligible building, first slot on ties, and fills reservations in column order', () => {
  const s = farm(), a = s.buildings[12], b = s.buildings[13];
  assert.deepEqual(reserveHarvestStorage(s, a.x, a.y), { buildingSlot: a.slot, x: 0, y: 0 });
  assert.equal(a.content(0).type, -2);
  assert.deepEqual(reserveHarvestStorage(s, a.x, a.y), { buildingSlot: a.slot, x: 0, y: 1 });
  // Two equidistant barns; the first still has spare cells.
  assert.equal(reserveHarvestStorage(s, a.x, a.y + 1)!.buildingSlot, a.slot);
  const def = s.buildingDefinitions[a.type - 64];
  for (let x = 0; x < def.width; x++) for (let y = 0; y < def.height; y++) a.setContent(x * 3 + y, 217, -2, 0);
  assert.equal(reserveHarvestStorage(s, a.x, a.y)!.buildingSlot, b.slot);
  a.flags |= 1; // Keep the interior open to verify its actual tile pixels.
  const first = deliverStoredHarvest(s, a.slot, 3, 304, 12345)!;
  const second = deliverStoredHarvest(s, a.slot, 4, 990, 2000)!;
  assert.deepEqual([first.x, first.y, second.x, second.y], [a.x, a.y, a.x, a.y + 1]);
  assert.deepEqual(a.content(0), { type: 171, slot: first.slot, graphic: 819 });
  assert.equal(s.cells[worldIndex(a.x, a.y)].terrain, 819);
  assert.equal(s.harvestDefinitions[3].count, 1); assert.equal(first.quantity, 304); assert.equal(first.loss, 12345);
});

test('all original farm storage can fill without duplicate reservations, then fails cleanly', () => {
  for (let id = 0; id < 8; id++) {
    const s = farm(id), cash = s.farm.cash;
    const capacity = s.buildings.filter(b => b.active && [64, 65].includes(b.type)).reduce((n, b) => {
      const d = s.buildingDefinitions[b.type - 64]; return n + d.width * d.height;
    }, 0);
    for (let i = 0; i < capacity; i++) {
      const r = reserveHarvestStorage(s, 48, 48)!; assert.ok(r, `farm ${id}, item ${i}`);
      assert.ok(deliverStoredHarvest(s, r.buildingSlot, i % 16, 100, 0));
    }
    assert.equal(reserveHarvestStorage(s, 48, 48), undefined);
    assert.equal(s.harvestDefinitions.reduce((n, d) => n + d.count, 0), capacity);
    assert.equal(s.farm.cash, cash);
  }
});

test('unrepresentable inventory references and exhaustion cannot mutate storage; reservations can be released (SF-021/022)', () => {
  const s = farm(), r = reserveHarvestStorage(s, 48, 48)!, b = s.buildings[r.buildingSlot];
  for (const item of s.inventory.slice(1, 256)) item.bytes[10] |= 32;
  const before = Uint8Array.from(b.bytes), unused = Uint8Array.from(s.inventory[256].bytes);
  assert.equal(deliverStoredHarvest(s, b.slot, 0, 100, 0), undefined);
  assert.deepEqual(b.bytes, before); assert.deepEqual(s.inventory[256].bytes, unused);
  assert.equal(s.harvestDefinitions[0].count, 0);
  for (const item of s.inventory.slice(256)) item.bytes[10] |= 32;
  assert.equal(deliverStoredHarvest(s, b.slot, 0, 100, 0), undefined);
  releaseHarvestReservation(s, r);
  assert.equal(b.content(r.x * 3 + r.y).type, -1);
  assert.deepEqual(reserveHarvestStorage(s, 48, 48), r);
});
