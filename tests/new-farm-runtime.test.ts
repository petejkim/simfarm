import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readNewFarmRuntimeDefaults } from '../src/formats/new-farm-runtime';
import { readNewFarmRecordDefaults, createSetupRecords } from '../src/formats/new-farm-records';
import { createSetupRuntime, resetSetupRuntime } from '../src/simulation/new-farm-runtime';
import { encodeFinancialState, decodeFinancialState } from '../src/formats/finance-save';

const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
const records = readNewFarmRecordDefaults(exe), defaults = readNewFarmRuntimeDefaults(exe);
const fresh = () => createSetupRuntime(defaults, createSetupRecords(records));

test('starting accounts and restart phases are pinned to source instructions and the initialized image', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x40345, '26c78768440000ff46fe837efe137ceb9a360b661a'); //19 words, then annual reset.
  exact(0x4061b, '26c7068e75409c26c706907500008e06cecd26c7068a75c01226c7068c750000');
  exact(0x40782, '26a34e128e0616ce26a350128e0618ce26a352128e061ace26c7065412c807');
  exact(0x407e8, '26a3bcd526a3bad58e0628ce26a3b0b326a3aeb38e062ace26a396b326a394b38e062cce26a3b4b3');
  exact(0x40818, '26a3b63e26a3b43e8e0630ce26a31a7526a318758e0632ce26a3463e26a3443e');
  exact(0x408d6, '26a2d6fe8e0656ce26a2d7fe');
  exact(0x1d3db, 'a3863ea3843ea38e3ea38c3e'); // Skips worker expenses3e88.
  exact(0x1d419, 'a1b43e8b16b63ea3403e8916423e2bc0a3b63ea3b43e');
  exact(0x1d64c, 'fe06ed3e'); // Failed tax payment increments DS3eed.
  exact(0x88538, '204e0000'); exact(0x8bc82, 'ffff'); exact(0x8fa94, '0f00');
});

test('cold setup is independent of SSM balances and retains unset town, calendar, rate and native queue correction', () => {
  const state = fresh();
  assert.deepEqual(state.farm, { cash: 20000, calendar: { day: 1, season: 1, week: 1, year: 1992, month: 0 },
    timerTicks: 0, animationTicks: 0, dayDelayTicks: 256, speed: 1, paceEquipment: true, precipitationDays: 0,
    autoRent: true, autoBuySeeds: true, autoClear: false, seedExpenses: 0, rentalExpenses: 0, cropIncome: 0,
    contractGains: 0, contractLosses: 0, salesAccumulator: 0, workerExpenses: 0, landExpenses: 0,
    chemicalExpenses: 0, townRegionX: 65535, townRegionY: 0 });
  assert.deepEqual(state.finances.loan, { principal: 0, scheduledPayment: 0, availableCredit: 0, selectedAmount: 0 });
  assert.deepEqual(state.finances.debt, { balanceDue: 0, balanceCountdown: 0, unpaidTaxes: 0, taxCountdown: 0 });
  assert.equal(state.finances.loanRate, 15); assert.equal(state.finances.taxFailures, 0);
  assert.deepEqual(state.finances.homestead, { x: 0, y: 0, rank: 255 });
  assert.equal(state.finances.town.townRevenue, 4800); assert.equal(state.finances.town.expansionFunds, 40000);
  assert.ok(Object.values(state.finances.annual).every(n => n === 0));
  assert.ok(state.finances.clearing.x.every(n => n === 255)); assert.equal(state.finances.clearing.count, 0);
  assert.deepEqual(state.raw, { ds3e4c: 0, ds3eb8: 0, ds4468: Array(19).fill(0), ds64c5: 0, s4d9fFedd: 0 });
  assert.deepEqual(encodeFinancialState(decodeFinancialState(encodeFinancialState(state.finances))), encodeFinancialState(state.finances));
});

test('account decoder preserves signed-looking dword bits and separates neighboring counters and coordinate arrays', () => {
  const input = Buffer.from(exe);
  const put = (segment: number, offset: number, value: number, width: number) => {
    const file = 0x4ec60 + (segment - 0x2be7) * 16 + offset;
    input.writeUIntLE(value, file, width);
  };
  // Distinct adjacent values catch ledger swaps, partial reads, and inferred totals.
  for (let i = 0; i < 33; i++) put(0x6190, 0x3e40 + i * 4, 0x80000001 + i, 4);
  put(0x6190, 0x3eed, 253, 1);
  put(0x6190, 0x7518, 0xffffffff, 4); put(0x2d9f, 0xd5ba, 0x89abcdef, 4);
  put(0x4d9f, 0xfed6, 254, 1); put(0x4d9f, 0xfed7, 255, 1);
  for (let i = 0; i < 8; i++) { put(0x2d9f, 0xf7aa + i, i + 10, 1); put(0x2d9f, 0xf7b2 + i, i + 30, 1); }
  for (let i = 0; i < 33; i++) put(0x6190, 0x444c + i * 2, i + 100, 2);
  const d = readNewFarmRuntimeDefaults(input), f = d.finances;
  assert.deepEqual([d.farm.salesAccumulator, d.farm.cash, f.accounts.buildingBookValue, f.accounts.assets.equipmentBookValue],
    [0x80000002, 0x80000003, 0x80000006, 0x80000005]);
  assert.equal(d.raw.ds3e4c, 0x80000004); // Distinct from runtime building ledger3e54.
  const ledger = [d.farm.cropIncome, f.accounts.assets.equipmentIncome, f.accounts.landIncome, d.farm.contractGains,
    f.annual.ds3e70, f.accounts.assets.livestockIncome, d.farm.seedExpenses, f.accounts.equipmentExpenses,
    d.farm.landExpenses, d.farm.contractLosses, d.farm.workerExpenses, f.annual.ds3e8c, f.annual.ds3e90,
    f.annual.ds3e94, f.annual.livestockExpenses, f.annual.ds3e9c, d.farm.chemicalExpenses,
    f.accounts.balancePayments, d.farm.rentalExpenses, f.annual.otherExpenses];
  assert.deepEqual(ledger, Array.from({ length: 20 }, (_, i) => 0x80000009 + i));
  assert.equal(f.annual.priorTaxExpenses, 0x80000001); assert.equal(f.accounts.taxExpenses, 0x8000001e);
  assert.equal(d.raw.ds3eb8, 0x8000001f); assert.equal(f.annual.reportIncome, 0x80000020); assert.equal(f.annual.reportExpenses, 0x80000021);
  assert.equal(f.taxFailures, 253);
  assert.deepEqual(f.debt, { balanceDue: 0x89abcdef, unpaidTaxes: 0xffffffff, balanceCountdown: 254, taxCountdown: 255 });
  assert.deepEqual(f.town.recreationCoordinates, Array.from({ length: 16 }, (_, i) => (i & 1 ? 30 : 10) + (i >>> 1)));
  assert.deepEqual(f.statistics.words, Array.from({ length: 14 }, (_, i) => i + 100));
  assert.deepEqual(d.raw.ds4468, Array.from({ length: 19 }, (_, i) => i + 114));
});

test('setup ownership detaches imported data while sharing canonical definition tables and rejects malformed inputs', () => {
  const r = createSetupRecords(records), state = createSetupRuntime(JSON.parse(JSON.stringify(defaults)), r);
  assert.equal(state.finances.accounts.assets.animalDefinitions, r.animalDefinitions);
  assert.equal(state.finances.accounts.otherDefinitions, r.otherDefinitions);
  state.finances.accounts.assets.animalDefinitions[0].count = 3;
  assert.equal(r.animalDefinitions[0].count, 3); assert.equal(createSetupRecords(records).animalDefinitions[0].count, 0);
  state.farm.calendar.year = 2001; state.raw.ds4468[0] = 400; state.finances.statistics.words[0] = 90;
  state.finances.town.recreationCoordinates[0] = 7;
  assert.equal(defaults.farm.calendar.year, 1992); assert.equal(defaults.raw.ds4468[0], 0);
  assert.equal(defaults.finances.statistics.words[0], 0); assert.equal(defaults.finances.town.recreationCoordinates[0], 0);
  assert.throws(() => readNewFarmRuntimeDefaults(exe.subarray(0, -1)), /executable/);
  const badExe = Buffer.from(exe); badExe[0] = 0; assert.throws(() => readNewFarmRuntimeDefaults(badExe), /executable/);
  for (const edit of [
    (d: typeof defaults) => { d.farm.calendar.day = 7; },
    (d: typeof defaults) => { d.farm.cash = -1; },
    (d: typeof defaults) => { delete (d.farm as Partial<typeof d.farm>).cash; },
    (d: typeof defaults) => { d.farm.timerTicks = 65536; },
    (d: typeof defaults) => { d.finances.loan.principal = 0x100000000; },
    (d: typeof defaults) => { d.raw.ds4468.pop(); },
  ]) {
    const bad = structuredClone(defaults); edit(bad);
    const before = r.animalDefinitions.map(d => [...d.bytes]);
    assert.throws(() => createSetupRuntime(bad, r)); assert.deepEqual(r.animalDefinitions.map(d => [...d.bytes]), before);
  }
});

test('restart clears source accounts and clocks but retains omitted ledgers, reports, history, coordinates and pacing', () => {
  const state = fresh(), { farm, finances: f, raw } = state;
  farm.cash = 76543; farm.workerExpenses = 0xffffffff; farm.salesAccumulator = 55;
  farm.cropIncome = farm.contractGains = farm.contractLosses = farm.seedExpenses = farm.rentalExpenses = farm.landExpenses = farm.chemicalExpenses = 123;
  farm.precipitationDays = 99; farm.timerTicks = 47; farm.animationTicks = 63;
  farm.dayDelayTicks = 12; farm.speed = 4; farm.paceEquipment = false;
  farm.autoRent = farm.autoBuySeeds = false; farm.autoClear = true;
  farm.calendar = { day: 6, season: 3, week: 3, year: 2020, month: 11 };
  f.accounts.assets.equipmentBookValue = 88; f.accounts.buildingBookValue = 99;
  f.accounts.taxExpenses = 0xfedcba98; f.accounts.balancePayments = 45;
  f.accounts.equipmentExpenses = f.accounts.landIncome = f.accounts.assets.equipmentIncome = f.accounts.assets.livestockIncome = 14;
  for (const key of Object.keys(f.annual) as (keyof typeof f.annual)[]) f.annual[key] = 93;
  f.loan = { principal: 100, availableCredit: 200, selectedAmount: 300, scheduledPayment: 400 };
  f.debt = { balanceDue: 41, unpaidTaxes: 42, balanceCountdown: 3, taxCountdown: 4 };
  f.taxFailures = 9; f.loanRate = 11; f.homestead = { x: 8, y: 16, rank: 4 };
  f.town.airportCount = 3; f.town.recreationCount = 4; f.town.developmentSpent = 37;
  f.town.activeSite = { regionX: 8, regionY: 9 }; f.town.recreationCoordinates.fill(17);
  f.statistics.words.fill(321); f.statistics.regions.fill(42); f.statistics.fieldPresence.fill(1);
  f.statistics.distinctFieldStatuses = 8; f.statistics.ds3e58 = 123; f.statistics.ds3e5c = 456;
  f.statistics.nutrientDeficientFields = 7; f.statistics.chemicallyStressedFields = 8;
  raw.ds3e4c = 987; raw.ds3eb8 = 123; raw.ds4468.fill(567); raw.ds64c5 = 9; raw.s4d9fFedd = 199;
  const weather = { precipitationDays: 99 };
  resetSetupRuntime(state, weather);
  assert.equal(farm.cash, 76543); assert.equal(farm.workerExpenses, 0xffffffff);
  assert.equal(f.annual.priorTaxExpenses, 0xfedcba98); assert.equal(f.accounts.taxExpenses, 0);
  for (const key of ['cropIncome', 'contractGains', 'contractLosses', 'seedExpenses', 'rentalExpenses', 'landExpenses', 'chemicalExpenses', 'salesAccumulator', 'timerTicks', 'animationTicks', 'precipitationDays'] as const) assert.equal(farm[key], 0, key);
  for (const key of ['equipmentExpenses', 'landIncome', 'balancePayments'] as const) assert.equal(f.accounts[key], 0, key);
  assert.equal(f.accounts.buildingBookValue, 99);
  assert.ok(Object.values(f.loan).every(n => n === 0)); assert.ok(Object.values(f.debt).every(n => n === 0));
  assert.equal(f.accounts.assets.equipmentBookValue, 0); assert.equal(weather.precipitationDays, 0);
  for (const key of ['ds3e70', 'ds3e8c', 'ds3e90', 'ds3e94', 'ds3e9c', 'livestockExpenses', 'otherExpenses'] as const) assert.equal(f.annual[key], 0);
  assert.deepEqual([f.annual.reportIncome, f.annual.reportExpenses, f.annual.reportNet], [93, 93, 93]);
  assert.deepEqual(farm.calendar, defaults.farm.calendar); assert.equal(farm.autoRent, true); assert.equal(farm.autoBuySeeds, true); assert.equal(farm.autoClear, false);
  assert.deepEqual([farm.dayDelayTicks, farm.speed, farm.paceEquipment, f.loanRate, f.taxFailures], [12, 4, true, 11, 9]);
  assert.deepEqual(f.homestead, { x: 8, y: 16, rank: 255 });
  assert.equal(f.town.airportCount, 0); assert.equal(f.town.recreationCount, 0);
  assert.equal(f.town.expansionFunds, 40000); assert.equal(f.town.townRevenue, 4800); assert.equal(f.town.developmentSpent, 37);
  assert.deepEqual(f.town.activeSite, { regionX: 8, regionY: 9 }); assert.ok(f.town.recreationCoordinates.every(n => n === 17));
  assert.ok(f.statistics.words.every(n => n === 321)); assert.ok(f.statistics.regions.every(n => n === 42));
  assert.ok(f.statistics.fieldPresence.every(n => n === 0)); assert.equal(f.statistics.distinctFieldStatuses, 0);
  assert.deepEqual([f.statistics.ds3e58, f.statistics.ds3e5c, f.statistics.nutrientDeficientFields, f.statistics.chemicallyStressedFields], [0, 0, 7, 8]);
  assert.deepEqual(raw, { ds3e4c: 0, ds3eb8: 0, ds4468: Array(19).fill(0), ds64c5: 0, s4d9fFedd: 199 });
  resetSetupRuntime(state, weather); assert.equal(f.annual.priorTaxExpenses, 0); assert.equal(farm.workerExpenses, 0xffffffff);
});

test('equipment pacing uses DSa8a0, independently of pause depth, and setup/resume restore its nonzero gate', () => {
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0x14a61, '263b06901f770f8e06d0c726803ea0a8007403');
  exact(0x4072b, '26c606a0a802'); exact(0x3f505, 'c606a0a802');
  exact(0x46193, '68a0a8');
  assert.equal(exe[0x846f0 + 0xa8a0], 2); assert.equal(exe[0x846f0 + 0x187], 0);
  const copy = Buffer.from(exe);
  for (let pacing = 0; pacing < 256; pacing++) {
    copy[0x846f0 + 0xa8a0] = pacing;
    copy[0x846f0 + 0x187] = pacing ? 0 : 255;
    assert.equal(readNewFarmRuntimeDefaults(copy).farm.paceEquipment, pacing !== 0);
  }
});
