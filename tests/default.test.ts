import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readDefaultState } from '../src/formats/default-state';
import { createClearingEffects } from '../src/simulation/clearing-effects';
import { forceAssetSales, resolveDefaultDecision } from '../src/simulation/default';
import { storedHarvestValue } from '../src/simulation/harvest-sale';
import { animalSaleQuote, equipmentSaleQuote } from '../src/simulation/asset-sale';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const setup = (id = 4) => { const b = source(`SCEN${id}.SSM`); return { world: readScenario(b), state: readDefaultState(b, 0), effects: createClearingEffects() }; };
const put = (b: Uint8Array, o: number, n: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).setUint16(o, n, true);
function empty() {
  const data = setup(), { world, state } = data;
  world.buildings.forEach(b => b.flags &= ~32);
  world.fields.forEach(f => f.bytes[7] &= ~1); world.equipment.forEach(e => e.flags &= ~32); world.animals.forEach(a => a.flags &= ~32);
  world.inventory.forEach(i => i.bytes[10] &= ~32); world.chemicals.forEach(c => c.bytes[2] &= ~32); world.regionalConditions.fill(0);
  world.farm.cash = world.farm.salesAccumulator = world.farm.cropIncome = 0;
  state.equipmentExpenses = state.balancePayments = state.taxExpenses = state.landIncome = 0;
  state.assets.equipmentIncome = state.assets.livestockIncome = 0;
  state.homeRegionX = state.homeRegionY = 11;
  return data;
}
function crop(data: ReturnType<typeof setup>, slot = 1) {
  const i = data.world.inventory[slot]; i.bytes.fill(0); put(i.bytes, 0, 168); put(i.bytes, 2, 100);
  i.bytes[8] = 20; i.bytes[9] = 20 + slot % 32; i.bytes[10] = 32;
  data.world.harvestDefinitions[0].count++; data.world.cropDefinitions[0].price = 100;
  return storedHarvestValue(i, data.world);
}
function animal(data: ReturnType<typeof setup>, slot = 1) {
  const a = data.world.animals[slot]; a.bytes.fill(0); a.flags = 32; a.bytes[0] = 30; a.bytes[1] = 30 + slot % 32;
  put(a.bytes, 6, 160); a.bytes[8] = 255; data.state.assets.animalDefinitions[0].count++; data.state.assets.animalDefinitions[0].price = 200;
  return animalSaleQuote(a, data.state.assets.animalDefinitions).value;
}
function equipment(data: ReturnType<typeof setup>, slot = 1, flags = 32) {
  const e = data.world.equipment[slot]; e.bytes.fill(0); e.flags = flags; e.bytes[5] = 40; e.bytes[6] = 40 + slot % 32;
  data.world.equipmentDefinitions[0].ownedCount++; put(data.world.equipmentDefinitions[0].bytes, 6, 300);
  return equipmentSaleQuote(e, data.world.equipmentDefinitions).value;
}

test('default source pins ordered calls, reason-specific debit categories, home protection and terminal codes', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, hex: string) => assert.equal(e.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x1d830, '9ae20fe624'); exact(0x1d912, '9ae20fe624'); exact(0x1d9cb, '9ae20fe624'); exact(0x1dace, '9ae610e624');
  exact(0x1d844, '68e803'); exact(0x1d86a, '68c409'); exact(0x1d920, '6a00'); exact(0x1d9d9, '6a00'); exact(0x1dadc, '6a00');
  exact(0x1c921, '01067c3e'); exact(0x1d97d, 'a840'); exact(0x1db1a, '2639061000'); exact(0x1db28, '2639061200');
  exact(0x1db69, '26c606940102'); exact(0x1db76, '26c606940101'); exact(0x269e, '803e940102');
  exact(0x45d8b, '687c3e'); exact(0x45e1b, '68a43e'); exact(0x45e4b, '68b43e');
  assert.equal(e.subarray(0x846f0 + 0x3efa, 0x846f0 + 0x3efa + 100).toString('latin1').split('\0')[0],
    'You have had to sell your homestead to pay your debts.  Would you like to start a new game?');
});

test('default state decodes saved ledgers/home pairs with detached unknown records and explicit building balance', () => {
  for (let id = 0; id < 8; id++) {
    const b = source(`SCEN${id}.SSM`), s = readDefaultState(b, 0xdeadbeef);
    for (const [key, offset] of [['landIncome', 0x21698], ['equipmentExpenses', 0x216a8], ['balancePayments', 0x216c0], ['taxExpenses', 0x216c8]] as const) assert.equal(s[key], b.readUInt32LE(offset));
    assert.equal(s.homeRegionX, b.readUInt16LE(0x216e0)); assert.equal(s.homeRegionY, b.readUInt16LE(0x216e2)); assert.equal(s.buildingBookValue, 0xdeadbeef);
    s.otherDefinitions[0].bytes[17] ^= 255; assert.notEqual(s.otherDefinitions[0].bytes[17], b[0x20fb1]);
  }
  const b = source('SCEN4.SSM'); assert.throws(() => readDefaultState(b.subarray(0, 0x216e3), 0));
  put(b, 0x216e0, 12); assert.throws(() => readDefaultState(b, 0));
  for (const amount of [-1, 2 ** 32, NaN]) assert.throws(() => readDefaultState(source('SCEN4.SSM'), amount));
});

for (let id = 0; id < 8; id++) test(`unpayable default exhausts original farm ${id + 1} safely and preserves its home plot`, () => {
  const { world, state, effects } = setup(id), raw = Uint8Array.from(world.sourceBytes);
  const result = forceAssetSales(world, state, 0xffffffff, 36, effects, 8);
  assert.equal(result.paid, false); assert.deepEqual(result.decision, { status: 'pending', originalExitCode: 0 });
  assert.equal(result.paymentCategory, null); assert.equal(result.amount, 0xffffffff);
  const order = { crop: 0, animal: 1, equipment: 2, land: 3 };
  assert.ok(result.attempts.every((a, i) => !i || order[a.kind] >= order[result.attempts[i - 1].kind]));
  const plots = result.attempts.filter(a => a.kind === 'land');
  assert.ok(plots.every((a, i) => !i || a.regionX * 12 + a.regionY > plots[i - 1].regionX * 12 + plots[i - 1].regionY));
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) {
    if (x === state.homeRegionX && y === state.homeRegionY) assert.equal(world.regionalConditions[(x * 12 + y) * 7 + 1], 1);
    else assert.notEqual(world.regionalConditions[(x * 12 + y) * 7 + 1], 1);
  }
  assert.equal(new Set(result.removedFields).size, result.removedFields.length);
  for (const slot of result.removedFields) assert.equal(world.fields[slot].active, false);
  assert.deepEqual(world.sourceBytes, raw);
  resolveDefaultDecision(result.decision!, 'restart'); assert.deepEqual(result.decision, { status: 'restart', originalExitCode: 2 });
  assert.throws(() => resolveDefaultDecision(result.decision!, 'exit'));
});

test('crop payment retries preserve swapped tax/balance categories, wrap and stop immediately on payment', () => {
  for (const reason of [36, 39] as const) {
    const d = empty(), value = crop(d); animal(d); equipment(d); crop(d, 2);
    d.state.balancePayments = d.state.taxExpenses = 0xfffffffe;
    const r = forceAssetSales(d.world, d.state, value, reason, d.effects, 8);
    assert.equal(r.paid, true); assert.equal(r.decision, null); assert.equal(r.paymentCategory, reason === 36 ? 1000 : 2500);
    assert.equal(r.attempts.length, 1); assert.equal(d.world.farm.cash, 0); assert.equal(d.world.farm.salesAccumulator, value);
    assert.equal(d.world.farm.cropIncome, value); assert.equal(d.world.inventory[2].active, true); assert.equal(d.world.animals[1].active, true);
    assert.equal(d.state[reason === 36 ? 'balancePayments' : 'taxExpenses'], (0xfffffffe + value) >>> 0);
    assert.equal(d.state[reason === 36 ? 'taxExpenses' : 'balancePayments'], 0xfffffffe);
  }
});

test('later stages retry the whole amount through equipment expenses and land adds no taxable sales', () => {
  for (const target of ['animal', 'equipment', 'land'] as const) {
    const d = empty(), cv = crop(d), av = animal(d), ev = equipment(d);
    d.world.regionalConditions[1] = 1;
    const amount = cv + (target === 'animal' ? 1 : av + (target === 'equipment' ? 1 : ev + 1));
    const r = forceAssetSales(d.world, d.state, amount, 39, d.effects, 8);
    assert.equal(r.paid, true); assert.equal(r.attempts.at(-1)!.kind, target); assert.equal(r.paymentCategory, 0);
    assert.equal(d.state.equipmentExpenses, amount); assert.equal(d.state.balancePayments, 0); assert.equal(d.state.taxExpenses, 0);
    assert.equal(d.world.farm.cash, r.attempts.reduce((n, a) => n + a.value, 0) - amount);
    assert.equal(d.world.farm.salesAccumulator, cv + av + (target === 'animal' ? 0 : ev));
  }
});

test('bounded traversal skips rentals/seeds, retries failed busy sales, and preserves source zero-amount behavior', () => {
  const d = empty(); equipment(d, 1, 0x60); equipment(d, 2, 0x29); d.world.farm.cash = 100;
  const seed = d.world.inventory[511]; seed.bytes.fill(0); put(seed.bytes, 0, 192); seed.bytes[10] = 32;
  const r = forceAssetSales(d.world, d.state, 50, 36, d.effects, 8);
  assert.deepEqual(r.attempts, [{ kind: 'equipment', slot: 2, sold: false, value: 0 }]);
  assert.equal(r.paid, true); assert.equal(d.world.farm.cash, 50); assert.equal(seed.active, true); assert.equal(d.world.equipment[1].active, true);
  const zero = empty(); crop(zero); const zr = forceAssetSales(zero.world, zero.state, 0, 36, zero.effects, 8);
  assert.equal(zr.paid, false); assert.equal(zero.world.inventory[1].active, false); assert.ok(zr.decision);
  resolveDefaultDecision(zr.decision!, 'exit'); assert.deepEqual(zr.decision, { status: 'exit', originalExitCode: 1 });
});

test('invalid default inputs reject before any asset transaction or payment', () => {
  for (const kind of ['amount', 'reason', 'home', 'account', 'effects'] as const) {
    const d = empty(); crop(d); let amount = 100, reason = 36;
    if (kind === 'amount') amount = -1;
    if (kind === 'reason') reason = 40;
    if (kind === 'home') d.state.homeRegionX = 12;
    if (kind === 'account') d.state.equipmentExpenses = NaN;
    if (kind === 'effects') d.effects.x[1] = 96;
    const before = JSON.stringify(d);
    assert.throws(() => forceAssetSales(d.world, d.state, amount, reason as 36, d.effects, 8)); assert.equal(JSON.stringify(d), before);
  }
});

test('sparse final slots are visited once despite source counts and unrelated active inventory', () => {
  const d = empty(), value = crop(d, 511);
  const seed = d.world.inventory[1]; seed.bytes.fill(0); put(seed.bytes, 0, 192); seed.bytes[10] = 32;
  const r = forceAssetSales(d.world, d.state, value, 36, d.effects, 8);
  assert.deepEqual(r.attempts, [{ kind: 'crop', slot: 511, sold: true, value }]); assert.equal(seed.active, true);
  const a = empty(), av = animal(a, 255); const ar = forceAssetSales(a.world, a.state, av, 36, a.effects, 8);
  assert.equal(ar.attempts[0].kind, 'animal'); assert.equal(ar.attempts.length, 1); assert.equal(ar.paid, true);
  const e = empty(), ev = equipment(e, 126); const er = forceAssetSales(e.world, e.state, ev, 39, e.effects, 8);
  assert.deepEqual(er.attempts, [{ kind: 'equipment', slot: 126, sold: true, value: ev }]); assert.equal(er.paid, true);
});

test('signed equipment proceeds can wrap cash into the cap before the original default debit', () => {
  const d = empty(); equipment(d); put(d.world.equipmentDefinitions[0].bytes, 6, 32768);
  d.state.equipmentExpenses = 0xffffffff;
  const r = forceAssetSales(d.world, d.state, 100000, 36, d.effects, 8);
  assert.equal(r.paid, true); assert.equal(r.attempts[0].value, -32768); assert.equal(d.world.farm.cash, 9899999);
  assert.equal(d.state.equipmentExpenses, 99999); assert.equal(d.world.farm.salesAccumulator, (-32768) >>> 0);
});
