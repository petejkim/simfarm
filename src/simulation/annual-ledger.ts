import { validateAnnualLedger, type AnnualLedgerState } from '../formats/annual-ledger';
import type { DefaultState } from '../formats/default-state';
import type { SavedFarmState } from '../formats/scenario-state';
import type { WeatherState } from './weather';

function validate(farm: SavedFarmState, accounts: DefaultState, ledger: AnnualLedgerState): void {
  validateAnnualLedger(ledger);
  for (const n of [farm.cropIncome, farm.contractGains, farm.seedExpenses, farm.rentalExpenses, farm.landExpenses,
    farm.contractLosses, farm.chemicalExpenses, farm.workerExpenses, accounts.assets.equipmentIncome,
    accounts.assets.livestockIncome, accounts.landIncome, accounts.equipmentExpenses, accounts.balancePayments, accounts.taxExpenses]) {
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error('Invalid annual account');
  }
}

/** Report 0x1d460..0x1d51e. SF-041: include worker and chemical charges;
 * the returned/stored net is a raw dword, signed only at presentation time. */
export function updateAnnualReport(farm: SavedFarmState, accounts: DefaultState, ledger: AnnualLedgerState): void {
  validate(farm, accounts, ledger);
  const income = [farm.contractGains, accounts.assets.equipmentIncome, accounts.landIncome,
    farm.cropIncome, accounts.assets.livestockIncome, ledger.ds3e70];
  const expenses = [ledger.otherExpenses, farm.rentalExpenses, ledger.ds3e9c, ledger.livestockExpenses,
    ledger.ds3e94, ledger.ds3e90, ledger.ds3e8c, accounts.taxExpenses, ledger.priorTaxExpenses,
    farm.contractLosses, farm.landExpenses, accounts.equipmentExpenses, farm.seedExpenses,
    farm.workerExpenses, farm.chemicalExpenses];
  ledger.reportIncome = income.reduce((sum, n) => (sum + n) >>> 0, 0);
  ledger.reportExpenses = expenses.reduce((sum, n) => (sum + n) >>> 0, 0);
  ledger.reportNet = (ledger.reportIncome - ledger.reportExpenses) >>> 0;
}

/** Reset 0x1d396..0x1d456, after annual collection. No report recomputation:
 * the source only requests a window refresh after these mutations.
 * Worker expenses survive (SF-042); sales were cleared by collection. */
export function resetAnnualLedgers(farm: SavedFarmState, accounts: DefaultState, ledger: AnnualLedgerState,
  weather: Pick<WeatherState, 'precipitationDays'>): void {
  validate(farm, accounts, ledger);
  for (const n of [farm.precipitationDays, weather.precipitationDays]) {
    if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error('Invalid annual precipitation count');
  }
  farm.cropIncome = farm.contractGains = farm.seedExpenses = farm.rentalExpenses = 0;
  farm.landExpenses = farm.contractLosses = farm.chemicalExpenses = 0;
  accounts.assets.equipmentIncome = accounts.assets.livestockIncome = accounts.landIncome = 0;
  accounts.equipmentExpenses = accounts.balancePayments = 0;
  ledger.ds3e70 = ledger.ds3e8c = ledger.ds3e90 = ledger.ds3e94 = ledger.ds3e9c = 0;
  ledger.livestockExpenses = ledger.otherExpenses = 0;
  farm.precipitationDays = weather.precipitationDays = 0;
  ledger.priorTaxExpenses = accounts.taxExpenses;
  accounts.taxExpenses = 0;
}
