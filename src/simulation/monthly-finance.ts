import type { DefaultState } from '../formats/default-state';
import { validateMonthlyDebt, type MonthlyDebtState } from '../formats/monthly-debt';
import type { Scenario } from '../formats/scenario';
import { validateClearingEffects, type ClearingEffects } from './clearing-effects';
import { forceAssetSales, validateDefaultAccounts, type ForcedSaleResult } from './default';
import { assessAnnualTax } from './tax';
import type {FinanceNoticeId} from './events';

export interface MonthlyFinanceResult {
  /** Successful loan arrears payment, including liquidation; caller settles loan ownership (SF-071). */
  loanPayment?: number;
  /** Original notice IDs; rendering/throttling remains the caller's responsibility. */
  notices: (161 | 162 | 163 | 165 | 168 | 169 | 170)[];
  forcedSales: ForcedSaleResult[];
  /** Stop calendar work and retain this decision until the player chooses. */
  pendingDefault: ForcedSaleResult | null;
}

/** 0xcc40..0xcdde. Month is the incremented value BEFORE year normalization
 * (1..12). Balance retries precede tax retries; this does not assess annual tax,
 * reset ledgers or allocate town funds. Those occur later in the source caller. */
export function retryMonthlyDebts(world: Scenario, accounts: DefaultState, debt: MonthlyDebtState,
  effects: ClearingEffects, soilMoisture: number, month: number, onNotice?: (id:FinanceNoticeId)=>void): MonthlyFinanceResult {
  validateDefaultAccounts(world, accounts); validateMonthlyDebt(debt); validateClearingEffects(effects, soilMoisture);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Invalid incremented month');
  const result: MonthlyFinanceResult = { notices: [], forcedSales: [], pendingDefault: null };
  const notice=(id:MonthlyFinanceResult['notices'][number])=>{result.notices.push(id);onNotice?.(id);};
  const taxStageRan = debt.taxCountdown !== 0;
  for (const tax of [false, true]) {
    const due = tax ? 'unpaidTaxes' : 'balanceDue', countdown = tax ? 'taxCountdown' : 'balanceCountdown';
    if (!debt[countdown]) continue;
    const amount = debt[due];
    if (amount && world.farm.cash >= amount) {
      world.farm.cash -= amount;
      const expense = tax ? 'taxExpenses' : 'balancePayments';
      accounts[expense] = (accounts[expense] + amount) >>> 0;
      if(!tax)result.loanPayment=amount;
      debt[due] = 0; debt[countdown] = 0;
      notice(tax ? 163 : 170);
    } else if (--debt[countdown]) {
      notice(tax ? 162 : 169);
    } else {
      onNotice?.(tax ? 36 : 39); // 1d77a..1d784, before the first asset sale.
      const sale = forceAssetSales(world, accounts, amount, tax ? 36 : 39, effects, soilMoisture);
      result.forcedSales.push(sale);
      if (!sale.paid) {
        // SF-069: an exit/restart button is not proof of debt payment. Do not
        // continue another financial phase while that modal decision is pending.
        result.pendingDefault = sale;
        return result;
      }
      if(!tax)result.loanPayment=amount;
      debt[due] = 0; debt[countdown] = 0;
      notice(tax ? 165 : 168);
    }
  }
  // Source successful tax retry and countdown-warning paths jump to 0xcdd6,
  // bypassing the seasonal warning. The inactive-tax branch alone reaches it.
  // Use the original countdown, not the now-cleared byte after successful payment.
  if (!taxStageRan && (month === 6 || month === 9) && !debt.taxCountdown &&
    assessAnnualTax(world, soilMoisture, debt.unpaidTaxes).total > world.farm.cash) notice(161);
  return result;
}
