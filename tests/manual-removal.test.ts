import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { checkManualRemoval, removeManualTarget } from '../src/simulation/manual-removal';
import { purchaseBuilding } from '../src/simulation/building-placement';
import { shopFixture } from './support/livestock';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));

test('manual map removal callers, town/cash gates, confirmations, field states and expense category match source bytes', () => {
  const exe = source('SIMFARM.EXE'), exact = (o: number, hex: string) => assert.equal(exe.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x20880, '9a5c033c23'); exact(0x20d11, '9a5c033c23');
  exact(0x259c0, '26f687254c407403'); exact(0x259cf, '26833e4a3e00752526833e483e19731d');
  exact(0x25a30, '9a3e02d417'); exact(0x25a6e, '0bc07403e9cb04');
  exact(0x25a93, '9a840e8c14'); exact(0x25ab9, '9a840e8c14');
  exact(0x25ac4, '9a2a00d417'); exact(0x25adc, '9aaa10e624');
  exact(0x25b0c, '2680bf34240074342680bf342404742c');
  exact(0x25b7e, '9a26025719'); exact(0x25b89, '9afa025719');
  exact(0x25f32, '6a006a196aff9a2e00661a'); exact(0x1c900, '837e06ff750c0106ac3e1116ae3e');
  // Whole-object cleanup paints664. No later terrain family matches it, so
  // the second category−1 debit0x26222 is not reached by these branches.
  for (const [o, c] of [[0x868, 0x9a3], [0x866, 0x9a2], [0x904, 0x9f1], [0x906, 0x9f2], [0x8fa, 0x9ec],
    [0x8fe, 0x9ee], [0x8da, 0x9dc], [0x8fc, 0x9ed], [0x960, 0xa1f], [0x95e, 0xa1e], [0x980, 0xa2f], [0x8ce, 0x9d6]]) {
    const base = exe.readUInt16LE(0x4ec60 + o), count = exe[0x4ec60 + c]; assert.ok(664 < base || 664 >= base + count);
  }
});

test('all source farms use read-only manual quotes and one whole-object charge while retaining ownership, plans and source bytes', () => {
  let removed = 0;
  for (let id = 0; id < 8; id++) for (const kind of ['building', 'field'] as const) {
    const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
    const records = (kind === 'building' ? world.buildings : world.fields).filter(r => r.active);
    const before = JSON.stringify([world, finances]), quotes = records.map(r => checkManualRemoval(world, r.x, r.y));
    assert.equal(JSON.stringify([world, finances]), before);
    const regions = Uint8Array.from(world.regionalConditions), plans = Uint8Array.from(world.schedule.bytes);
    const sourceBytes = Uint8Array.from(world.sourceBytes), sales = world.farm.salesAccumulator;
    const income = [finances.accounts.assets.equipmentIncome, finances.accounts.assets.livestockIncome];
    for (const [i, r] of records.entries()) {
      const quote = quotes[i]; if (!quote.ok || quote.kind !== kind || quote.slot !== r.slot) continue;
      const cash = world.farm.cash, expense = finances.annual.otherExpenses, raw = Uint8Array.from(r.bytes);
      const result = removeManualTarget(world, finances, r.x, r.y, { kind, slot: r.slot }, 2);
      assert.deepEqual(result, quote); assert.equal(r.active, false);
      assert.equal(world.farm.cash, cash - 25); assert.equal(finances.annual.otherExpenses, (expense + 25) >>> 0);
      if (kind === 'field') { raw[7] &= ~1; assert.deepEqual(r.bytes, raw); }
      assert.equal(checkManualRemoval(world, r.x, r.y).ok, false); removed++;
    }
    assert.deepEqual(world.regionalConditions, regions); assert.deepEqual(world.schedule.bytes, plans);
    assert.deepEqual(world.sourceBytes, sourceBytes); assert.equal(world.farm.salesAccumulator, sales);
    assert.deepEqual([finances.accounts.assets.equipmentIncome, finances.accounts.assets.livestockIncome], income);
  }
  assert.ok(removed > 40);
});

test('manual field state/cash/town/bounds gates and stale confirmation reject without writes, with building-first lookup', () => {
  const { state } = shopFixture(), w = state.scenario, a = state.finances, f = w.fields[1];
  f.bytes[7] |= 1; f.bytes.set([20, 20, 8, 8], 10); f.equipment = f.pendingEquipment = 0;
  for (let s = 0; s < 256; s++) { f.bytes[2] = s; assert.equal(checkManualRemoval(w, 27, 27).ok, s === 0 || s === 4); }
  f.bytes[2] = 0;
  const reject = (x: number, y: number, reason: string, slot = 1) => {
    const before = JSON.stringify([w, a]);
    assert.deepEqual(removeManualTarget(w, a, x, y, { kind: 'field', slot }, 0), { ok: false, reason });
    assert.equal(JSON.stringify([w, a]), before);
  };
  for (const x of [-1, 96, 1.5, NaN]) reject(x, 20, 'outside-map');
  reject(28, 20, 'no-target'); reject(20, 28, 'no-target'); reject(20, 20, 'target-changed', 2);
  f.bytes[2] = 3; reject(20, 20, 'field-busy'); f.bytes[2] = 0;
  w.farm.cash = 24; reject(20, 20, 'insufficient-cash');
  w.cells[worldIndex(20, 20)].overlay = 0x4000; reject(20, 20, 'town-owned');
  w.cells[worldIndex(20, 20)].overlay = 0; w.farm.cash = 25; // No player-ownership gate.
  a.annual.otherExpenses = 0xffffffff;
  assert.ok(removeManualTarget(w, a, 20, 20, { kind: 'field', slot: 1 }, 0).ok);
  assert.equal(w.farm.cash, 0); assert.equal(a.annual.otherExpenses, 24);
  w.farm.cash = 10000; w.cells[worldIndex(40, 40)].overlay = 0x800;
  const building = purchaseBuilding(w, a, 64, 40, 40, 0); assert.ok(building.ok);
  f.bytes[7] |= 1; f.bytes.set([40, 40, 8, 8], 10); f.bytes[2] = 3;
  const quote = checkManualRemoval(w, 40, 40); assert.ok(quote.ok); assert.equal(quote.kind, 'building');
  reject(40, 40, 'target-changed');
});

test('manual pump/wind demolition removes irrigation sources; corrupt contents cannot cause partial demolition or a charge', () => {
  for (const type of [70, 71]) {
    const { state } = shopFixture(), w = state.scenario, a = state.finances;
    const built = purchaseBuilding(w, a, type, 40, 40, 0); assert.ok(built.ok);
    assert.equal(w.irrigation.sourceCount, 1);
    const b = w.buildings[built.slot]; b.setContent(0, 0, 192, 255);
    let before = JSON.stringify([w, a]);
    assert.throws(() => removeManualTarget(w, a, 40, 40, { kind: 'building', slot: b.slot }, 0));
    assert.equal(JSON.stringify([w, a]), before); b.clearContent(0);
    a.annual.otherExpenses = -1; before = JSON.stringify([w, a]);
    assert.throws(() => removeManualTarget(w, a, 40, 40, { kind: 'building', slot: b.slot }, 0));
    assert.equal(JSON.stringify([w, a]), before); a.annual.otherExpenses = 0;
    assert.ok(removeManualTarget(w, a, 40, 40, { kind: 'building', slot: b.slot }, 0).ok);
    assert.equal(w.irrigation.sourceCount, 0); assert.equal(b.active, false); assert.equal(a.annual.otherExpenses, 25);
  }
});
