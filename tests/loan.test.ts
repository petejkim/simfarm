import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readLoan } from '../src/formats/loan';
import { isLoanPaymentMonth, payScheduledLoan, settleLoanArrears } from '../src/simulation/loan';
import { readScenario } from '../src/formats/scenario';
import { readDefaultState } from '../src/formats/default-state';
import { retryMonthlyDebts } from '../src/simulation/monthly-finance';
import { createClearingEffects } from '../src/simulation/clearing-effects';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const setup = () => ({ farm: { cash: 100 }, loan: { principal: 200, scheduledPayment: 21, availableCredit: 10, selectedAmount: 123 },
  debt: { balanceDue: 13, balanceCountdown: 2, unpaidTaxes: 7, taxCountdown: 3 },
  accounts: { balancePayments: 0, townRevenue: 0, expansionFunds: 0 } });

test('scheduled loan source binds all segments, saved offsets, irregular due months and final credit ordering', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  for (const a of [0xc686, 0xc68c, 0xc68e, 0xc690, 0xc692]) assert.equal(e.readUInt16LE(0x846f0 + a), 0x6190);
  assert.equal(e.readUInt16LE(0x846f0 + 0xc688), 0x4d9f); assert.equal(e.readUInt16LE(0x846f0 + 0xc68a), 0x2d9f);
  exact(0xc563, '68e803'); exact(0xc580, '7632'); exact(0xc586, '26c606d6fe04'); exact(0xc5a6, '68a600');
  exact(0xc60d, 'd1ead1d8'); exact(0xc61f, 'd1ebd1d9d1ebd1d9');
  exact(0xc657, '26a3b4b326a3b2b3'); exact(0xc663, '26a1b2b3'); exact(0xc670, '26010694b3');
  for (const [o, h] of [[0xd009, '26833e561202'], [0xd011, '26833e561206'], [0xd019, '26833e561209'], [0xd021, '26833e561200'],
    [0xd029, '0ee81df5'], [0xcc0d, 'e92c04'], [0x45ec0, '68906168b2b3'], [0x46010, '6890616894b3'],
    [0x46028, '6890616898b3'], [0x46040, '68906168aeb3']] as const) exact(o, h);
  assert.deepEqual(Array.from({ length: 12 }, (_, i) => isLoanPaymentMonth(i)), [true, false, true, false, false, false, true, false, false, true, false, false]);
  for (const m of [-1, 12, 0.5, NaN]) assert.throws(() => isLoanPaymentMonth(m));
});

test('loan decoder reads all eight farms, unsigned sentinel values and exact truncation boundaries', () => {
  for (let id = 0; id < 8; id++) assert.deepEqual(readLoan(source(`SCEN${id}.SSM`)), { principal: 0, scheduledPayment: 0, availableCredit: 0, selectedAmount: 0 });
  const b = source('SCEN0.SSM');
  for (const [o, n] of [[0x216dc, 0x12345678], [0x216fb, 0xffffffff], [0x216ff, 0x87654321], [0x21703, 0x80000000]]) b.writeUInt32LE(n, o);
  assert.deepEqual(readLoan(b), { principal: 0x80000000, scheduledPayment: 0x12345678, availableCredit: 0xffffffff, selectedAmount: 0x87654321 });
  for (const end of [0x216df, 0x216fe, 0x21702, 0x21706]) assert.throws(() => readLoan(b.subarray(0, end)));
});

test('scheduled payment posts full debit, unsigned town shares and credit with independent wrapping', () => {
  for (const amount of [0, 1, 3, 4, 21, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff]) {
    const d = setup(); d.loan.scheduledPayment = amount; d.loan.principal = 0xffffffff; d.farm.cash = 0xffffffff;
    d.loan.availableCredit = 0xfffffffe; d.accounts.balancePayments = d.accounts.townRevenue = d.accounts.expansionFunds = 0xffffffff;
    const debts = { ...d.debt };
    const r = payScheduledLoan(d.farm, d.loan, d.debt, d.accounts);
    assert.deepEqual(r, { paid: true, amount, notice: null }); assert.equal(d.farm.cash, 0xffffffff - amount);
    assert.equal(d.loan.principal, 0xffffffff - amount); assert.equal(d.accounts.balancePayments, (amount - 1) >>> 0);
    assert.equal(d.accounts.expansionFunds, (Math.floor(amount / 2) - 1) >>> 0); assert.equal(d.accounts.townRevenue, (Math.floor(amount / 4) - 1) >>> 0);
    assert.equal(d.loan.availableCredit, (0xfffffffe + (amount === 0xffffffff ? 0 : amount)) >>> 0);
    assert.deepEqual(d.debt, debts); assert.equal(d.loan.selectedAmount, 123);
  }
});

test('last payment keeps full source charge and town shares but omits restoring credit after clearing payment', () => {
  for (const principal of [0, 1, 20, 21]) {
    const d = setup(); d.loan.principal = principal;
    payScheduledLoan(d.farm, d.loan, d.debt, d.accounts);
    assert.equal(d.farm.cash, 79); assert.equal(d.loan.principal, 0); assert.equal(d.loan.scheduledPayment, 0);
    assert.equal(d.loan.availableCredit, 10); assert.equal(d.accounts.townRevenue, 5); assert.equal(d.accounts.expansionFunds, 10);
  }
});

test('failure retains source arrears replacement; native monthly settlement applies principal/town/credit once', () => {
  const d = setup(); d.farm.cash = 20;
  const before = JSON.stringify([d.farm, d.loan, d.accounts]);
  assert.deepEqual(payScheduledLoan(d.farm, d.loan, d.debt, d.accounts), { paid: false, amount: 21, notice: 166 });
  assert.equal(JSON.stringify([d.farm, d.loan, d.accounts]), before);
  assert.deepEqual(d.debt, { balanceDue: 21, balanceCountdown: 4, unpaidTaxes: 7, taxCountdown: 3 });
  const b = source('SCEN0.SSM'), world = readScenario(b), a = readDefaultState(b, 0); world.farm.cash = 21;
  d.debt.unpaidTaxes = d.debt.taxCountdown = 0;
  const principal=d.loan.principal,credit=d.loan.availableCredit;
  const r = retryMonthlyDebts(world, a, d.debt, createClearingEffects(), 8, 3);
  assert.deepEqual(r.notices, [170]); assert.equal(world.farm.cash, 0); assert.equal(d.debt.balanceDue, 0);
  assert.equal(d.debt.balanceCountdown, 0); assert.equal(r.loanPayment,21);settleLoanArrears(d.loan,d.accounts,r.loanPayment!);
  assert.equal(d.loan.principal,principal-21);assert.equal(d.loan.availableCredit,credit+21);
  assert.equal(d.accounts.expansionFunds,10);assert.equal(d.accounts.townRevenue,5);
  assert.equal(a.balancePayments,21);
});

test('invalid scheduled payment input rejects before any state change', () => {
  for (const bad of ['loan', 'debt', 'cash', 'town'] as const) {
    const d = setup();
    if (bad === 'loan') d.loan.principal = -1;
    if (bad === 'debt') d.debt.balanceCountdown = 256;
    if (bad === 'cash') d.farm.cash = NaN;
    if (bad === 'town') d.accounts.expansionFunds = 0x100000000;
    const before = JSON.stringify(d); assert.throws(() => payScheduledLoan(d.farm, d.loan, d.debt, d.accounts));
    assert.equal(JSON.stringify(d), before);
  }
});
