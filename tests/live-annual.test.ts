import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { GameSimulation } from './support/game';
import { FarmRandom } from '../src/simulation/random';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function fixture(mutate: (save: any) => void = () => {}) {
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  scenario.schedule.bytes.fill(0);
  Object.assign(scenario.farm.calendar, { day: 6, week: 3, month: 11 });
  Object.assign(scenario.farm, { salesAccumulator: 1000, cropIncome: 500, seedExpenses: 100, workerExpenses: 77 });
  const save = JSON.parse(new GameSimulation(scenario, crops).save(4));
  save.runtime.finances.town.townRevenue = 50000;
  mutate(save);
  return { crops, save, game: GameSimulation.load(JSON.stringify(save), crops).simulation };
}

test('annual tax and reservation precede a saved modal choice; choice resumes reset, projection and January payment exactly once', () => {
  const exe = source('SIMFARM.EXE');
  assert.equal(exe.subarray(0xcdf4, 0xce03).toString('hex'), '9a640d661a9a360b661a9a3210e624');
  assert.equal(exe.subarray(0x3c03f, 0x3c043).toString('hex'), '26a2dbfe');
  assert.equal(exe.subarray(0x3c04a, 0x3c04e).toString('hex'), '26a2dcfe');
  const { game, crops } = fixture(s => {
    Object.assign(s.runtime.finances.debt, { balanceDue: 60, balanceCountdown: 1, unpaidTaxes: 80, taxCountdown: 1 });
    Object.assign(s.runtime.finances.loan, { principal: 1000, scheduledPayment: 101 });
    s.runtime.finances.accounts.taxExpenses = 12;
  });
  const before = game.getSnapshot();
  game.dispatch({ type: 'advance-day' });
  const pending = game.getSnapshot(), p = pending.pendingTown; assert.ok(p);
  assert.deepEqual(pending.lastTaxSettlement?.assessment, { salesDivisor: 10, salesTax: 100, landValue: 456968, landTax: 4615, arrears: 0, total: 4715 });
  assert.equal(p.phase, 'annual-reset'); assert.equal(pending.paused, true); assert.equal(p.resumeRunning, false);
  assert.equal(pending.daysAdvanced, 0); assert.equal(pending.scenario.farm.cash, 40000 - 60 - 80 - 4715);
  assert.equal(pending.scenario.farm.salesAccumulator, 0); assert.equal(pending.scenario.farm.cropIncome, 500);
  assert.equal(pending.finances.loan.principal, 1000); assert.equal(pending.finances.accounts.balancePayments, 60);
  assert.equal(pending.finances.accounts.taxExpenses, 12 + 80 + 4715);
  assert.equal(pending.finances.town.expansionFunds, 40000 + (4715 >> 2) - 15000);
  assert.equal(pending.finances.town.townRevenue, 50000 + 4715 - (4715 >> 2) - 12200);
  assert.deepEqual(pending.finances.town.activeSite, p.site);
  assert.equal(pending.scenario.regionalConditions[(p.site.regionX * 12 + p.site.regionY) * 7 + 1], 2);
  assert.deepEqual(pending.scenario.schedule.bytes, before.scenario.schedule.bytes);
  const text = game.save(4), saved = JSON.parse(text), restored = GameSimulation.load(text, crops).simulation;
  assert.deepEqual(JSON.parse(restored.save(4)), JSON.parse(text));
  const expected = new FarmRandom(saved.runtime.random), district = Math.min(3, (expected.nextSimulation() & 3) + 1), rate = (expected.nextSimulation() & 7) + 8;
  pending.pendingTown!.site.regionX = 99;
  for (const command of [{ type: 'advance-day' }, { type: 'borrow', amount: 1 }, { type: 'set-speed', speed: 16 }, { type: 'set-paused', paused: false }] as const) game.dispatch(command);
  game.tick(100000); assert.equal(game.save(4), text);
  for (const sim of [game, restored]) sim.dispatch({ type: 'choose-town', choice: 'commercial' });
  assert.equal(restored.save(4), game.save(4));
  const after = game.getSnapshot(); assert.equal(after.pendingTown, null); assert.equal(after.paused, true);
  assert.equal(after.daysAdvanced, 1); assert.equal(after.scenario.farm.cash, 40000 - 60 - 80 - 4715 - 101);
  assert.equal(after.scenario.farm.seedExpenses, 0); assert.equal(after.scenario.farm.cropIncome, 0);
  assert.equal(after.scenario.farm.workerExpenses, 77); // SF-042 retained.
  assert.equal(after.finances.annual.priorTaxExpenses, 12 + 80 + 4715); assert.equal(after.finances.accounts.taxExpenses, 0);
  assert.equal(after.finances.accounts.balancePayments, 101); assert.equal(after.finances.loan.principal, 899);
  assert.equal(after.finances.loanRate, rate); assert.equal(after.weather.temperatureYear, (before.weather.temperatureYear + 1) % 5);
  assert.ok(after.lastTownResult?.ok); assert.equal(after.lastTownResult.type, district);
  assert.equal(after.scenario.regionalConditions[(after.lastTownResult.site.regionX * 12 + after.lastTownResult.site.regionY) * 7], district);
  const done = game.save(4); game.dispatch({ type: 'choose-town', choice: 'airport' }); assert.equal(game.save(4), done);
});

test('failed recreation and random recreation keep the reserved plot pending; running sessions drop the interrupted frame and resume after a valid choice', () => {
  const { game, crops } = fixture(s => { s.runtime.finances.town.recreationCount = 7; s.runtime.random.bounded = 6; });
  game.dispatch({ type: 'set-paused', paused: false }); game.tick(100000);
  assert.ok(game.getSnapshot().pendingTown?.resumeRunning); assert.equal(game.getSnapshot().daysAdvanced, 0);
  const text = game.save(4);
  game.dispatch({ type: 'choose-town', choice: 'recreational' });
  assert.deepEqual(game.getSnapshot().lastTownResult, { ok: false, reason: 'recreation-limit' }); assert.equal(game.save(4), text);
  game.dispatch({ type: 'choose-town', choice: 'timeout' });
  assert.deepEqual(game.getSnapshot().lastTownResult, { ok: false, reason: 'recreation-limit' });
  const pending = JSON.parse(game.save(4)); assert.equal(pending.runtime.random.bounded, 3); assert.ok(pending.runtime.pendingTown);
  const restored = GameSimulation.load(game.save(4), crops).simulation;
  for (const sim of [game, restored]) sim.dispatch({ type: 'choose-town', choice: 'airport' });
  assert.equal(restored.save(4), game.save(4)); assert.equal(game.getSnapshot().daysAdvanced, 1);
  assert.equal(game.getSnapshot().paused, false); game.tick(1000); assert.equal(game.getSnapshot().daysAdvanced, 2);
});

test('failed annual tax creates penalties and a three-month countdown without replaying a retry or skipping reset', () => {
  const { game } = fixture(s => {
    s.scenario.farm.cash = 0;
    Object.assign(s.runtime.finances.debt, { unpaidTaxes: 100, taxCountdown: 2 });
    s.runtime.finances.accounts.taxExpenses = 50;
  });
  game.dispatch({ type: 'advance-day' }); const after = game.getSnapshot();
  assert.equal(after.lastTaxSettlement?.assessment.total, 4815); assert.equal(after.lastTaxSettlement.paid, false);
  assert.equal(after.finances.debt.unpaidTaxes, 100 + 25 + (4815 >> 2) + 4815);
  assert.equal(after.finances.debt.taxCountdown, 3); assert.equal(after.finances.taxFailures, 1);
  assert.equal(after.finances.town.townRevenue, (-4815) >>> 0);
  assert.equal(after.pendingTown, null); assert.equal(after.daysAdvanced, 1);
  assert.equal(after.finances.annual.priorTaxExpenses, 50); assert.equal(after.scenario.farm.salesAccumulator, 0);
  assert.deepEqual(after.financeNotices, [162, 159]);
  for (let day = 0; day < 27; day++) game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().finances.debt.taxCountdown, 3);
  game.dispatch({ type: 'advance-day' }); assert.equal(game.getSnapshot().finances.debt.taxCountdown, 2);
});

test('year-end without affordable expansion completes immediately and runs scheduled payments after tax and reset', () => {
  const { game } = fixture(s => {
    s.runtime.finances.town.expansionFunds = 0;
    Object.assign(s.runtime.finances.loan, { principal: 10000, scheduledPayment: 39000 });
  });
  game.dispatch({ type: 'advance-day' }); const after = game.getSnapshot();
  assert.equal(after.pendingTown, null); assert.equal(after.daysAdvanced, 1); assert.equal(after.scenario.farm.cash, 35285);
  assert.equal(after.finances.debt.balanceDue, 39000); assert.equal(after.finances.debt.balanceCountdown, 4);
  assert.equal(after.finances.annual.priorTaxExpenses, 4715); assert.equal(after.finances.accounts.taxExpenses, 0);
  assert.equal(after.finances.accounts.balancePayments, 0); assert.equal(after.finances.town.expansionFunds, 1178);
  assert.deepEqual(after.financeNotices, [166]);
});

test('version-six town continuations reject missing or inconsistent phases, coordinates and clocks; older saves migrate without replaying an event', () => {
  const { game, crops, save } = fixture();
  for (const version of [1, 2, 3, 4, 5]) {
    const old = structuredClone(save); old.version = version; delete old.runtime.pendingTown;
    const loaded = GameSimulation.load(JSON.stringify(old), crops).simulation;
    assert.equal(loaded.getSnapshot().pendingTown, null); assert.equal(loaded.getSnapshot().daysAdvanced, 0);
  }
  game.dispatch({ type: 'advance-day' }); const text = game.save(4), saved = JSON.parse(text);
  const mutations = [
    (s: any) => { delete s.runtime.pendingTown; }, (s: any) => { s.runtime.pendingTown.phase = 'tax'; },
    (s: any) => { s.runtime.pendingTown.resumeRunning = 1; }, (s: any) => { s.runtime.pendingTown.site.regionX = 12; },
    (s: any) => { s.runtime.pendingTown.site.regionX = 11; }, (s: any) => { s.runtime.paused = false; },
    (s: any) => { s.runtime.finances.defaultDecision = { status: 'pending', originalExitCode: 0 }; },
    (s: any) => { s.runtime.elapsed = 0.5; }, (s: any) => { s.runtime.dayTicks = 1; },
    (s: any) => { s.scenario.farm.calendar.month = 1; }, (s: any) => { s.scenario.farm.salesAccumulator = 1; },
    (s: any) => { const r = Buffer.from(s.scenario.regions, 'hex'), p = s.runtime.pendingTown.site; r[(p.regionX * 12 + p.regionY) * 7 + 1] = 0; s.scenario.regions = r.toString('hex'); },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(saved); mutate(bad);
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), crops), /pending town/); assert.equal(game.save(4), text);
  }
});
