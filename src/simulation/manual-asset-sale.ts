import type { Scenario } from '../formats/scenario';
import type { FinancialState } from '../formats/finance';
import { checkAnimalSale, checkEquipmentSale, sellAnimal, sellEquipment, type AssetSaleResult } from './asset-sale';

export type AssetSaleKind = 'animal' | 'equipment';
export type ManualAssetSaleResult = AssetSaleResult | { ok: false; reason: 'rented-equipment' };
/** Shop list0x4baee: animals active-only0x4bf3a; equipment excludes rentals0x4bd7a.
 * Actual sale buttons0x4c286..0x4c38a call the existing generic sale directly. */
export function checkManualAssetSale(world: Scenario, finances: FinancialState, kind: AssetSaleKind, slot: number,
  soilMoisture: number): ManualAssetSaleResult {
  if (kind === 'animal') return checkAnimalSale(world, finances.accounts.assets, slot);
  if (kind !== 'equipment') return { ok: false, reason: 'invalid-asset' };
  if (world.equipment[slot]?.active && (world.equipment[slot].flags & 64)) return { ok: false, reason: 'rented-equipment' };
  return checkEquipmentSale(world, finances.accounts.assets, slot, soilMoisture);
}
export function sellManualAsset(world: Scenario, finances: FinancialState, kind: AssetSaleKind, slot: number,
  soilMoisture: number): ManualAssetSaleResult {
  const quote = checkManualAssetSale(world, finances, kind, slot, soilMoisture);
  if (!quote.ok) return quote;
  return kind === 'animal' ? sellAnimal(world, finances.accounts.assets, slot)
    : sellEquipment(world, finances.accounts.assets, slot, soilMoisture);
}
