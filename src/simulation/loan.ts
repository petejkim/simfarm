import { validateLoan, type LoanState } from '../formats/loan';
import { validateMonthlyDebt, type MonthlyDebtState } from '../formats/monthly-debt';
import type { SavedFarmState } from '../formats/scenario-state';

export interface LoanPaymentAccounts { balancePayments: number; townRevenue: number; expansionFunds: number }
export interface LoanPaymentResult { paid: boolean; amount: number; notice: 166 | null }

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
