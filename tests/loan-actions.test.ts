import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { borrowLoan, loanCreditLimit, loanInstallment, repayLoanInFull } from '../src/simulation/loan';
import { loanPaymentAccounts, taxAccounts } from '../src/simulation/finance-accounts';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const setup = (id = 0) => { const b = source(`SCEN${id}.SSM`); return { world: readScenario(b), f: readFinancialState(b) }; };

test('loan actions pin original confirmation, payoff, cash selection bounds and rate generator', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x46fa7, '0106aeb31116b0b3290694b3191696b3'); exact(0x46fc6, '0106b2b31116b4b3');
  exact(0x46f2f, '7705'); exact(0x46f36, 'b87f96ba98002bc11bd3');
  exact(0x4762b, '68e8039a2e00661a'); exact(0x4764d, 'd1ead1d8'); exact(0x47666, 'd1ead1d8d1ead1d8');
  exact(0x4767c, '2bc0a3b0b3a3aeb3a3b4b3a3b2b3');
  exact(0xcfa6, '9ad000fd05250700'); exact(0x82a0, 'a1961bd1e87303350035a3961b');
});

test('all eight farms borrow against fresh collateral, retain ledgers and combine rounded installments per loan', () => {
  for (let id = 0; id < 8; id++) {
    const { world, f } = setup(id), cash = world.farm.cash, before = JSON.stringify([f.accounts, f.annual, f.debt, f.town]);
    const credit = loanCreditLimit(world, f.accounts.buildingBookValue, 0, 8);
    f.loan.availableCredit = 0xffffffff; f.loan.selectedAmount = 777;
    const first = borrowLoan(world, f.loan, 0, 15, 135, 8);
    assert.deepEqual(first, { ok: true, amount: 135, installment: 7 });
    const second = borrowLoan(world, f.loan, 0, 15, 135, 8);
    assert.deepEqual(second, first); assert.equal(world.farm.cash, cash + 270);
    assert.equal(f.loan.principal, 270); assert.equal(f.loan.availableCredit, credit - 270); assert.equal(f.loan.selectedAmount, 0);
    assert.equal(f.loan.scheduledPayment, 14); assert.notEqual(14, loanInstallment(270, 15));
    assert.equal(JSON.stringify([f.accounts, f.annual, f.debt, f.town]), before);
  }
});

test('borrowing clamps to actual land credit and cash headroom and rejects invalid or unavailable requests atomically', () => {
  for (const boundary of ['credit', 'cash'] as const) {
    const { world, f } = setup(); if (boundary === 'cash') world.farm.cash = 9999998;
    const amount = boundary === 'cash' ? 1 : loanCreditLimit(world, 0, 0, 8);
    const r = borrowLoan(world, f.loan, 0, 15, 0xffffffff, 8);
    assert.deepEqual(r, { ok: true, amount, installment: loanInstallment(amount, 15) });
  }
  for (const kind of ['request', 'credit', 'cash', 'rate'] as const) {
    const { world, f } = setup();
    if (kind === 'credit') f.loan.principal = 0xffffffff;
    if (kind === 'cash') world.farm.cash = 0xffffffff;
    const before = JSON.stringify([world, f]);
    if (kind === 'rate') assert.throws(() => borrowLoan(world, f.loan, 0, 65536, 1, 8));
    else assert.equal(borrowLoan(world, f.loan, 0, 15, kind === 'request' ? NaN : 1, 8).ok, false);
    assert.equal(JSON.stringify([world, f]), before);
  }
});

test('full repayment uses canonical expense/town owners, wraps shares and clears existing overdue loan debt while preserving cached credit and taxes', () => {
  const { world, f } = setup(); world.farm.cash = 101; Object.assign(f.loan, { principal: 101, scheduledPayment: 8, availableCredit: 777 });
  f.debt.balanceDue = 9; f.debt.balanceCountdown = 2;f.debt.unpaidTaxes=71;f.debt.taxCountdown=3;
  f.accounts.balancePayments = 0xffffffff; f.town.expansionFunds = f.town.townRevenue = 0xffffffff;
  assert.deepEqual(repayLoanInFull(world.farm, f.loan, f.debt, loanPaymentAccounts(f)), { ok: true, amount: 101 });
  assert.equal(world.farm.cash, 0); assert.equal(f.loan.principal, 0); assert.equal(f.loan.scheduledPayment, 0);
  assert.equal(f.loan.availableCredit, 777); assert.equal(f.accounts.balancePayments, 100);
  assert.equal(f.town.expansionFunds, 49); assert.equal(f.town.townRevenue, 24);
  assert.equal(f.debt.balanceDue, 0); assert.equal(f.debt.balanceCountdown, 0);
  assert.equal(f.debt.unpaidTaxes,71);assert.equal(f.debt.taxCountdown,3);
  const before = JSON.stringify([world, f]);
  assert.deepEqual(repayLoanInFull(world.farm, f.loan, f.debt, loanPaymentAccounts(f)), { ok: false, reason: 'no-loan' });
  assert.equal(JSON.stringify([world, f]), before);
  f.loan.principal = 1;
  assert.deepEqual(repayLoanInFull(world.farm, f.loan, f.debt, loanPaymentAccounts(f)), { ok: false, reason: 'insufficient-cash' });
  assert.equal(f.loan.principal, 1);
});

test('finance account views share all owners without cached copies', () => {
  const { f } = setup(), loan = loanPaymentAccounts(f), tax = taxAccounts(f);
  tax.unpaidTaxes = 100; tax.taxCountdown = 3; tax.taxExpenses = 90; tax.taxFailures = 2;
  loan.balancePayments = 8; loan.townRevenue = 12; tax.expansionFunds = 14;
  assert.deepEqual([f.debt.unpaidTaxes, f.debt.taxCountdown, f.accounts.taxExpenses, f.taxFailures], [100, 3, 90, 2]);
  assert.equal(f.accounts.balancePayments, 8); assert.equal(tax.townRevenue, 12); assert.equal(loan.expansionFunds, 14);
  f.town.townRevenue = 25; assert.equal(loan.townRevenue, 25); assert.equal(tax.townRevenue, 25);
});


test('explicit payoff repairs zero-principal legacy arrears, and unaffordable payoff preserves every debt',()=>{
  const {world,f}=setup();world.farm.cash=0;
  Object.assign(f.loan,{principal:0,scheduledPayment:0});Object.assign(f.debt,{balanceDue:9,balanceCountdown:2,unpaidTaxes:71,taxCountdown:3});
  const accounts=JSON.stringify([f.accounts,f.town]);
  assert.deepEqual(repayLoanInFull(world.farm,f.loan,f.debt,loanPaymentAccounts(f)),{ok:true,amount:0});
  assert.equal(world.farm.cash,0);assert.equal(f.debt.balanceDue,0);assert.equal(f.debt.balanceCountdown,0);
  assert.equal(f.debt.unpaidTaxes,71);assert.equal(f.debt.taxCountdown,3);assert.equal(JSON.stringify([f.accounts,f.town]),accounts);
  Object.assign(f.loan,{principal:101,scheduledPayment:8});Object.assign(f.debt,{balanceDue:9,balanceCountdown:2});
  const before=JSON.stringify([world,f]);assert.deepEqual(repayLoanInFull(world.farm,f.loan,f.debt,loanPaymentAccounts(f)),{ok:false,reason:'insufficient-cash'});
  assert.equal(JSON.stringify([world,f]),before);
});
