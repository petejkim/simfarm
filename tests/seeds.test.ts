import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { findBuilding } from '../src/simulation/building-storage';
import { consumeSeed } from '../src/simulation/seeds';

const source = (id: number) => readFileSync(new URL(`../../simfarm-dos/SCEN${id}.SSM`, import.meta.url));

test('inventory and goods definitions decode every original farm without byte aliasing, including SF-017', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(id), before = Uint8Array.from(bytes), s = readScenario(bytes);
    assert.equal(s.inventory.length, 512);
    assert.equal(s.inventory.filter(i => i.active).length, [9, 0, 0, 25, 0, 79, 64, 26][id]);
    assert.equal(s.seedDefinitions.length, 16); assert.equal(s.cropDefinitions.length, 24);
    assert.equal(s.farm.autoBuySeeds, true);
    assert.deepEqual(s.seedDefinitions.map(d => d.count), id === 6 ? [0, 0, 0, 0, 0, 0, 0, 0, 18, 0, 0, 0, 0, 0, 0, 18] : Array(16).fill(0));
    s.inventory[1].bytes.fill(0); s.seedDefinitions[0].count = 123; s.cropDefinitions[0].price = 42;
    assert.deepEqual(Uint8Array.from(bytes), before);
  }
  const bad = source(6); bad.writeUInt16LE(512, 0x8281);
  assert.throws(() => readScenario(bad), /inventory count/);
});

test('all 36 saved seed items in SCEN6 are consumed once and removed from storage before any purchase', () => {
  const world = readScenario(source(6)), cash = world.farm.cash;
  const items = world.inventory.filter(i => i.active && i.type >= 192 && i.type < 208);
  assert.equal(items.length, 36);
  for (const item of items) {
    const building = findBuilding(world, item.x, item.y)!;
    assert.ok(building); const flags = building.flags;
    const count = world.seedDefinitions[item.type - 192].count;
    assert.deepEqual(consumeSeed(world, item.type - 192, 0), { ok: true, source: 'stored', cost: 0 });
    assert.equal(item.active, false); assert.equal(world.seedDefinitions[item.type - 192].count, count - 1);
    assert.equal(building.content((item.x - building.x) * 3 + item.y - building.y).type, -1);
    assert.equal(building.flags, flags);
  }
  assert.equal(world.farm.cash, cash);
  const cost = world.seedDefinitions[8].price + 20;
  assert.deepEqual(consumeSeed(world, 8, 0), { ok: true, source: 'purchased', cost });
  assert.equal(world.farm.cash, cash - cost); assert.equal(world.farm.seedExpenses, cost);
});

test('seed buying respects settings and funds, and outdoor seed restores original grass arithmetic', () => {
  const world = readScenario(source(4));
  world.farm.autoBuySeeds = false;
  assert.deepEqual(consumeSeed(world, 0, 3), { ok: false, reason: 'no-seeds' });
  world.farm.autoBuySeeds = true; const price = world.seedDefinitions[0].price + 20;
  world.farm.cash = price - 1;
  assert.deepEqual(consumeSeed(world, 0, 3), { ok: false, reason: 'insufficient-funds' });
  assert.equal(world.farm.cash, price - 1);
  world.farm.cash = price;
  assert.equal(consumeSeed(world, 0, 3).ok, true); assert.equal(world.farm.cash, 0);
  const item = world.inventory[1]; item.bytes[0] = 192; item.bytes[10] = 32;
  item.bytes[8] = 1; item.bytes[9] = 1; world.seedDefinitions[0].count = 1;
  const cell = world.cells[worldIndex(1, 1)]; cell.attribute = 12; cell.terrain = 0xffff; cell.overlay = 0xa123;
  assert.equal(consumeSeed(world, 0, 3).ok, true);
  assert.equal(cell.terrain, 21); assert.equal(cell.overlay, 0xa123); assert.equal(item.active, false);
});

test('inconsistent seed count or storage reference fails before changing original inventory or map (SF-016)', () => {
  const world = readScenario(source(6)), def = world.seedDefinitions[8];
  def.count = 0;
  const before = world.cells.map(c => ({ ...c })), bytes = Uint8Array.from(world.inventory[1].bytes);
  assert.throws(() => consumeSeed(world, 8, 0), /count does not match/);
  assert.deepEqual(world.cells, before); assert.deepEqual(world.inventory[1].bytes, bytes);
  def.count = 18;
  const item = world.inventory[1], building = findBuilding(world, item.x, item.y)!;
  building.bytes[58 + (item.x - building.x) * 3 + item.y - building.y] = 255;
  assert.throws(() => consumeSeed(world, 8, 0), /building contents/);
  assert.deepEqual(world.inventory[1].bytes, bytes); assert.equal(def.count, 18);
});
