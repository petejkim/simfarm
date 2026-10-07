import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Binary } from '../src/formats/binary';
import { readScenario, terrainTile, worldIndex } from '../src/formats/scenario';
import { purchaseLand, quoteLand } from '../src/simulation/land';
import { checkFieldPlacement, createField } from '../src/simulation/field-placement';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const farm = (id = 4) => readScenario(source(`SCEN${id}.SSM`));

test('land valuation uses original base, region ownership, fertility nibble, signed moisture and first-word surcharge', () => {
  const exe = new Binary(source('SIMFARM.EXE'));
  assert.equal(exe.u16(0x846f0 + 0x7516), 15000);
  const world = farm(); world.regionalConditions.fill(0);
  for (const cell of world.cells) { cell.terrain = 15; cell.overlay = 0xffff; }
  assert.deepEqual(quoteLand(world, 0, 0, 0), { ownership: 0, fertility: 0, price: 15000 });
  world.regionalConditions[8] = 2; // Any nonzero ownership, not only player-owned land, adds 100.
  world.regionalConditions[6] = 0xaf;
  assert.deepEqual(quoteLand(world, 0, 0, 8), { ownership: 0, fertility: 10, price: 15388 });
  world.cells[worldIndex(7, 7)].terrain |= 0x1000;
  assert.equal(quoteLand(world, 0, 0, 8)!.price, 15888);
  assert.equal(quoteLand(world, 0, 0, 255)!.price, 15744);
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) world.cells[worldIndex(x, y)].terrain |= 0x1000;
  assert.equal(quoteLand(world, 0, 0, 127)!.price, 49292);
  assert.equal(quoteLand(world, 0, 0, 128)!.price, 45212);
});

test('purchase rejects unavailable plots, invalid coordinates and insufficient funds without mutation', () => {
  const world = farm(); world.regionalConditions[1] = 0;
  const price = quoteLand(world, 0, 0, 8)!.price;
  world.farm.cash = price - 1;
  const before = JSON.stringify(world);
  assert.deepEqual(purchaseLand(world, 0, 0, 8), { ok: false, reason: 'insufficient-cash' });
  for (const [x, y] of [[-1, 0], [12, 0], [0, 12], [0, 0.5], [NaN, 0], [0, Infinity]]) {
    assert.equal(quoteLand(world, x, y, 8), null);
    assert.deepEqual(purchaseLand(world, x, y, 8), { ok: false, reason: 'outside-map' });
  }
  assert.equal(JSON.stringify(world), before);
  world.farm.cash = price;
  world.farm.landExpenses = 0xfffffff0;
  assert.equal(purchaseLand(world, 0, 0, 8).ok, true);
  assert.equal(world.farm.cash, 0); assert.equal(world.farm.landExpenses, price - 16);
  const after = JSON.stringify(world);
  assert.deepEqual(purchaseLand(world, 0, 0, 8), { ok: false, reason: 'not-for-sale' });
  assert.equal(JSON.stringify(world), after);
  for (const owner of [2, 128, 255]) {
    world.regionalConditions[1] = owner;
    assert.deepEqual(purchaseLand(world, 0, 0, 8), { ok: false, reason: 'not-for-sale' });
    assert.equal(world.farm.cash, 0);
  }
});

test('land ledger preserves the original duplicate-destination load (SF-014)', () => {
  const bytes = source('SCEN4.SSM'), b = new Binary(bytes);
  b.view.setUint32(0x216ac, 123, true); b.view.setUint32(0x216b4, 456, true);
  assert.equal(readScenario(bytes).farm.landExpenses, 456);
  assert.equal(readScenario(bytes).farm.workerExpenses, 0);
});

test('fence connections match executable shapes for all direction masks and retain gates and upper flags', () => {
  const exe = new Binary(source('SIMFARM.EXE'));
  assert.deepEqual([...exe.slice(0x846f0 + 0x56c6, 12)], [78, 0, 11, 0, 80, 0, 36, 0, 255, 255, 255, 255]);
  assert.equal(exe.u16(0x4ec60 + 0x8fa), 177); assert.equal(exe.u16(0x4ec60 + 0x8fe), 188);
  const neighbors = [[8, 7], [9, 8], [8, 9], [7, 8]];
  for (let mask = 0; mask < 16; mask++) for (const gate of [false, true]) {
    const world = farm(); world.regionalConditions.fill(0);
    for (const cell of world.cells) { cell.terrain = 0; cell.overlay = 0; }
    const center = world.cells[worldIndex(8, 8)]; center.terrain = 0xf800 | 15;
    neighbors.forEach(([x, y], i) => { if (mask & (1 << i)) world.cells[worldIndex(x, y)].terrain = 0xa800 | (gate ? 188 + i : 177); });
    assert.equal(purchaseLand(world, 1, 1, 8).ok, true);
    assert.equal(center.terrain, 0xf800 | (177 + exe.u16(0x846f0 + 0x59c4 + mask * 2)));
    neighbors.forEach(([x, y], i) => {
      if (!(mask & (1 << i))) return;
      const opposite = 1 << ((i + 2) % 4);
      assert.equal(world.cells[worldIndex(x, y)].terrain,
        0xa800 | (gate ? 188 + i : 177 + exe.u16(0x846f0 + 0x59c4 + opposite * 2)));
    });
  }
});

test('purchase perimeter respects four map corners, existing ownership and obstacle categories', () => {
  for (const [rx, ry] of [[0, 0], [0, 11], [11, 0], [11, 11]]) {
    const world = farm(); world.regionalConditions.fill(0);
    for (const cell of world.cells) { cell.terrain = 15; cell.overlay = 0xa003; cell.attribute = 53; }
    const beforeRegions = Uint8Array.from(world.regionalConditions);
    assert.equal(purchaseLand(world, rx, ry, 8).ok, true);
    beforeRegions[(rx * 12 + ry) * 7 + 1] = 1; assert.deepEqual(world.regionalConditions, beforeRegions);
    for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) {
      const inside = (x >> 3) === rx && (y >> 3) === ry, edge = x % 8 === 0 || x % 8 === 7 || y % 8 === 0 || y % 8 === 7;
      const cell = world.cells[worldIndex(x, y)];
      assert.equal(cell.overlay, inside ? 0xa803 : 0xa003); assert.equal(cell.attribute, 53);
      assert.equal(terrainTile(cell) >= 177 && terrainTile(cell) <= 187, inside && edge);
    }
  }
  const world = farm(); world.regionalConditions.fill(0);
  for (const cell of world.cells) { cell.terrain = 15; cell.overlay = 0; }
  world.regionalConditions[(1 * 12 + 0) * 7 + 1] = 1; // North side already adjoins owned region.
  for (let y = 9; y < 15; y++) world.cells[worldIndex(8, y)].terrain = [131, 146, 535, 538, 31, 0x0800 | 15][y - 9];
  purchaseLand(world, 1, 1, 8);
  for (let x = 9; x < 15; x++) assert.equal(terrainTile(world.cells[worldIndex(x, 8)]), 15);
  for (let y = 9; y < 13; y++) assert.ok(terrainTile(world.cells[worldIndex(8, y)]) >= 177);
  assert.equal(world.cells[worldIndex(8, 13)].terrain, 31);
  assert.ok(world.cells[worldIndex(8, 14)].terrain & 0x0800); // Fence routine retains visible-overlay flag.
});

test('all eight original farms can afford a fenced plot and create an 8×8 field with automatic clearing', () => {
  const prices = [18944, 18144, 18044, 16444, 18060, 18544, 17844, 17344];
  for (let id = 0; id < 8; id++) {
    const world = farm(id), y = id === 4 ? 2 : 0, cash = world.farm.cash;
    assert.deepEqual(purchaseLand(world, 0, y, 8), { ok: true, regionX: 0, regionY: y, price: prices[id] });
    assert.equal(world.farm.cash, cash - prices[id]);
    assert.deepEqual(checkFieldPlacement(world, 0, y * 8), { ok: false, reason: 'blocked-terrain' });
    world.farm.autoClear = true;
    const result = createField(world, 0, y * 8);
    assert.ok(result.ok); assert.equal(world.fields[result.slot].state, 0);
    assert.equal(world.fields[result.slot].width, 8); assert.equal(world.fields[result.slot].height, 8);
  }
});
