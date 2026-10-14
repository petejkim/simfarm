import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readDefaultState } from '../src/formats/default-state';
import { readMonthlyDebtState } from '../src/formats/monthly-debt';
import { createClearingEffects } from '../src/simulation/clearing-effects';
import { retryMonthlyDebts } from '../src/simulation/monthly-finance';
import { assessAnnualTax } from '../src/simulation/tax';
import { resolveDefaultDecision } from '../src/simulation/default';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const setup = (id = 4) => { const bytes = source(`SCEN${id}.SSM`); return { world: readScenario(bytes), accounts: readDefaultState(bytes, 0),
  debt: readMonthlyDebtState(bytes, 0, 0), effects: createClearingEffects() }; };
const put = (b: Uint8Array, o: number, n: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).setUint16(o, n, true);

test('monthly retry categories, countdowns, success notices, warning branches and saved tax fields match source', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0xcc5d, '68e803'); exact(0xcd0b, '68c409'); exact(0xcc73, '26fe0ed6fe'); exact(0xcd21, '26fe0ed7fe');
  for (const [o, h] of [[0xccae, '68a800'], [0xccb4, '68a900'], [0xcce3, '68aa00'], [0xcd5f, '68a500'], [0xcd66, '68a200'], [0xcd95, '68a300'], [0xcdd3, '68a100']] as const) exact(o, h);
  exact(0xcd9e, '26833e561206'); exact(0xcda6, '26833e561209'); exact(0xcd98, 'eb3c');
  exact(0x4623b, '681875'); exact(0x46250, '689f4d68d7fe');
  for (let id = 0; id < 8; id++) {
    const b = source(`SCEN${id}.SSM`), debt = readMonthlyDebtState(b, 0x12345678, 255);
    assert.deepEqual(debt, { balanceDue: 0x12345678, balanceCountdown: 255, unpaidTaxes: b.readUInt32LE(0x21726), taxCountdown: b[0x2172a] });
  }
  assert.throws(() => readMonthlyDebtState(source('SCEN0.SSM').subarray(0, 0x2172a), 0, 0));
  assert.throws(() => readMonthlyDebtState(source('SCEN0.SSM'), -1, 0));
  assert.throws(() => readMonthlyDebtState(source('SCEN0.SSM'), 0, 256));
});

test('normal monthly payment handles the balance before taxes, clears matching debts and wraps only their expense ledgers', () => {
  for (let id = 0; id < 8; id++) {
    const { world, accounts, debt, effects } = setup(id);
    Object.assign(debt, { balanceDue: 70, balanceCountdown: 2, unpaidTaxes: 50, taxCountdown: 2 });
    world.farm.cash = 100; accounts.balancePayments = 0xfffffff0; accounts.taxExpenses = 0xfffffffe;
    const r = retryMonthlyDebts(world, accounts, debt, effects, 8, 1);
    assert.deepEqual(r, { loanPayment:70, notices: [170, 162], forcedSales: [], pendingDefault: null });
    assert.deepEqual(debt, { balanceDue: 0, balanceCountdown: 0, unpaidTaxes: 50, taxCountdown: 1 });
    assert.equal(world.farm.cash, 30); assert.equal(accounts.balancePayments, 54); assert.equal(accounts.taxExpenses, 0xfffffffe);
    world.farm.cash = 50;
    const r2 = retryMonthlyDebts(world, accounts, debt, effects, 8, 2);
    assert.deepEqual(r2.notices, [163]); assert.equal(debt.unpaidTaxes, 0); assert.equal(debt.taxCountdown, 0);
    assert.equal(world.farm.cash, 0); assert.equal(accounts.taxExpenses, 48);
  }
});

test('inactive countdowns preserve debt, and insufficient-funds countdowns step once without partial debit', () => {
  const { world, accounts, debt, effects } = setup();
  Object.assign(debt, { balanceDue: 200, balanceCountdown: 255, unpaidTaxes: 300, taxCountdown: 254 }); world.farm.cash = 100;
  for (let month = 1; month <= 12; month++) {
    const r = retryMonthlyDebts(world, accounts, debt, effects, 8, month);
    assert.deepEqual(r.notices, [169, 162]); assert.equal(world.farm.cash, 100);
  }
  assert.equal(debt.balanceCountdown, 243); assert.equal(debt.taxCountdown, 242);
  debt.balanceCountdown = debt.taxCountdown = 0;
  const before = JSON.stringify([world, accounts, debt, effects]);
  assert.deepEqual(retryMonthlyDebts(world, accounts, debt, effects, 8, 12).notices, []);
  assert.equal(JSON.stringify([world, accounts, debt, effects]), before);
});

test('expired balance and tax countdowns invoke their actual debt categories and clear debt only after payment', () => {
  for (const tax of [false, true]) {
    const { world, accounts, debt, effects } = setup(); world.farm.cash = 0;
    const i = world.inventory[1]; i.bytes.fill(0); put(i.bytes, 0, 168); put(i.bytes, 2, 100); i.bytes[8] = i.bytes[9] = 90; i.bytes[10] = 32;
    world.harvestDefinitions[0].count++; world.cropDefinitions[0].price = 100;
    if (tax) { debt.unpaidTaxes = 10; debt.taxCountdown = 1; } else { debt.balanceDue = 10; debt.balanceCountdown = 1; }
    const payments = accounts.balancePayments, taxes = accounts.taxExpenses;
    const r = retryMonthlyDebts(world, accounts, debt, effects, 8, 1);
    assert.deepEqual(r.notices, [tax ? 165 : 168]); assert.equal(r.pendingDefault, null); assert.equal(r.forcedSales.length, 1);
    assert.equal(r.forcedSales[0].reason, tax ? 36 : 39); assert.equal(r.forcedSales[0].paymentCategory, tax ? 2500 : 1000);
    assert.equal(debt.unpaidTaxes, 0); assert.equal(debt.balanceDue, 0);
    assert.equal(accounts.balancePayments, (payments + (tax ? 0 : 10)) >>> 0); assert.equal(accounts.taxExpenses, (taxes + (tax ? 10 : 0)) >>> 0);
  }
});

test('an exhausted balance default preserves debt and stops before taxes while a restart/exit choice is pending', () => {
  const { world, accounts, debt, effects } = setup();
  Object.assign(debt, { balanceDue: 0xffffffff, balanceCountdown: 1, unpaidTaxes: 1, taxCountdown: 2 });
  const r = retryMonthlyDebts(world, accounts, debt, effects, 8, 6);
  assert.equal(r.forcedSales.length, 1); assert.equal(r.forcedSales[0].paid, false); assert.equal(r.pendingDefault, r.forcedSales[0]);
  assert.deepEqual(r.notices, []); assert.equal(debt.balanceDue, 0xffffffff); assert.equal(debt.balanceCountdown, 0);
  assert.equal(debt.unpaidTaxes, 1); assert.equal(debt.taxCountdown, 2);
  resolveDefaultDecision(r.pendingDefault!.decision!, 'exit'); assert.equal(debt.balanceDue, 0xffffffff);
});

test('zero debt follows the original failure/countdown path without invented successful payment', () => {
  const { world, accounts, debt, effects } = setup(); debt.taxCountdown = 2; debt.unpaidTaxes = 0;
  const cash = world.farm.cash, r = retryMonthlyDebts(world, accounts, debt, effects, 8, 9);
  assert.deepEqual(r.notices, [162]); assert.equal(debt.taxCountdown, 1); assert.equal(world.farm.cash, cash);
  const next = retryMonthlyDebts(world, accounts, debt, effects, 8, 10);
  assert.equal(next.pendingDefault?.amount, 0); assert.equal(next.pendingDefault?.paid, false); assert.equal(debt.unpaidTaxes, 0);
});

test('tax warnings use incremented months 6/9, strict unsigned affordability and only the inactive-tax branch', () => {
  for (let month = 1; month <= 12; month++) {
    const { world, accounts, debt, effects } = setup(); world.farm.cash = 0;
    const r = retryMonthlyDebts(world, accounts, debt, effects, 8, month);
    assert.deepEqual(r.notices, month === 6 || month === 9 ? [161] : []);
  }
  for (const month of [6, 9]) {
    const { world, accounts, debt, effects } = setup(); world.farm.cash = 0;
    const amount = assessAnnualTax(world, 8, 0).total; world.farm.cash = amount;
    assert.deepEqual(retryMonthlyDebts(world, accounts, debt, effects, 8, month).notices, []);
    world.farm.cash--; assert.deepEqual(retryMonthlyDebts(world, accounts, debt, effects, 8, month).notices, [161]);
    debt.unpaidTaxes = 1; debt.taxCountdown = 1; world.farm.cash = 1;
    assert.deepEqual(retryMonthlyDebts(world, accounts, debt, effects, 8, month).notices, [163]); // No second warning after tax success.
  }
});

test('invalid monthly inputs fail before any debt, ledger, world or countdown mutation', () => {
  for (const bad of ['month', 'debt', 'countdown', 'account', 'effects'] as const) {
    const d = setup(); d.debt.balanceDue = 1; d.debt.balanceCountdown = 1;
    if (bad === 'debt') d.debt.unpaidTaxes = -1;
    if (bad === 'countdown') d.debt.taxCountdown = 256;
    if (bad === 'account') d.accounts.taxExpenses = NaN;
    if (bad === 'effects') d.effects.x[0] = 96;
    const before = JSON.stringify(d);
    assert.throws(() => retryMonthlyDebts(d.world, d.accounts, d.debt, d.effects, 8, bad === 'month' ? 0 : 1));
    assert.equal(JSON.stringify(d), before);
  }
});
