import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, terrainTile, worldIndex } from '../src/formats/scenario';
import { readAssetSaleState } from '../src/formats/asset-sale';
import { readOtherGoodsDefinitions } from '../src/formats/inventory';
import { createClearingEffects, updateClearingEffects } from '../src/simulation/clearing-effects';
import { findOverlappingField, removeField } from '../src/simulation/field-removal';
import { quoteLand, quoteLandSale } from '../src/simulation/land';
import { sellLand } from '../src/simulation/land-sale';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const setup = (id = 4) => {
  const bytes = source(`SCEN${id}.SSM`);
  return { world: readScenario(bytes), effects: createClearingEffects(), state: { assets: readAssetSaleState(bytes),
    buildingBookValue: 100000, otherDefinitions: readOtherGoodsDefinitions(bytes), landIncome: bytes.readUInt32LE(0x21698) } };
};
const put = (b: Uint8Array, o: number, n: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).setUint16(o, n, true);

test('land sale source pins ownership, accounting, demolition order, tree range and cleanup mask', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, hex: string) => assert.equal(e.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x3c9e4, '2680bfbd0001'); exact(0x3ca13, '68d007'); exact(0x3ca16, '9ac801661a');
  exact(0x3ca1e, '807e0a00'); exact(0x3ca2e, '260106443e'); exact(0x3ca42, '260106683e');
  exact(0x3ca65, '26c687bd0000'); exact(0x3caa1, '9a2a00d417'); exact(0x3cab9, '9aaa10e624');
  exact(0x3cada, '2680a7254cb7'); exact(0x3cb7b, 'e85c0b'); exact(0x45d2b, '68683e');
  assert.equal(e.readUInt16LE(0x4ec60 + 0x860), 39); assert.equal(e[0x4ec60 + 0x99f], 30);
  exact(0x45ed8, '689f2d681000'); exact(0x45ef0, '689f2d681200');
  exact(0x1db1a, '2639061000'); exact(0x1db28, '2639061200');
  const homes = [[8, 3], [8, 9], [2, 1], [3, 3], [7, 6], [6, 5], [5, 3], [9, 6]];
  homes.forEach(([x, y], id) => {
    const bytes = source(`SCEN${id}.SSM`);
    assert.deepEqual([bytes.readUInt16LE(0x216e0), bytes.readUInt16LE(0x216e2)], [x, y]);
    assert.equal(readScenario(bytes).regionalConditions[(x * 12 + y) * 7 + 1], 1);
  });
});

for (let id = 0; id < 8; id++) test(`every owned region in original farm ${id + 1} sells with original accounting and separate field teardown`, () => {
    const original = setup(id).world;
    for (let rx = 0; rx < 12; rx++) for (let ry = 0; ry < 12; ry++) {
      if (original.regionalConditions[(rx * 12 + ry) * 7 + 1] !== 1) continue;
      const { world, state, effects } = setup(id), quote = quoteLandSale(world, rx, ry, 8)!; // SF-158 native sale quote
      assert.equal(quote.price, (quoteLand(world, rx, ry, 8)!.price - 100) & 0xffff);
      const farm = { ...world.farm }, fields = world.fields.map(f => Uint8Array.from(f.bytes));
      const schedule = Uint8Array.from(world.schedule.bytes), raw = Uint8Array.from(world.sourceBytes), oldIncome = state.landIncome;
      const result = sellLand(world, state, rx, ry, effects, 8, false);
      assert.equal(result.ok, true, `SCEN${id} (${rx},${ry})`);
      if (!result.ok) throw new Error('Expected sale');
      assert.equal(result.price, quote.price); assert.equal(world.farm.cash, Math.min(9999999, (farm.cash + quote.price) >>> 0));
      assert.equal(state.landIncome, (oldIncome + quote.price) >>> 0); assert.equal(world.farm.salesAccumulator, farm.salesAccumulator);
      assert.equal(world.farm.landExpenses, farm.landExpenses); assert.equal(world.regionalConditions[(rx * 12 + ry) * 7 + 1], 0);
      for (const slot of result.demolishedBuildings) assert.equal(world.buildings[slot].active, false);
      for (let x = rx * 8; x < rx * 8 + 8; x++) for (let y = ry * 8; y < ry * 8 + 8; y++) assert.equal(world.cells[worldIndex(x, y)].overlay & 0x4800, 0);
      assert.deepEqual(world.fields.map(f => f.bytes), fields); assert.deepEqual(world.schedule.bytes, schedule); assert.deepEqual(world.sourceBytes, raw);
      const after = JSON.stringify([world, state, effects]);
      assert.deepEqual(sellLand(world, state, rx, ry, effects, 8, false), { ok: false, reason: 'not-owned' });
      assert.equal(JSON.stringify([world, state, effects]), after);
    }
}, 8000); // Whole-farm plot matrix; allow modest headroom under parallel test load.

test('sale preserves only the tree image range, keeps unknown map bits and applies unsigned cash cap/wrap', () => {
  for (const taxable of [false, true]) for (const cash of [0, 9999990, 0xfffffff0]) {
    const { world, state, effects } = setup(); world.buildings.forEach(b => b.flags &= ~32); world.regionalConditions.fill(0);
    world.regionalConditions[1] = 1; world.farm.cash = cash; world.farm.salesAccumulator = 0xfffffff0; state.landIncome = 0xfffffff0;
    for (let i = 0; i < 64; i++) { const c = world.cells[worldIndex(i >>> 3, i & 7)]; c.terrain = 0xa800 | (20 + i); c.overlay = 0xffff; c.attribute = 40; }
    const price = quoteLandSale(world, 0, 0, 3)!.price;
    sellLand(world, state, 0, 0, effects, 3, taxable);
    assert.equal(world.farm.cash, Math.min(9999999, (cash + price) >>> 0));
    assert.equal(world.farm.salesAccumulator, taxable ? (0xfffffff0 + price) >>> 0 : 0xfffffff0);
    assert.equal(state.landIncome, (0xfffffff0 + price) >>> 0);
    for (let i = 0; i < 64; i++) {
      const c = world.cells[worldIndex(i >>> 3, i & 7)], tile = 20 + i;
      assert.equal(c.terrain, 0xa800 | (tile >= 39 && tile < 69 ? tile : 28)); assert.equal(c.overlay, 0xb7ff); assert.equal(c.attribute, 40);
    }
  }
});

test('field cleanup composes before land sale and overwritten clearing images retain the original queue quirk', () => {
  const { world, state, effects } = setup(), f = world.fields.find(f => f.active)!;
  const rx = f.x >>> 3, ry = f.y >>> 3; world.regionalConditions[(rx * 12 + ry) * 7 + 1] = 1;
  let slot: number | null;
  while ((slot = findOverlappingField(world, rx * 8, ry * 8, 8, 8)) !== null) removeField(world, slot, effects, 8);
  const result = sellLand(world, state, rx, ry, effects, 8, false);
  assert.equal(result.ok, true); assert.equal(f.active, false); assert.equal(findOverlappingField(world, rx * 8, ry * 8, 8, 8), null);
  const inside = Array.from({ length: 64 }, (_, i) => worldIndex(rx * 8 + (i >>> 3), ry * 8 + (i & 7)));
  const cells = inside.map(i => ({ ...world.cells[i] }));
  updateClearingEffects(world, effects, 8, 16);
  assert.deepEqual(inside.map(i => world.cells[i]), cells); // Grass below animation range is not retired or repainted.
  assert.ok(effects.count > 0); // SF-066, scan remains bounded by the existing SF-061 fix.
});

test('sale prevalidates all building counts before credit and preserves failures atomically', () => {
  const { world, state, effects } = setup(); world.buildings.forEach(b => b.flags &= ~32); world.regionalConditions.fill(0); world.regionalConditions[1] = 1;
  for (let slot = 1; slot <= 2; slot++) {
    const b = world.buildings[slot]; b.flags = 32; put(b.bytes, 0, 64); b.bytes[4] = slot; b.bytes[5] = 1;
    for (let i = 0; i < 12; i++) b.clearContent(i);
  }
  world.buildingDefinitions[0].count = 1;
  const before = JSON.stringify([world, state, effects]);
  assert.throws(() => sellLand(world, state, 0, 0, effects, 8, true)); assert.equal(JSON.stringify([world, state, effects]), before);
  for (const [x, y] of [[-1, 0], [12, 0], [0, 12], [NaN, 0]]) assert.deepEqual(sellLand(world, state, x, y, effects, 8, true), { ok: false, reason: 'outside-map' });
  for (const code of [0, 2, 128, 255]) { world.regionalConditions[1] = code; const prior = JSON.stringify([world, state, effects]);
    assert.deepEqual(sellLand(world, state, 0, 0, effects, 8, true), { ok: false, reason: 'not-owned' }); assert.equal(JSON.stringify([world, state, effects]), prior); }
});

test('buildings crossing a sold plot are demolished completely in map encounter order while outside ownership remains', () => {
  const { world, state, effects } = setup(); world.buildings.forEach(b => b.flags &= ~32); world.regionalConditions.fill(0);
  world.regionalConditions[1] = 1;
  for (const c of world.cells) { c.terrain = 0x880f; c.overlay = 0xffff; c.attribute = 40; }
  for (const [slot, type, x, y] of [[1, 64, 6, 7], [2, 64, 1, 1], [3, 69, 7, 3]]) {
    const b = world.buildings[slot]; b.flags = 32; put(b.bytes, 0, type); b.bytes[4] = x; b.bytes[5] = y;
    for (let i = 0; i < 12; i++) b.clearContent(i);
  }
  world.buildingDefinitions[0].count = 2; world.buildingDefinitions[5].count = 1;
  const result = sellLand(world, state, 0, 0, effects, 8, true);
  assert.ok(result.ok); if (!result.ok) return;
  assert.deepEqual(result.demolishedBuildings, [2, 1, 3]);
  for (let x = 8; x < 11; x++) for (let y = 3; y < 6; y++) {
    const c = world.cells[worldIndex(x, y)]; assert.equal(terrainTile(c), 664); assert.equal(c.terrain & 0x800, 0); assert.equal(c.overlay, 0xffff);
  }
  assert.equal(world.cells[worldIndex(11, 3)].terrain, 0x880f);
  assert.equal(world.regionalConditions[12 * 7 + 1], 0);
  assert.equal(world.buildingDefinitions[0].count, 0); assert.equal(world.buildingDefinitions[5].count, 0);
});
