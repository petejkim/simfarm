import { validateLoan, type LoanState } from '../formats/loan';
import { validateMonthlyDebt, type MonthlyDebtState } from '../formats/monthly-debt';
import type { SavedFarmState } from '../formats/scenario-state';
import type { Scenario } from '../formats/scenario';
import { ownedLandValue } from './tax';

export interface LoanPaymentAccounts { balancePayments: number; townRevenue: number; expansionFunds: number }
export interface LoanPaymentResult { paid: boolean; amount: number; notice: 166 | null }
export type BorrowResult = { ok: true; amount: number; installment: number }
  | { ok: false; reason: 'invalid-amount' | 'no-credit' | 'cash-limit' };
export type RepayResult = { ok: true; amount: number } | { ok: false; reason: 'no-loan' | 'insufficient-cash' };

/** Original dialog refresh 0x47028, selection bounds 0x46ef4..0x46f43,
 * and confirmation 0x46f92..0x46fca / 0x47533..0x4756b.
 * Native command rechecks collateral at submission to avoid a stale UI quote. */
export function borrowLoan(world: Scenario, loan: LoanState, buildingBookValue: number, rate: number,
  requested: number, soilMoisture: number): BorrowResult {
  validateLoan(loan);
  if (!Number.isInteger(world.farm.cash) || world.farm.cash < 0 || world.farm.cash > 0xffffffff) throw new Error('Invalid cash');
  if (!Number.isInteger(requested) || requested < 1 || requested > 0xffffffff) return { ok: false, reason: 'invalid-amount' };
  const credit = loanCreditLimit(world, buildingBookValue, loan.principal, soilMoisture);
  if (!credit) return { ok: false, reason: 'no-credit' };
  const capacity = Math.max(0, 9999999 - world.farm.cash);
  if (!capacity) return { ok: false, reason: 'cash-limit' };
  const amount = Math.min(requested, credit, capacity), installment = loanInstallment(amount, rate);
  world.farm.cash += amount;
  loan.principal = (loan.principal + amount) >>> 0;
  loan.availableCredit = credit - amount;
  loan.scheduledPayment = (loan.scheduledPayment + installment) >>> 0;
  loan.selectedAmount = 0; // Dialog clears the submitted selection at 0x4701e / 0x475be.
  return { ok: true, amount, installment };
}

/** Full payoff 0x47623..0x4768a. Source does not clear separate overdue debt
 * or replenish cached available credit. Both are documented, not inferred. */
export function repayLoanInFull(farm: Pick<SavedFarmState, 'cash'>, loan: LoanState, accounts: LoanPaymentAccounts): RepayResult {
  validateLoan(loan); validatePaymentAccounts(farm, accounts);
  const amount = loan.principal;
  if (!amount) return { ok: false, reason: 'no-loan' };
  if (farm.cash < amount) return { ok: false, reason: 'insufficient-cash' };
  farm.cash -= amount;
  accounts.balancePayments = (accounts.balancePayments + amount) >>> 0;
  accounts.expansionFunds = (accounts.expansionFunds + (amount >>> 1)) >>> 0;
  accounts.townRevenue = (accounts.townRevenue + (amount >>> 2)) >>> 0;
  loan.principal = loan.scheduledPayment = 0;
  return { ok: true, amount };
}

function validatePaymentAccounts(farm: Pick<SavedFarmState, 'cash'>, accounts: LoanPaymentAccounts): void {
  for (const n of [farm.cash, accounts.balancePayments, accounts.townRevenue, accounts.expansionFunds]) {
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error('Invalid loan payment account');
  }
}

/** 0x476e2..0x47754: low-dword multiplication, signed division, then
 * signed division by the sign-extended low word of term*4. Borrow callers
 * pass term 5. Raw result bits preserve overflow, not a floating loan formula. */
export function loanInstallment(amount: number, rate: number, term = 5): number {
  if (!Number.isInteger(amount) || amount < 0 || amount > 0xffffffff ||
    ![rate, term].every(n => Number.isInteger(n) && n >= 0 && n <= 65535)) throw new Error('Invalid loan terms');
  if (!amount) return 0;
  const divisor = (term << 2) << 16 >> 16;
  // Native boundary guard; the source helper would divide by zero.
  if (!divisor) throw new Error('Loan term produces zero divisor');
  const interest = Math.trunc(Math.imul(amount, rate) / 100);
  const total = (amount + interest) | 0;
  const payment = Math.trunc(total / divisor) >>> 0;
  return (amount | 0) > 0 && payment === 0 ? 1 : payment;
}

/** 0x3da08..0x3da72, selected by dialog 0x47028 through thunk 12c6.
 * The division helper here is UNSIGNED (0x5f50 -> 0x5f8e).
 * Other asset ledgers and cash do not enter this borrowing limit. */
export function loanCreditLimit(world: Scenario, buildingBookValue: number, principal: number, soilMoisture: number): number {
  for (const n of [buildingBookValue, principal]) {
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error('Invalid loan valuation');
  }
  if (!Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid soil moisture');
  const collateral = (ownedLandValue(world, soilMoisture) + buildingBookValue) >>> 0;
  return Math.max(0, Math.floor(collateral / 3) - principal);
}

/** 0xd005..0xd02d, reached only on a month boundary, after monthly retries
 * and annual collection/reset/projection. This is the normalized month 0..11. */
export function isLoanPaymentMonth(month: number): boolean {
  if (!Number.isInteger(month) || month < 0 || month > 11) throw new Error('Invalid loan payment month');
  return month === 0 || month === 2 || month === 6 || month === 9;
}

/** Scheduled payment 0xc54a..0xc69f. Keep source differences from arrears:
 * zero succeeds here; failure overwrites the overdue amount/countdown;
 * final payment clears scheduledPayment before restoring available credit. */
export function payScheduledLoan(farm: Pick<SavedFarmState, 'cash'>, loan: LoanState, debt: MonthlyDebtState,
  accounts: LoanPaymentAccounts): LoanPaymentResult {
  validateLoan(loan); validateMonthlyDebt(debt);
  validatePaymentAccounts(farm, accounts);
  const amount = loan.scheduledPayment;
  if (farm.cash < amount) {
    debt.balanceCountdown = 4;
    debt.balanceDue = amount;
    return { paid: false, amount, notice: 166 };
  }
  farm.cash -= amount;
  accounts.balancePayments = (accounts.balancePayments + amount) >>> 0;
  loan.principal = Math.max(0, loan.principal - amount);
  accounts.expansionFunds = (accounts.expansionFunds + (amount >>> 1)) >>> 0;
  accounts.townRevenue = (accounts.townRevenue + (amount >>> 2)) >>> 0;
  if (!loan.principal) loan.scheduledPayment = 0;
  loan.availableCredit = (loan.availableCredit + loan.scheduledPayment) >>> 0;
  return { paid: true, amount, notice: null };
}


/** SF-071 native correction: the monthly/default path already debited cash
 * and posted its expense. Apply the same principal/town allocation as an
 * on-time installment, once, without charging or posting that expense again. */
export function settleLoanArrears(loan:LoanState,accounts:LoanPaymentAccounts,amount:number):void {
  validateLoan(loan);
  if(!Number.isInteger(amount)||amount<=0||amount>0xffffffff)throw new Error('Invalid arrears payment');
  for(const n of [accounts.townRevenue,accounts.expansionFunds])
    if(!Number.isInteger(n)||n<0||n>0xffffffff)throw new Error('Invalid loan allocation');
  loan.principal=Math.max(0,loan.principal-amount);
  if(!loan.principal)loan.scheduledPayment=0;
  loan.availableCredit=(loan.availableCredit+amount)>>>0;
  accounts.expansionFunds=(accounts.expansionFunds+(amount>>>1))>>>0;
  accounts.townRevenue=(accounts.townRevenue+(amount>>>2))>>>0;
}
