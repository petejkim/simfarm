import { validateLoan, type LoanState } from '../formats/loan';
import { validateMonthlyDebt, type MonthlyDebtState } from '../formats/monthly-debt';
import type { SavedFarmState } from '../formats/scenario-state';
import type { Scenario } from '../formats/scenario';
import { ownedLandValue } from './tax';

export interface LoanPaymentAccounts { balancePayments: number; townRevenue: number; expansionFunds: number }
export interface LoanPaymentResult { paid: boolean; amount: number; notice: 166 | null }

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
  for (const n of [farm.cash, accounts.balancePayments, accounts.townRevenue, accounts.expansionFunds]) {
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error('Invalid loan payment account');
  }
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
