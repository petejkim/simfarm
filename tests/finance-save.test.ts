import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFinancialState } from '../src/formats/finance';
import { encodeFinancialState } from '../src/formats/finance-save';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { GameSimulation } from './support/game';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const setup = (id = 4) => {
  const scenario = readScenario(source(`SCEN${id}.SSM`));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  return { crops, game: new GameSimulation(scenario, crops) };
};

test('financial cold import pins original runtime initializers, sequential town revenue load and all eight farms', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  for (const address of [0x3e54, 0x3e40, 0x3e70, 0x3e8c, 0x3e90, 0x3e94, 0x3e9c]) assert.equal(e.readUInt32LE(0x846f0 + address), 0);
  assert.equal(e.readUInt16LE(0x846f0 + 0x7514), 0); assert.equal(e[0x846f0 + 0x3eed], 0);
  assert.equal(e.readUInt32LE(0x846f0 + 0x758e), 40000); assert.equal(e.readUInt16LE(0x846f0 + 0xb3a4), 15);
  exact(0x4061b, '26c7068e75409c26c70690750000'); assert.equal(e.readUInt16LE(0x846f0 + 0xcdcc), 0x6190);
  exact(0x46250, '689f4d68d7fe');
  for (let at = 0x4625e; at < 0x463f6; at += 24) {
    exact(at, 'ff76e6ff76e46a016a01'); exact(at + 16, '9a4a078400');
  }
  exact(0x463fc, '6a016a04689061688a75');
  exact(0x460b8, '689f4d68dbfe'); exact(0x460d0, '689f4d68dcfe');
  for (let id = 0; id < 8; id++) {
    const b = source(`SCEN${id}.SSM`), f = readFinancialState(b), original = Uint8Array.from(b);
    assert.equal(f.town.townRevenue, b.readUInt32LE(0x2173c)); assert.equal(f.town.expansionFunds, 40000);
    assert.deepEqual(f.town.activeSite, { regionX: b[0x2170f], regionY: b[0x21710] });
    assert.equal(f.loanRate, 15); assert.equal(f.accounts.buildingBookValue, 0); assert.equal(f.debt.balanceDue, 0);
    assert.equal(f.annual.ds3e70, 0); assert.equal(f.clearing.x[63], 255);
    f.accounts.assets.animalDefinitions[4].bytes[17] ^= 255; f.town.recreationCoordinates[15] ^= 255;
    assert.deepEqual(Uint8Array.from(b), original);
  }
  const b = source('SCEN0.SSM'); b.writeUInt32LE(0xf1234567, 0x2173c);
  assert.equal(readFinancialState(b).town.townRevenue, 0xf1234567);
  assert.throws(() => readFinancialState(b.subarray(0, 0x2173f)));
  b[0x2170f] = 12; assert.throws(() => readFinancialState(b), /town site/);
});

test('all original farms save and restore financial state independently of UI snapshots', () => {
  for (let id = 0; id < 8; id++) {
    const { game, crops } = setup(id), text = game.save(id), saved = JSON.parse(text);
    assert.equal(saved.version, 29);
    assert.deepEqual(saved.runtime.finances, encodeFinancialState(readFinancialState(source(`SCEN${id}.SSM`))));
    const view = game.getSnapshot().finances;
    view.accounts.assets.animalDefinitions[0].bytes.fill(255); view.accounts.otherDefinitions[0].bytes.fill(0);
    view.annual.ds3e70 = 123; view.loan.principal = 123; view.debt.unpaidTaxes = 123;
    view.statistics.words.fill(65535); view.statistics.regions.fill(255); view.statistics.fieldPresence.fill(1);
    view.town.recreationCoordinates.fill(255); view.town.activeSite.regionX = 11; view.clearing.x.fill(0);
    assert.equal(game.save(id), text);
    const restored = GameSimulation.load(text, crops).simulation;
    assert.deepEqual(JSON.parse(restored.save(id)), JSON.parse(text));
    restored.dispatch({ type: 'advance-day' }); game.dispatch({ type: 'advance-day' });
    assert.deepEqual(JSON.parse(restored.save(id)), JSON.parse(game.save(id)));
  }
});

test('native financial restore retains changed ledgers, raw definitions, debts, rate, town and in-flight clearing without startup resets', () => {
  const { game, crops } = setup(), saved = JSON.parse(game.save(4)), f = saved.runtime.finances;
  Object.assign(f.accounts, { buildingBookValue: 0x87654321, taxExpenses: 777, balancePayments: 888, landIncome: 999 });
  Object.assign(f.accounts.assets, { equipmentBookValue: 200, equipmentIncome: 201, livestockIncome: 202 });
  f.accounts.assets.animalDefinitions[4][17] = 173; f.accounts.otherDefinitions[16][17] = 174;
  for (const key of Object.keys(f.annual)) f.annual[key] = 0xffffffff;
  Object.assign(f.debt, { balanceDue: 98, balanceCountdown: 4, unpaidTaxes: 99, taxCountdown: 3 });
  Object.assign(f.loan, { principal: 100, scheduledPayment: 20, availableCredit: 123, selectedAmount: 1 });
  f.loanRate = 11; f.taxFailures = 255;
  Object.assign(f.town, { expansionFunds: 123456, townRevenue: 0xffffffff, developmentSpent: 65535, activeSite: { regionX: 11, regionY: 0 } });
  f.town.recreationCoordinates[15] = 255;
  Object.assign(f.clearing, { count: 1, cursor: 1, lastTick: 65535 }); f.clearing.x[1] = 95; f.clearing.y[1] = 94;
  const restored = GameSimulation.load(JSON.stringify(saved), crops).simulation;
  assert.deepEqual(JSON.parse(restored.save(4)).runtime.finances, f);
  restored.dispatch({ type: 'advance-day' });
  // This source farm crosses a month boundary: retry debts and advance the saved clearing queue.
  const after = structuredClone(f); after.accounts.balancePayments += 98; after.accounts.taxExpenses += 99;
  // First tick is already >=16 past 65535, then updates occur every sixteen ticks.
  after.clearing.lastTick = (saved.scenario.farm.animationTicks + 1 + 16 * Math.floor(saved.scenario.farm.dayDelayTicks / 16)) & 65535;
  Object.assign(after.debt, { balanceDue: 0, balanceCountdown: 0, unpaidTaxes: 0, taxCountdown: 0 });
  // Original farm's eight active fields have pre-water flood and nutrient flags (0x82).
  Object.assign(after.statistics, { fieldPresence: [0, 1, 0, 0, 0, 0, 0, 1], distinctFieldStatuses: 2, nutrientDeficientFields: 8 });
  assert.deepEqual(JSON.parse(restored.save(4)).runtime.finances, after);
  f.loan.principal = 0; assert.equal(restored.getSnapshot().finances.loan.principal, 100);
});

test('v7 statistics persist raw history and reject malformed members; v1–6 initialize absent history only once', () => {
  const { game, crops } = setup(), text = game.save(4), base = JSON.parse(text), initial = base.runtime.finances.statistics;
  for (const version of [1, 2, 3, 4, 5, 6]) {
    const old = structuredClone(base); old.version = version; delete old.runtime.finances.statistics;
    if (version < 3) delete old.runtime.finances;
    if (version < 4 && old.runtime.finances) delete old.runtime.finances.defaultDecision;
    const loaded = GameSimulation.load(JSON.stringify(old), crops).simulation;
    assert.deepEqual(loaded.getSnapshot().finances.statistics, initial);
    assert.equal(JSON.parse(loaded.save(4)).version, 29);
    assert.deepEqual(JSON.parse(GameSimulation.load(loaded.save(4), crops).simulation.save(4)), JSON.parse(loaded.save(4)));
  }
  const changed = structuredClone(base), stats = changed.runtime.finances.statistics;
  Object.assign(stats, { ds3e58: 0xffffffff, ds3e5c: 0x80000000, regions: [255, 254, 253, 252],
    words: Array(14).fill(65535), fieldPresence: [1, 0, 1, 0, 1, 0, 1, 0], distinctFieldStatuses: 8,
    nutrientDeficientFields: 65535, chemicallyStressedFields: 65534 });
  const loaded = GameSimulation.load(JSON.stringify(changed), crops).simulation;
  assert.deepEqual(loaded.getSnapshot().finances.statistics, stats); // Raw cached counts need not agree with current fields.
  const mutations = [
    (f: any) => { delete f.statistics; }, ...Object.keys(stats).map(k => (f: any) => { delete f.statistics[k]; }),
    (f: any) => { f.statistics.ds3e58 = -1; }, (f: any) => { f.statistics.ds3e5c = 0x100000000; },
    (f: any) => { f.statistics.regions[0] = 256; }, (f: any) => { f.statistics.regions.pop(); },
    (f: any) => { f.statistics.words[13] = 65536; }, (f: any) => { f.statistics.words[0] = '1'; },
    (f: any) => { f.statistics.words.pop(); }, (f: any) => { f.statistics.fieldPresence[0] = 256; },
    (f: any) => { f.statistics.distinctFieldStatuses = 9; }, (f: any) => { f.statistics.nutrientDeficientFields = 65536; },
    (f: any) => { f.statistics.chemicallyStressedFields = 0.5; },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(base); mutate(bad.runtime.finances);
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), crops), /financial state/); assert.equal(game.save(4), text);
  }
});

test('legacy versions migrate absent finances once while preserving existing farm ledgers and malformed current state is rejected', () => {
  const { game, crops } = setup(), text = game.save(4), base = JSON.parse(text);
  for (const version of [1, 2]) {
    const old = structuredClone(base); old.version = version; delete old.runtime.finances;
    old.scenario.farm.workerExpenses = 321; old.scenario.farm.cash = 456;
    if (version === 1) delete old.scenario.schedule;
    const loaded = GameSimulation.load(JSON.stringify(old), crops).simulation;
    assert.equal(loaded.getSnapshot().scenario.farm.workerExpenses, 321); assert.equal(loaded.getSnapshot().scenario.farm.cash, 456);
    assert.deepEqual(JSON.parse(loaded.save(4)).runtime.finances, base.runtime.finances);
  }
  const mutations = [
    (f: any) => { delete f.loan; }, (f: any) => { f.loan.principal = -1; }, (f: any) => { f.annual.ds3e70 = 0x100000000; },
    (f: any) => { f.loanRate = 65536; }, (f: any) => { f.accounts.homeRegionX = 12; }, (f: any) => { f.debt.balanceCountdown = 256; },
    (f: any) => { f.taxFailures = '0'; }, (f: any) => { f.accounts.assets.animalDefinitions.pop(); },
    (f: any) => { f.accounts.assets.animalDefinitions[0][17] = 256; }, (f: any) => { f.accounts.otherDefinitions[0][2] = 0; },
    (f: any) => { f.town.activeSite.regionY = 12; }, (f: any) => { f.town.recreationCoordinates.pop(); },
    (f: any) => { f.clearing.count = 65; }, (f: any) => { f.clearing.cursor = 64; },
    (f: any) => { f.clearing.x[0] = 96; }, (f: any) => { f.clearing.x[0] = 0; f.clearing.y[0] = 96; },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(base); mutate(bad.runtime.finances);
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), crops), /financial state/); assert.equal(game.save(4), text);
  }
  delete base.runtime.finances;
  assert.throws(() => GameSimulation.load(JSON.stringify(base), crops), /financial state/);
});
