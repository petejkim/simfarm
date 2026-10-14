import { declineTownEvents } from './support/town-events';
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { GameSimulation } from './support/game';
import { isLoanPaymentMonth } from '../src/simulation/loan';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const setup = (id = 4) => {
  const s = readScenario(source(`SCEN${id}.SSM`)); s.schedule.bytes.fill(0);
  const crops = s.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  return { crops, game: new GameSimulation(s, crops) };
};
const restored = (mutate: (s: any) => void) => {
  const { game, crops } = setup(), save = JSON.parse(game.save(4)); mutate(save);
  return { game: GameSimulation.load(JSON.stringify(save), crops).simulation, crops };
};
const boundary = (s: any, month = 1) => Object.assign(s.scenario.farm.calendar, { day: 6, week: 3, month });

test('legacy zero-debt countdowns load exactly then retire without liquidation or loan settlement', () => {
  for (const countdown of [1, 3]) {
    const { game, crops } = restored(s => {
      boundary(s, 0); s.scenario.farm.cash = 0;
      Object.assign(s.runtime.finances.debt, { balanceDue: 0, unpaidTaxes: 0, balanceCountdown: countdown, taxCountdown: countdown });
      Object.assign(s.runtime.finances.loan, { principal: 1000, scheduledPayment: 0 });
    });
    const text = game.save(4), copy = GameSimulation.load(text, crops).simulation, before = game.getSnapshot();
    assert.equal(copy.save(4), text);
    for (const sim of [game, copy]) sim.dispatch({ type: 'advance-day' });
    assert.equal(copy.save(4), game.save(4));
    const after = game.getSnapshot();
    assert.deepEqual(after.finances.debt, { balanceDue: 0, unpaidTaxes: 0, balanceCountdown: 0, taxCountdown: 0 });
    assert.equal(after.finances.defaultDecision, null); assert.deepEqual(after.financeNotices, []);
    assert.deepEqual(after.finances.loan, before.finances.loan);
    assert.equal(after.finances.accounts.balancePayments, before.finances.accounts.balancePayments);
    assert.equal(after.finances.accounts.taxExpenses, before.finances.accounts.taxExpenses);
    assert.equal(after.scenario.farm.cash, 0); assert.equal(after.scenario.farm.cropIncome, before.scenario.farm.cropIncome);
    assert.deepEqual(after.scenario.inventory.filter(i => i.active).map(i => i.slot), before.scenario.inventory.filter(i => i.active).map(i => i.slot));
    assert.equal(after.daysAdvanced, 1);
    const completed = game.save(4), continued = GameSimulation.load(completed, crops).simulation;
    assert.equal(continued.save(4), completed); continued.dispatch({ type: 'advance-day' });
    assert.equal(continued.getSnapshot().daysAdvanced, 2); assert.equal(continued.getSnapshot().finances.defaultDecision, null);
  }
});

test('live borrowing and full payoff work on every original farm, preserve checkpoints and detach feedback', () => {
  for (let id = 0; id < 8; id++) {
    const { game, crops } = setup(id), before = game.getSnapshot(), cash = before.scenario.farm.cash;
    game.dispatch({ type: 'borrow', amount: 400 });
    assert.equal(game.getSnapshot().scenario.farm.cash, cash + 400); assert.equal(game.getSnapshot().finances.loan.principal, 400);
    assert.deepEqual(game.getSnapshot().lastLoanResult, { kind: 'borrow', ok: true, amount: 400, installment: 23 });
    const loaded = GameSimulation.load(game.save(id), crops).simulation;
    assert.equal(loaded.getSnapshot().finances.loan.principal, 400); assert.equal(loaded.getSnapshot().lastLoanResult, null);
    loaded.dispatch({ type: 'repay-loan' });
    assert.equal(loaded.getSnapshot().scenario.farm.cash, cash); assert.equal(loaded.getSnapshot().finances.loan.principal, 0);
    assert.equal(loaded.getSnapshot().finances.accounts.balancePayments, before.finances.accounts.balancePayments + 400);
    assert.equal(loaded.getSnapshot().finances.town.expansionFunds, before.finances.town.expansionFunds + 200);
    assert.equal(loaded.getSnapshot().finances.town.townRevenue, before.finances.town.townRevenue + 100);
    loaded.getSnapshot().finances.loan.principal = 99;
    assert.equal(JSON.parse(loaded.save(id)).runtime.finances.loan.principal, 0);
  }
});

test('live calendar charges only the four recovered loan months and restores identical next-month continuation', () => {
  for (let month = 0; month < 12; month++) {
    const { game, crops } = restored(s => {
      boundary(s, month); s.scenario.farm.cash = 10000;
      s.runtime.finances.loan.principal = 1000; s.runtime.finances.loan.scheduledPayment = 101;
    });
    const copy = GameSimulation.load(game.save(4), crops).simulation;
    game.dispatch({ type: 'advance-day' }); copy.dispatch({ type: 'advance-day' });
    declineTownEvents(game); declineTownEvents(copy);
    const nextMonth = (month + 1) % 12, paid = isLoanPaymentMonth(nextMonth), state = game.getSnapshot();
    assert.equal(state.scenario.farm.calendar.month, nextMonth);
    assert.equal(state.finances.loan.principal, paid ? 899 : 1000);
    assert.equal(state.scenario.farm.cash, paid ? 9899 : 10000);
    assert.equal(state.finances.loan.scheduledPayment, 101);
    if (month === 11) {
      assert.ok(state.finances.loanRate >= 8 && state.finances.loanRate <= 15);
      // This fixture cannot afford its original sales tax: no tax debit, but
      // annual penalties/countdown are now live before the January installment.
      assert.equal(state.lastTaxSettlement?.paid, false);
      assert.equal(state.finances.debt.taxCountdown, 3); assert.ok(state.finances.debt.unpaidTaxes > 0);
    }
    assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(copy.save(4)));
  }
});

test('monthly arrears run before a new installment, settling principal before a new source installment failure', () => {
  const { game } = restored(s => {
    boundary(s); s.scenario.farm.cash = 110;
    Object.assign(s.runtime.finances.loan, { principal: 1000, scheduledPayment: 100 });
    Object.assign(s.runtime.finances.debt, { balanceDue: 60, balanceCountdown: 2 });
  });
  const before = game.getSnapshot().finances;
  game.dispatch({ type: 'advance-day' }); const after = game.getSnapshot();
  assert.equal(after.scenario.farm.cash, 50); assert.equal(after.finances.loan.principal, 940);
  assert.equal(after.finances.debt.balanceDue, 100); assert.equal(after.finances.debt.balanceCountdown, 4);
  assert.equal(after.finances.accounts.balancePayments, before.accounts.balancePayments + 60);
  assert.equal(after.finances.town.expansionFunds, before.town.expansionFunds+30);
  assert.deepEqual(after.financeNotices, [170, 166]);
});

test('unpayable live default freezes the entire frame, preserves home and debt, saves and resolves exactly once', () => {
  const { game, crops } = restored(s => {
    boundary(s, 0); s.scenario.farm.cash = 0;
    Object.assign(s.runtime.finances.debt, { balanceDue: 0xffffffff, balanceCountdown: 1 });
  });
  game.dispatch({ type: 'set-paused', paused: false }); game.tick(120000);
  const state = game.getSnapshot(), f = state.finances;
  assert.deepEqual(f.defaultDecision, { status: 'pending', originalExitCode: 0 }); assert.equal(state.paused, true);
  assert.equal(state.daysAdvanced, 1); assert.equal(f.debt.balanceDue, 0xffffffff);
  assert.equal(state.scenario.regionalConditions[(f.accounts.homeRegionX * 12 + f.accounts.homeRegionY) * 7 + 1], 1);
  const saved = game.save(4), loaded = GameSimulation.load(saved, crops).simulation;
  for (const g of [game, loaded]) {
    for (const command of [{ type: 'advance-day' }, { type: 'set-paused', paused: false }, { type: 'borrow', amount: 100 }, { type: 'repay-loan' }] as const) g.dispatch(command);
    g.tick(120000); assert.deepEqual(JSON.parse(g.save(4)), JSON.parse(saved));
  }
  loaded.dispatch({ type: 'resolve-default', choice: 'exit' });
  assert.deepEqual(loaded.getSnapshot().finances.defaultDecision, { status: 'exit', originalExitCode: 1 });
  loaded.dispatch({ type: 'resolve-default', choice: 'restart' });
  assert.equal(loaded.getSnapshot().finances.defaultDecision?.status, 'exit');
  game.dispatch({ type: 'resolve-default', choice: 'restart' });
  assert.deepEqual(game.getSnapshot().finances.defaultDecision, { status: 'restart', originalExitCode: 2 });
  assert.equal(GameSimulation.load(loaded.save(4), crops).simulation.getSnapshot().finances.debt.balanceDue, 0xffffffff);
});

test('version-three migration retains finance balances; current terminal decisions require matching flags and a paused clock', () => {
  const { game, crops } = setup(), original = JSON.parse(game.save(4));
  const old = structuredClone(original); old.version = 3; delete old.runtime.finances.defaultDecision;
  old.runtime.finances.loan.principal = 8765; old.runtime.finances.town.expansionFunds = 1234;
  const migrated = GameSimulation.load(JSON.stringify(old), crops).simulation.getSnapshot().finances;
  assert.equal(migrated.loan.principal, 8765); assert.equal(migrated.town.expansionFunds, 1234); assert.equal(migrated.defaultDecision, null);
  for (const decision of [undefined, {}, { status: 'pending', originalExitCode: 1 }, { status: 'resume', originalExitCode: 0 }]) {
    const bad = structuredClone(original); bad.runtime.finances.defaultDecision = decision;
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), crops));
  }
  original.runtime.finances.defaultDecision = { status: 'pending', originalExitCode: 0 }; original.runtime.paused = false;
  assert.throws(() => GameSimulation.load(JSON.stringify(original), crops), /unpaused terminal default/);
});


test('Bank reports collateral credit independently from cash capacity without mutating cached source accounts', () => {
  const { game, crops } = restored(s => {
    s.scenario.farm.cash = 9000000;
    s.runtime.finances.accounts.buildingBookValue = 3000000;
    s.runtime.finances.loan.availableCredit = 123;
    s.runtime.finances.loan.selectedAmount = 456;
  });
  const before = game.save(4), snapshot = game.getSnapshot();
  assert.ok(snapshot.loanCreditLimit > 1000000);
  assert.equal(snapshot.availableLoan, 999999);
  assert.equal(snapshot.finances.loan.availableCredit, 123);
  assert.equal(snapshot.finances.loan.selectedAmount, 456);
  assert.equal(game.save(4), before);
  const copy = GameSimulation.load(before, crops).simulation;
  assert.equal(copy.getSnapshot().loanCreditLimit, snapshot.loanCreditLimit);
  game.dispatch({ type: 'borrow', amount: 1000000 });
  assert.equal(game.getSnapshot().scenario.farm.cash, 9999999);
  assert.equal(game.getSnapshot().finances.loan.principal, 999999);
  assert.equal(game.getSnapshot().availableLoan, 0);
  assert.ok(game.getSnapshot().loanCreditLimit > 0);
});


test('paid arrears from cash or forced sale settle the loan once and resume identically from a checkpoint',()=>{
  for(const liquidation of [false,true]){
    const {game,crops}=restored(s=>{
      boundary(s,0);s.scenario.farm.cash=liquidation?0:100;
      Object.assign(s.runtime.finances.loan,{principal:1000,scheduledPayment:100,availableCredit:200});
      Object.assign(s.runtime.finances.debt,{balanceDue:100,balanceCountdown:liquidation?1:2,unpaidTaxes:0,taxCountdown:0});
    });
    const before=game.getSnapshot(),copy=GameSimulation.load(game.save(4),crops).simulation;
    for(const g of [game,copy])g.dispatch({type:'advance-day'});
    const after=game.getSnapshot();assert.equal(after.finances.debt.balanceDue,0);
    assert.equal(after.finances.loan.principal,900);assert.equal(after.finances.loan.availableCredit,300);
    assert.equal(after.finances.town.expansionFunds,before.finances.town.expansionFunds+50);
    assert.deepEqual(JSON.parse(game.save(4)),JSON.parse(copy.save(4)));
    game.dispatch({type:'advance-day'});assert.equal(game.getSnapshot().finances.loan.principal,900);
  }
});
