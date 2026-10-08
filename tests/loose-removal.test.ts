import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { checkManualRemoval, removeManualTarget } from '../src/simulation/manual-removal';
import { shopFixture } from './support/livestock';
import { purchaseSupply } from '../src/simulation/livestock-purchase';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const put = (b: Uint8Array, o: number, n: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).setUint16(o, n, true);

test('loose deletion branches call bounded point queries, generic removal, original clearing and masked cleanup', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, hex: string) => assert.equal(e.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x25c52, '9a84010313'); exact(0x25d56, '9a84010313'); exact(0x25e42, '9a48013412');
  for (const o of [0x25c79, 0x25d7d, 0x25e61]) exact(o, '9aaa10e624');
  for (const o of [0x25c87, 0x25d8b, 0x25e6f]) exact(o, '9a961d3606');
  exact(0x25e86, '2680a72504f7');
  assert.equal(e.readUInt16LE(0x4ec60 + 0x900), 1020); assert.equal(e[0x4ec60 + 0x9ef], 5);
});

test('all eight farms retain raw loose inventory and chemical bytes while decrementing the matching definition and charging once', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), w = readScenario(bytes), a = readFinancialState(bytes);
    for (const b of w.buildings) b.flags &= ~32;
    for (const f of w.fields) f.bytes[7] &= ~1;
    for (const i of w.inventory) i.bytes[10] &= ~32;
    for (const c of w.chemicals) c.bytes[2] &= ~32;
    w.farm.cash = 100000; const cell = w.cells[worldIndex(40, 40)]; cell.attribute = 47;
    const sales = w.farm.salesAccumulator, sourceBefore = Uint8Array.from(w.sourceBytes);
    const types = [...Array.from({ length: 16 }, (_, i) => 168 + i), ...Array.from({ length: 16 }, (_, i) => 192 + i), 299, 300, 220, 221, 222, 223];
    for (const type of types) {
      const chemical = type >= 220 && type <= 223, item = chemical ? w.chemicals[1] : w.inventory[1];
      const d = chemical ? w.chemicalDefinitions[type - 220] : type < 184 ? w.harvestDefinitions[type - 168]
        : type < 208 ? w.seedDefinitions[type - 192] : a.accounts.otherDefinitions[type - 288];
      put(item.bytes, 0, type); item.bytes[chemical ? 2 : 10] = 0xa0;
      item.bytes[chemical ? 5 : 8] = item.bytes[chemical ? 6 : 9] = 40;
      d.count = 1; cell.terrain = type === 299 ? 176 : 0x800f; cell.overlay = chemical ? 0x8810 : 0x8800 | 1020;
      const oldOverlay = cell.overlay, raw = Uint8Array.from(item.bytes), cash = w.farm.cash, expenses = a.annual.otherExpenses;
      const quote = checkManualRemoval(w, 40, 40); assert.ok(quote.ok); assert.equal(quote.kind, chemical ? 'chemical' : 'inventory');
      assert.deepEqual(removeManualTarget(w, a, 40, 40, quote, 3), quote);
      raw[chemical ? 2 : 10] &= ~32; assert.deepEqual(item.bytes, raw); assert.equal(d.count, 0);
      assert.equal(w.farm.cash, cash - 25); assert.equal(a.annual.otherExpenses, (expenses + 25) >>> 0);
      assert.equal(cell.terrain & 0x7ff, 664); assert.equal(cell.terrain & 0x800, 0);
      assert.equal(cell.overlay, type === 299 ? oldOverlay : (oldOverlay & 0xf800) | 30);
      assert.equal(checkManualRemoval(w, 40, 40).ok, false);
    }
    assert.equal(w.farm.salesAccumulator, sales); assert.deepEqual(w.sourceBytes, sourceBefore);
  }
});

test('purchased trough/feed removal retains source quantities, ground versus masked restoration and bounded sparse-slot lookup', () => {
  const { state } = shopFixture(), w = state.scenario, a = state.finances;
  for (const type of [299, 300]) {
    const bought = purchaseSupply(w, a, type, 40, 40, 0); assert.ok(bought.ok);
    const item = w.inventory[bought.slot], raw = Uint8Array.from(item.bytes); w.inventory[511].bytes.set(raw); item.bytes[10] &= ~32;
    const cell = w.cells[worldIndex(40, 40)]; cell.attribute = 25; const oldOverlay = cell.overlay;
    const quote = checkManualRemoval(w, 40, 40); assert.ok(quote.ok); assert.equal(quote.slot, 511);
    const before = JSON.stringify([w, a]);
    assert.deepEqual(removeManualTarget(w, a, 40, 40, { ...quote, slot: 1 }, 0), { ok: false, reason: 'target-changed' });
    assert.equal(JSON.stringify([w, a]), before);
    const count = a.accounts.otherDefinitions[type - 288].count; a.accounts.otherDefinitions[type - 288].count = 0;
    const corrupt = JSON.stringify([w, a]); assert.throws(() => removeManualTarget(w, a, 40, 40, quote, 0)); assert.equal(JSON.stringify([w, a]), corrupt);
    a.accounts.otherDefinitions[type - 288].count = count; assert.ok(removeManualTarget(w, a, 40, 40, quote, 0).ok);
    raw[10] &= ~32; assert.deepEqual(w.inventory[511].bytes, raw);
    assert.equal(cell.overlay, type === 299 ? oldOverlay : (oldOverlay & 0xf800) | 24);
    cell.terrain = 15;
  }
});

test('missing inventory follows the original terrain fallback, chemicals are found on unmasked ground, and stale terrain graphics reject', () => {
  const { state } = shopFixture(), w = state.scenario, a = state.finances, cell = w.cells[worldIndex(40, 40)];
  for (const c of w.chemicals) c.bytes[2] &= ~32;
  const chemical = w.chemicals[126]; put(chemical.bytes, 0, 220); chemical.bytes[2] = 32; chemical.bytes[5] = chemical.bytes[6] = 40;
  w.chemicalDefinitions[0].count = 1; cell.terrain = 175; cell.overlay = 0x800;
  const fallback = checkManualRemoval(w, 40, 40); assert.ok(fallback.ok); assert.equal(fallback.kind, 'terrain');
  cell.terrain = 176; const before = JSON.stringify([w, a]);
  assert.deepEqual(removeManualTarget(w, a, 40, 40, fallback, 0), { ok: false, reason: 'target-changed' }); assert.equal(JSON.stringify([w, a]), before);
  cell.terrain = 15; const quote = checkManualRemoval(w, 40, 40); assert.ok(quote.ok); assert.equal(quote.kind, 'chemical'); assert.equal(quote.slot, 126);
  assert.ok(removeManualTarget(w, a, 40, 40, quote, 0).ok); assert.equal(chemical.active, false);
  cell.terrain = 15; cell.overlay = 0x800 | 1020; assert.equal(checkManualRemoval(w, 40, 40).ok, false);
});
