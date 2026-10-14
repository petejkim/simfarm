import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readAnnualLedger } from '../src/formats/annual-ledger';
import { readDefaultState } from '../src/formats/default-state';
import { readScenario } from '../src/formats/scenario';
import { resetAnnualLedgers, updateAnnualReport } from '../src/simulation/annual-ledger';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const runtime = () => ({ priorTaxExpenses: 11, ds3e70: 13, ds3e8c: 17, ds3e90: 19, ds3e94: 23, ds3e9c: 29 });
const setup = (id = 0) => { const b = source(`SCEN${id}.SSM`); return { world: readScenario(b), accounts: readDefaultState(b, 123), ledger: readAnnualLedger(b, runtime()), weather: { precipitationDays: 65535 } }; };

test('annual report/reset instructions and save destinations match the executable', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  const resetWords = [];
  for (let o = 0x1d39f; o < 0x1d411; o += 3) { assert.equal(e[o], 0xa3); resetWords.push(e.readUInt16LE(o + 1)); }
  const resetDwords = [0x3eac, 0x3e60, 0x3e64, 0x3e68, 0x3e6c, 0x3e70, 0x3e74, 0x3e78, 0x3e7c,
    0x3e80, 0x3e84, 0x3e8c, 0x3e90, 0x3e94, 0x3e98, 0x3e9c, 0x3ea0, 0x3ea4, 0x3ea8];
  assert.deepEqual(resetWords, resetDwords.flatMap(o => [o + 2, o]));
  exact(0x1d415, '26a31224'); assert.equal(e.readUInt16LE(0x846f0 + 0xc8ac), 0x6190);
  exact(0x1d419, 'a1b43e8b16b63ea3403e8916423e2bc0a3b63ea3b43e');
  exact(0x1d467, 'a16c3e8b166e3e');
  for (const [i, offset] of [0x3e64, 0x3e68, 0x3e60, 0x3e74, 0x3e70].entries()) {
    const at = 0x1d46e + i * 8; exact(at, '0306'); assert.equal(e.readUInt16LE(at + 2), offset);
    exact(at + 4, '1316'); assert.equal(e.readUInt16LE(at + 6), offset + 2);
  }
  exact(0x1d49d, '8b0eac3e8b1eae3e');
  for (const [i, offset] of [0x3ea8, 0x3e9c, 0x3e98, 0x3e94, 0x3e90, 0x3e8c, 0x3eb4, 0x3e40, 0x3e84, 0x3e80, 0x3e7c, 0x3e78].entries()) {
    const at = 0x1d4a5 + i * 8; exact(at, '030e'); assert.equal(e.readUInt16LE(at + 2), offset);
    exact(at + 4, '131e'); assert.equal(e.readUInt16LE(at + 6), offset + 2);
  }
  exact(0x1d50d, '2bc11bd3'); exact(0x1d515, '26a318fa2689161afa');
  for (const [o, h] of [[0x45deb, '68983e'], [0x45e63, '68ac3e'], [0x45e7b, '68c03e'], [0x45e93, '68bc3e'], [0x45ea8, '689f2d6818fa']] as const) exact(o, h);
});

test('all eight saved annual ledgers preserve raw values, runtime inputs and decoder boundaries', () => {
  for (let id = 0; id < 8; id++) {
    const b = source(`SCEN${id}.SSM`), r = runtime(), l = readAnnualLedger(b, r);
    assert.deepEqual(l, { ...r, livestockExpenses: b.readUInt32LE(0x216b8), otherExpenses: b.readUInt32LE(0x216cc),
      reportExpenses: b.readUInt32LE(0x216d0), reportIncome: b.readUInt32LE(0x216d4), reportNet: b.readUInt32LE(0x216d8) });
    l.ds3e70++; assert.equal(r.ds3e70, 13);
    for (const end of [0x216bb, 0x216cf, 0x216d3, 0x216d7, 0x216db]) assert.throws(() => readAnnualLedger(b.subarray(0, end), r));
    assert.throws(() => readAnnualLedger(b, { ...r, ds3e90: -1 }));
  }
});

test('report reproduces every expense account, principal exclusion and unsigned carry/borrow boundaries', () => {
  const d = setup(), f = d.world.farm, a = d.accounts, l = d.ledger;
  Object.assign(f, { cropIncome: 0xffffffff, contractGains: 2, seedExpenses: 3, rentalExpenses: 5, contractLosses: 7, landExpenses: 11,
    workerExpenses: 0x80000000, chemicalExpenses: 0xffffffff });
  Object.assign(a, { landIncome: 17, equipmentExpenses: 19, taxExpenses: 23, balancePayments: 0xffffffff });
  Object.assign(a.assets, { equipmentIncome: 29, livestockIncome: 31 });
  Object.assign(l, { otherExpenses: 37, livestockExpenses: 41 });
  const before = JSON.stringify([d.world, a]); updateAnnualReport(f, a, l);
  assert.equal(l.reportIncome, 91 /* -1+2+17+29+31+13 */);
  assert.equal(l.reportExpenses, 2147483892 /* 37+5+29+41+23+19+17+23+11+7+11+19+3 */);
  assert.equal(l.reportNet, (91 - 2147483892) >>> 0); assert.equal(JSON.stringify([d.world, a]), before);
  f.workerExpenses = f.chemicalExpenses = a.balancePayments = 0;
  updateAnnualReport(f, a, l); assert.equal(l.reportNet, (-154) >>> 0);
  l.otherExpenses = 0xffffffff; updateAnnualReport(f, a, l);
  assert.equal(l.reportExpenses, 207); assert.equal(l.reportNet, (-116) >>> 0);
});

test('annual reset clears only original accounts, carries taxes, retains reports and resets both precipitation views', () => {
  for (let id = 0; id < 8; id++) {
    const d = setup(id), f = d.world.farm, a = d.accounts, l = d.ledger;
    f.workerExpenses = 999; f.chemicalExpenses = 777; f.salesAccumulator = 456;
    a.taxExpenses = 0xffffffff; a.balancePayments = 999;
    const original = JSON.stringify([d.world.cells, d.world.fields, d.world.inventory]);
    const cash = f.cash, book = [a.buildingBookValue, a.assets.equipmentBookValue], reports = [l.reportIncome, l.reportExpenses, l.reportNet];
    resetAnnualLedgers(f, a, l, d.weather);
    for (const key of ['cropIncome', 'contractGains', 'seedExpenses', 'rentalExpenses', 'landExpenses', 'contractLosses', 'chemicalExpenses', 'workerExpenses', 'precipitationDays'] as const) assert.equal(f[key], 0);
    for (const key of ['ds3e70', 'ds3e8c', 'ds3e90', 'ds3e94', 'ds3e9c', 'livestockExpenses', 'otherExpenses'] as const) assert.equal(l[key], 0);
    assert.deepEqual([a.assets.equipmentIncome, a.assets.livestockIncome, a.landIncome, a.equipmentExpenses, a.balancePayments, a.taxExpenses], [0, 0, 0, 0, 0, 0]);
    assert.equal(l.priorTaxExpenses, 0xffffffff); assert.equal(d.weather.precipitationDays, 0);
    assert.equal(f.workerExpenses, 0); assert.equal(f.salesAccumulator, 456); assert.equal(f.cash, cash);
    assert.deepEqual([a.buildingBookValue, a.assets.equipmentBookValue], book);
    assert.deepEqual([l.reportIncome, l.reportExpenses, l.reportNet], reports);
    assert.equal(JSON.stringify([d.world.cells, d.world.fields, d.world.inventory]), original);
    updateAnnualReport(f, a, l); assert.deepEqual([l.reportIncome, l.reportExpenses, l.reportNet], [0, 0xffffffff, 1]);
    resetAnnualLedgers(f, a, l, d.weather); assert.equal(l.priorTaxExpenses, 0); assert.equal(f.workerExpenses, 0);
  }
});

test('annual validation rejects malformed ledgers before report or reset mutation', () => {
  for (const bad of ['ledger', 'farm', 'account', 'weather'] as const) {
    const d = setup();
    if (bad === 'ledger') d.ledger.ds3e94 = NaN;
    if (bad === 'farm') d.world.farm.landExpenses = -1;
    if (bad === 'account') d.accounts.assets.livestockIncome = 0x100000000;
    if (bad === 'weather') d.weather.precipitationDays = 65536;
    const before = JSON.stringify(d);
    assert.throws(() => resetAnnualLedgers(d.world.farm, d.accounts, d.ledger, d.weather));
    assert.equal(JSON.stringify(d), before);
    if (bad !== 'weather') { assert.throws(() => updateAnnualReport(d.world.farm, d.accounts, d.ledger)); assert.equal(JSON.stringify(d), before); }
  }
});
