import type { FinancialState } from '../formats/finance';
import type { LoanPaymentAccounts } from './loan';
import type { TaxAccount } from './tax';

/** Operation views write through to the canonical owners. Never persist these
 * adapters or copy balances back after a multi-stage financial operation. */
export function loanPaymentAccounts(f: FinancialState): LoanPaymentAccounts {
  return {
    get balancePayments() { return f.accounts.balancePayments; }, set balancePayments(n) { f.accounts.balancePayments = n; },
    get townRevenue() { return f.town.townRevenue; }, set townRevenue(n) { f.town.townRevenue = n; },
    get expansionFunds() { return f.town.expansionFunds; }, set expansionFunds(n) { f.town.expansionFunds = n; },
  };
}
export function taxAccounts(f: FinancialState): TaxAccount {
  return {
    get unpaidTaxes() { return f.debt.unpaidTaxes; }, set unpaidTaxes(n) { f.debt.unpaidTaxes = n; },
    get taxCountdown() { return f.debt.taxCountdown; }, set taxCountdown(n) { f.debt.taxCountdown = n; },
    get taxExpenses() { return f.accounts.taxExpenses; }, set taxExpenses(n) { f.accounts.taxExpenses = n; },
    get taxFailures() { return f.taxFailures; }, set taxFailures(n) { f.taxFailures = n; },
    get townRevenue() { return f.town.townRevenue; }, set townRevenue(n) { f.town.townRevenue = n; },
    get expansionFunds() { return f.town.expansionFunds; }, set expansionFunds(n) { f.town.expansionFunds = n; },
  };
}
