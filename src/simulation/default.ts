import type { DefaultState } from '../formats/default-state';
import type { Scenario } from '../formats/scenario';
import { sellAnimal, sellEquipment } from './asset-sale';
import { validateClearingEffects, type ClearingEffects } from './clearing-effects';
import { findOverlappingField, removeField } from './field-removal';
import { sellStoredHarvest } from './harvest-sale';
import { sellLand } from './land-sale';

export type DefaultReason = 36 | 39;
export interface DefaultDecision { status: 'pending' | 'restart' | 'exit'; originalExitCode: 0 | 1 | 2 }
export type ForcedSaleAttempt = { kind: 'crop' | 'animal' | 'equipment'; slot: number; sold: boolean; value: number }
  | { kind: 'land'; regionX: number; regionY: number; sold: true; value: number; demolishedBuildings: number[] };
export interface ForcedSaleResult {
  paid: boolean;
  amount: number;
  reason: DefaultReason;
  paymentCategory: 0 | 1000 | 2500 | null;
  attempts: ForcedSaleAttempt[];
  removedFields: number[];
  decision: DefaultDecision | null;
}

export function validateDefaultAccounts(world: Scenario, state: DefaultState): void {
  for (const n of [world.farm.cash, world.farm.salesAccumulator, state.landIncome, state.buildingBookValue,
    state.assets.equipmentBookValue, state.assets.equipmentIncome, state.assets.livestockIncome,
    state.equipmentExpenses, state.balancePayments, state.taxExpenses]) {
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error('Invalid default account');
  }
  if (![state.homeRegionX, state.homeRegionY].every(n => Number.isInteger(n) && n >= 0 && n < 12)) throw new Error('Invalid protected home region');
}

/** 0x1d766..0x1db7e: invoked AFTER the caller's failed normal debit.
 * Slot-bounded scans correct SF-059; asset order and debit categories preserve
 * the original, including SF-046's ledger mismatch and failed-sale retries. */
export function forceAssetSales(world: Scenario, state: DefaultState, amount: number, reason: DefaultReason,
  effects: ClearingEffects, soilMoisture: number): ForcedSaleResult {
  if (reason !== 36 && reason !== 39) throw new Error('Invalid default reason');
  if (!Number.isInteger(amount) || amount < 0 || amount > 0xffffffff) throw new Error('Invalid default amount');
  validateDefaultAccounts(world, state);
  validateClearingEffects(effects, soilMoisture);
  const result: ForcedSaleResult = { paid: false, amount, reason, paymentCategory: null, attempts: [], removedFields: [], decision: null };
  const pay = (category: 0 | 1000 | 2500): boolean => {
    // Debit returns the amount; zero therefore remains failure (SF-067).
    if (!amount || world.farm.cash < amount) return false;
    world.farm.cash -= amount;
    const key = category === 0 ? 'equipmentExpenses' : category === 1000 ? 'balancePayments' : 'taxExpenses';
    state[key] = (state[key] + amount) >>> 0;
    result.paid = true; result.paymentCategory = category;
    return true;
  };
  for (const i of world.inventory) {
    if (!i.slot || !i.active || i.type < 168 || i.type > 191) continue;
    const sale = sellStoredHarvest(world, i.slot, soilMoisture);
    result.attempts.push({ kind: 'crop', slot: i.slot, sold: sale.ok, value: sale.ok ? sale.value : 0 });
    if (pay(reason === 36 ? 1000 : 2500)) return result;
  }
  for (const a of world.animals) {
    if (!a.slot || !a.active) continue;
    const sale = sellAnimal(world, state.assets, a.slot);
    result.attempts.push({ kind: 'animal', slot: a.slot, sold: sale.ok, value: sale.ok ? sale.value : 0 });
    if (pay(0)) return result;
  }
  for (const e of world.equipment) {
    if (!e.slot || !e.active || (e.flags & 0x40)) continue;
    const sale = sellEquipment(world, state.assets, e.slot, soilMoisture);
    result.attempts.push({ kind: 'equipment', slot: e.slot, sold: sale.ok, value: sale.ok ? sale.value : 0 });
    if (pay(0)) return result;
  }
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) {
    if (world.regionalConditions[(x * 12 + y) * 7 + 1] !== 1 || (x === state.homeRegionX && y === state.homeRegionY)) continue;
    let slot: number | null;
    while ((slot = findOverlappingField(world, x * 8, y * 8, 8, 8)) !== null) {
      removeField(world, slot, effects, soilMoisture); result.removedFields.push(slot);
    }
    const sale = sellLand(world, state, x, y, effects, soilMoisture, false);
    if (!sale.ok) throw new Error('Owned default land became unavailable');
    result.attempts.push({ kind: 'land', regionX: x, regionY: y, sold: true, value: sale.price, demolishedBuildings: sale.demolishedBuildings });
    if (pay(0)) return result;
  }
  // The original terminal text claims the homestead was sold, but the scan
  // explicitly preserves that plot. Keep the world and debt; request a choice.
  result.decision = { status: 'pending', originalExitCode: 0 };
  return result;
}

/** 0x1db61..0x1db79 and main loop 0x2694..0x26bf: original Yes (index 0)
 * sets state 2 and returns to new-game setup; No sets state 1 and exits.
 * Native simulation exposes the action; the browser must not close itself. */
export function resolveDefaultDecision(decision: DefaultDecision, choice: 'restart' | 'exit'): void {
  if (decision.status !== 'pending' || decision.originalExitCode !== 0 || (choice !== 'restart' && choice !== 'exit')) throw new Error('Invalid default decision');
  decision.status = choice;
  decision.originalExitCode = choice === 'restart' ? 2 : 1;
}
