import type { NewFarmRuntimeDefaults } from '../formats/new-farm-runtime';
import type { SetupRecords } from '../formats/new-farm-records';
import { decodeFinancialState } from '../formats/finance-save';
import { validateCalendar } from './calendar';
import { createClearingEffects } from './clearing-effects';
import { resetAnnualLedgers } from './annual-ledger';
import type { WeatherState } from './weather';
import { setEquipmentPacingByte } from '../formats/scenario-state';

/** Cold native state before property/town/calendar finalization. The unset town
 * coordinate is intentional; this intermediate state is not a playable farm. */
export function createSetupRuntime(defaults: NewFarmRuntimeDefaults, records: SetupRecords) {
  const { farm, raw } = structuredClone(defaults), source = defaults.finances;
  validateCalendar(farm.calendar);
  const valid = (value: number, max: number) => Number.isInteger(value) && value >= 0 && value <= max;
  for (const key of ['paceEquipment', 'autoRent', 'autoBuySeeds', 'autoClear'] as const) {
    if (typeof farm[key] !== 'boolean') throw new Error('Invalid starting farm option');
  }
  if (farm.equipmentPacingByte === null || !valid(farm.equipmentPacingByte, 255) || farm.paceEquipment !== (farm.equipmentPacingByte !== 0))
    throw new Error('Invalid starting equipment pacing byte');
  for (const key of ['timerTicks', 'animationTicks', 'dayDelayTicks', 'speed', 'precipitationDays', 'townRegionX', 'townRegionY'] as const) {
    if (!valid(farm[key], 65535)) throw new Error('Invalid starting farm word');
  }
  for (const key of ['cash', 'seedExpenses', 'rentalExpenses', 'cropIncome', 'contractGains', 'contractLosses',
    'salesAccumulator', 'workerExpenses', 'landExpenses', 'chemicalExpenses'] as const) {
    if (!valid(farm[key], 0xffffffff)) throw new Error('Invalid starting farm account');
  }
  if (raw.ds4468.length !== 19 || raw.ds4468.some(n => !Number.isInteger(n) || n < 0 || n > 65535) ||
    !valid(raw.ds3e4c, 0xffffffff) ||
    !valid(raw.s4d9fFedd, 255) ||
    !Number.isInteger(raw.ds3eb8) || raw.ds3eb8 < 0 || raw.ds3eb8 > 0xffffffff ||
    !Number.isInteger(raw.ds64c5) || raw.ds64c5 < 0 || raw.ds64c5 > 255) throw new Error('Invalid starting runtime words');
  // SF-060: use the native empty clearing queue rather than cold zero X bytes.
  const clearing = createClearingEffects();
  const finances = decodeFinancialState({ ...source, accounts: { ...source.accounts,
    assets: { ...source.accounts.assets, animalDefinitions: records.animalDefinitions.map(d => [...d.bytes]) },
    otherDefinitions: records.otherDefinitions.map(d => [...d.bytes]) },
    clearing: { ...clearing, x: [...clearing.x], y: [...clearing.y] }, defaultDecision: null });
  // These definitions have one owner, shared with the setup records just as in
  // live simulation. Validation above precedes assigning the shared references.
  finances.accounts.assets.animalDefinitions = records.animalDefinitions;
  finances.accounts.otherDefinitions = records.otherDefinitions;
  return { farm, finances, raw };
}
export type SetupRuntime = ReturnType<typeof createSetupRuntime>;

/** Account/statistic phases of restart0x402a8 and0x4060c. Record/map/disaster
 * reset and property/town/weather finalization are separate phases. */
export function resetSetupRuntime(state: SetupRuntime, weather: Pick<WeatherState, 'precipitationDays'>): void {
  const { farm, finances: f, raw } = state;
  resetAnnualLedgers(farm, f.accounts, f.annual, weather);
  f.statistics.fieldPresence.fill(0); f.statistics.distinctFieldStatuses = 0;
  f.statistics.ds3e58 = f.statistics.ds3e5c = 0;
  raw.ds4468.fill(0); raw.ds3e4c = raw.ds3eb8 = raw.ds64c5 = 0;
  f.town.expansionFunds = 40000; f.town.townRevenue = 4800;
  f.town.recreationCount = f.town.airportCount = 0;
  f.accounts.assets.equipmentBookValue = 0; //3e54 building ledger is omitted (SF-065).
  farm.autoRent = farm.autoBuySeeds = true; farm.autoClear = false;
  setEquipmentPacingByte(farm, 2); //0x4072b writes2 to DSa8a0; consumer tests nonzero.
  farm.calendar = { day: 1, season: 1, week: 1, year: 1992, month: 0 };
  farm.timerTicks = farm.animationTicks = farm.salesAccumulator = 0;
  f.homestead.rank = 255;
  f.loan.selectedAmount = f.loan.principal = f.loan.availableCredit = f.loan.scheduledPayment = 0;
  f.debt.balanceDue = f.debt.unpaidTaxes = f.debt.balanceCountdown = f.debt.taxCountdown = 0;
}
