import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Binary } from '../src/formats/binary';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { ageEquipment } from '../src/simulation/weekly-equipment';
import { ageChemicals } from '../src/simulation/weekly-chemicals';
import { consumeChemical } from '../src/simulation/chemicals';
import { findBuilding } from '../src/simulation/building-storage';
import { equipmentFootprint } from '../src/simulation/equipment-world';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { weeklyAgingFixture } from './support/weekly-aging';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const word = (b: Uint8Array, offset: number, value: number) => new Binary(b).view.setUint16(offset, value, true);

test('weekly equipment and chemical phases pin active gates, wear/reset, sale, sound and condition operands', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0xbf2f, '26ff87cca6'); exact(0xbf34, '2683bfcca604'); exact(0xbf43, '9a82215f0d');
  exact(0xbf65, '26f687bca640'); exact(0xbf8a, '6a029ae20fe624');
  exact(0x28042, 'e8a8f5eacc0fce271b00'); exact(0xbf99, '68ae1f9ab6082a21');
  exact(0xc120, '26ff87c8ed'); exact(0xc125, '268087c7ed01'); exact(0x14562, '268a87c7ed');
  assert.equal(e.subarray(0x8669e, 0x866aa).toString('ascii'), 'explode.voc\0');
});

test('all source farms age active equipment and chemical records with every unrelated byte and ledger retained', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
    const eq = world.equipment.map(e => Uint8Array.from(e.bytes)), chemicals = world.chemicals.map(c => Uint8Array.from(c.bytes));
    const accounts = JSON.stringify(finances), cash = world.farm.cash;
    assert.deepEqual(ageEquipment(world, finances, 0), []); ageChemicals(world);
    world.equipment.forEach((e, i) => {
      if (eq[i][2] & 32) { const n = (new Binary(eq[i]).u16(18) + 1) & 65535;
        if (n > 4) eq[i][17] = Math.min(255, eq[i][17] + (n >>> 2) + 1);
        word(eq[i], 18, n > 4 ? 0 : n); }
      assert.deepEqual(e.bytes, eq[i]);
    });
    world.chemicals.forEach((c, i) => {
      if (chemicals[i][2] & 32) { chemicals[i][9]++; word(chemicals[i], 10, new Binary(chemicals[i]).u16(10) + 1); }
      assert.deepEqual(c.bytes, chemicals[i]);
    });
    assert.equal(JSON.stringify(finances), accounts); assert.equal(world.farm.cash, cash);
  }
});

test('equipment five-week wear includes stored, rented and busy records, wraps the age word and preserves inactive slots', () => {
  const f = weeklyAgingFixture(), e = f.equipment;
  for (const flags of [0x60, 0x61, 0x68, 0x64]) for (const age of [0, 3, 4, 5, 255, 65534, 65535]) for (const wear of [0, 252, 253, 254, 255]) {
    e.flags = flags; e.bytes[17] = wear; word(e.bytes, 18, age); const before = Uint8Array.from(e.bytes);
    assert.deepEqual(ageEquipment(f.state.scenario, f.state.finances, 0), []);
    const n = (age + 1) & 65535; word(before, 18, n > 4 ? 0 : n);
    if (n > 4) before[17] = Math.min(255, wear + (n >>> 2) + 1);
    assert.deepEqual(e.bytes, before);
  }
  e.flags = 0; const before = Uint8Array.from(e.bytes); ageEquipment(f.state.scenario, f.state.finances, 0); assert.deepEqual(e.bytes, before);
});

test('all nine equipment types and rotations sell at maximum wear with original accounts and outdoor clearing footprints', () => {
  const f = weeklyAgingFixture(), w = f.state.scenario, finances = f.state.finances, e = f.equipment;
  for (let type = 0; type <= 8; type++) for (const direction of [0, 2, 4, 6]) {
    e.bytes.fill(0); word(e.bytes, 0, type); e.flags = 32; e.bytes[5] = e.bytes[6] = 40; e.bytes[15] = direction; e.bytes[17] = 253; word(e.bytes, 18, 4);
    e.bytes[50] = 3; e.bytes[51] = 10; // Valid original aircraft home.
    const def = w.equipmentDefinitions[type]; def.ownedCount = 1; w.farm.cash = 9_999_990;
    w.farm.salesAccumulator = finances.accounts.assets.equipmentIncome = 0xfffffff0; finances.accounts.assets.equipmentBookValue = 1;
    finances.clearing.x.fill(255); finances.clearing.count = finances.clearing.cursor = 0;
    for (const cell of w.cells) { cell.terrain = 0xb80f; cell.overlay = 0xa351; cell.attribute = 40; }
    const size = equipmentFootprint(e, w), value = def.price >>> 3;
    assert.deepEqual(ageEquipment(w, finances, 0), [{ kind: 'sold', slot: 1, equipmentType: type, x: 40, y: 40, value, outdoor: true }]);
    assert.equal(e.active, false); assert.equal(e.condition, 255); assert.equal(new Binary(e.bytes).u16(18), 0);
    assert.equal(def.ownedCount, 0); assert.equal(w.farm.cash, Math.min(9_999_999, 9_999_990 + value));
    assert.equal(w.farm.salesAccumulator, (0xfffffff0 + value) >>> 0); assert.equal(finances.accounts.assets.equipmentIncome, (0xfffffff0 + value) >>> 0);
    assert.equal(finances.accounts.assets.equipmentBookValue, (1 - def.price) >>> 0);
    assert.equal(finances.clearing.count, size.width * size.height);
    for (let x = 40; x < 40 + size.width; x++) for (let y = 40; y < 40 + size.height; y++)
      assert.equal(w.cells[worldIndex(x, y)].terrain & 0x7ff, 664);
    if (type === 8) assert.equal(w.cells[worldIndex(3, 10)].terrain & 0x7ff, 23);
  }
});

test('stored sales preserve buildings, bounded deletion visits later machines, and busy or inconsistent removals retain accounting', () => {
  let stored = 0;
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
    for (const e of world.equipment.filter(e => e.active)) {
      if (findBuilding(world, e.x, e.y)) stored++;
      e.bytes[17] = 255;
    }
    const count = world.equipment.filter(e => e.active).length, flags = world.buildings.map(b => b.flags);
    const notices = ageEquipment(world, finances, 0);
    assert.equal(notices.length, count); assert.ok(notices.every(n => n.kind === 'sold'));
    assert.equal(world.equipment.filter(e => e.active).length, 0); assert.deepEqual(world.buildings.map(b => b.flags), flags);
  }
  assert.ok(stored > 0);
  const f = weeklyAgingFixture(), e = f.equipment, w = f.state.scenario, finances = f.state.finances;
  for (const flags of [33, 40, 32]) {
    e.flags = flags; e.bytes[17] = 255; w.equipmentDefinitions[0].ownedCount = flags === 32 ? 0 : 1;
    const cash = w.farm.cash, accounts = JSON.stringify(finances);
    assert.equal(ageEquipment(w, finances, 0)[0].kind, 'deferred');
    assert.equal(e.active, true); assert.equal(w.farm.cash, cash); assert.equal(JSON.stringify(finances), accounts);
  }
  e.bytes[0] = 9; const before = Uint8Array.from(e.bytes); assert.throws(() => ageEquipment(w, finances, 0), /weekly equipment/); assert.deepEqual(e.bytes, before);
});

test('chemical age and condition wrap exactly for all byte values without changing treatment strength or cost', () => {
  const f = weeklyAgingFixture(), w = f.state.scenario, c = f.chemical;
  for (const type of [220, 221, 222, 223]) for (let condition = 0; condition <= 255; condition++) {
    c.bytes.fill(0xa5); word(c.bytes, 0, type); c.bytes[2] = 32; c.bytes[5] = c.bytes[6] = 20; c.bytes[9] = condition; word(c.bytes, 10, 65535);
    const expected = Uint8Array.from(c.bytes); expected[9] = (condition + 1) & 255; word(expected, 10, 0);
    ageChemicals(w); assert.deepEqual(c.bytes, expected);
  }
  for (const condition of [0, 63, 64, 127, 128, 191, 192, 254, 255]) {
    word(c.bytes, 0, 220); c.bytes[2] = 32; c.bytes[9] = condition; w.chemicalDefinitions[0].count = 1;
    ageChemicals(w); const cash = w.farm.cash;
    assert.deepEqual(consumeChemical(w, 220, 0), { ok: true, source: 'stored', cost: 0 }); assert.equal(w.farm.cash, cash);
  }
  c.bytes[2] = 32; c.bytes[5] = 96; const before = Uint8Array.from(c.bytes);
  assert.throws(() => ageChemicals(w), /weekly chemical/); assert.deepEqual(c.bytes, before);
});

test('weekly age records, sale accounts and clearing queue survive exact native checkpoints', () => {
  const f = weeklyAgingFixture(); ageEquipment(f.state.scenario, f.state.finances, 0); ageChemicals(f.state.scenario);
  const saved = writeNativeSave(f.state, 4), restored = readNativeSave(saved).state;
  assert.equal(writeNativeSave(restored, 4), saved);
  for (const s of [f.state, restored]) { ageEquipment(s.scenario, s.finances, 0); ageChemicals(s.scenario); }
  assert.equal(writeNativeSave(restored, 4), writeNativeSave(f.state, 4));
});
