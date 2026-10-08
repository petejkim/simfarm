import { decodeFinancialState, encodeFinancialState } from './finance-save';
import { Binary } from './binary';
import { readHomestead, type HomesteadState } from './homestead';
import { readAnnualStatistics, copyAnnualStatistics, type AnnualStatistics } from './annual-statistics';
import { GoodsDefinition } from './inventory';
import { readDefaultState, type DefaultState } from './default-state';
import { readAnnualLedger, type AnnualLedgerState } from './annual-ledger';
import { readMonthlyDebtState, type MonthlyDebtState } from './monthly-debt';
import { readLoan, type LoanState } from './loan';
import { readTownConstructionState } from './town';
import type { TownDevelopmentState } from '../simulation/town-development';
import { createClearingEffects, type ClearingEffects } from '../simulation/clearing-effects';
import type { DefaultDecision } from '../simulation/default';

/** Canonical financial state. Existing farm ledgers stay on Scenario.farm;
 * account views for tax/loan operations must reference these same owners. */
export interface FinancialState {
  accounts: DefaultState;
  annual: AnnualLedgerState;
  statistics: AnnualStatistics;
  homestead: HomesteadState;
  debt: MonthlyDebtState;
  loan: LoanState;
  loanRate: number;
  taxFailures: number;
  town: TownDevelopmentState & { expansionFunds: number };
  clearing: ClearingEffects;
  defaultDecision: DefaultDecision | null;
}

/** SSM financial transfers, NOT a complete load lifecycle or native restore.
 * With retained state, preserve untransferred runtime members (0x4543c..0x4644c).
 * Without it use cold EXE defaults. SF-014/SF-065 retain the original omissions. Native saves preserve them explicitly and never reinitialize.
 * Revenue: 17 one-byte reads after 0x2172a, then 0x46406 -> 6190:758a. */
export function readFinancialState(bytes: Uint8Array, retained?: FinancialState): FinancialState {
  const prior = retained ? decodeFinancialState(encodeFinancialState(retained)) : undefined;
  const b = new Binary(bytes), activeSite = { regionX: b.slice(0x2170f, 1)[0], regionY: b.slice(0x21710, 1)[0] };
  if (activeSite.regionX >= 12 || activeSite.regionY >= 12) throw new Error('Invalid active town site');
  return { accounts: readDefaultState(bytes, prior?.accounts.buildingBookValue ?? 0),
    statistics: { ...(prior?.statistics ?? readAnnualStatistics(bytes)), ds3e58: b.u32(0x21684), ds3e5c: b.u32(0x21688) },
    homestead: { ...readHomestead(bytes), rank: prior?.homestead.rank ?? 255 },
    annual: readAnnualLedger(bytes, prior?.annual ?? { priorTaxExpenses: 0, ds3e70: 0, ds3e8c: 0, ds3e90: 0, ds3e94: 0, ds3e9c: 0 }),
    debt: readMonthlyDebtState(bytes, prior?.debt.balanceDue ?? 0, prior?.debt.balanceCountdown ?? 0), loan: readLoan(bytes),
    loanRate: prior?.loanRate ?? 15, taxFailures: prior?.taxFailures ?? 0,
    town: { ...readTownConstructionState(bytes), activeSite, townRevenue: b.u32(0x2173c), expansionFunds: prior?.town.expansionFunds ?? 40000, developmentSpent: prior?.town.developmentSpent ?? 0 },
    clearing: prior?.clearing ?? createClearingEffects(), defaultDecision: prior?.defaultDecision ?? null };
}

export function copyFinancialState(f: FinancialState): FinancialState {
  return { ...f, accounts: { ...f.accounts, assets: { ...f.accounts.assets,
    animalDefinitions: f.accounts.assets.animalDefinitions.map(d => new GoodsDefinition(Uint8Array.from(d.bytes))) },
    otherDefinitions: f.accounts.otherDefinitions.map(d => new GoodsDefinition(Uint8Array.from(d.bytes))) },
    annual: { ...f.annual }, statistics: copyAnnualStatistics(f.statistics), homestead: { ...f.homestead }, debt: { ...f.debt }, loan: { ...f.loan },
    town: { ...f.town, activeSite: { ...f.town.activeSite }, recreationCoordinates: Uint8Array.from(f.town.recreationCoordinates) },
    clearing: { ...f.clearing, x: Uint8Array.from(f.clearing.x), y: Uint8Array.from(f.clearing.y) },
    defaultDecision: f.defaultDecision ? { ...f.defaultDecision } : null };
}
