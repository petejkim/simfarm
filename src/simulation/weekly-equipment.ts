import { MAX_EQUIPMENT_SLOT } from '../formats/equipment';
import { Binary } from '../formats/binary';
import type { FinancialState } from '../formats/finance';
import type { Scenario } from '../formats/scenario';
import { sellEquipment, type AssetSaleResult } from './asset-sale';
import { findBuilding } from './building-storage';
import { queueClearingEffect, validateClearingEffects } from './clearing-effects';
import { equipmentFootprint, wearEquipment } from './equipment-world';

export type EquipmentAgingNotice = { slot: number; equipmentType: number; x: number; y: number } &
  ({ kind: 'sold'; value: number; outdoor: boolean } | { kind: 'deferred'; reason: Extract<AssetSaleResult, { ok: false }>['reason'] });

/** Equipment prefix0xbf02..0xc02d of the weekly aging dispatcher. Source
 * action2 calls the sale handler, including proceeds, before clearing effects.
 * Bounded initial slots correct the shrinking-count skipped tail (SF-059). */
export function ageEquipment(world: Scenario, finances: FinancialState, soilMoisture: number): EquipmentAgingNotice[] {
  validateClearingEffects(finances.clearing, soilMoisture);
  const equipment = world.equipment.filter(e => e.slot > 0 && e.active);
  if (equipment.some(e => e.slot > MAX_EQUIPMENT_SLOT || e.type > 8 || !world.equipmentDefinitions[e.type]))
    throw new Error('Invalid weekly equipment');
  const result: EquipmentAgingNotice[] = [];
  for (const e of equipment) {
    const b = new Binary(e.bytes), age = (b.u16(18) + 1) & 65535;
    b.view.setUint16(18, age, true);
    if (age > 4) { wearEquipment(e, 1); b.view.setUint16(18, 0, true); }
    if (e.condition !== 255 || (e.flags & 64)) continue;
    const info = { slot: e.slot, equipmentType: e.type, x: e.x, y: e.y };
    const outdoor = !findBuilding(world, e.x, e.y), size = equipmentFootprint(e, world);
    // Sale already guards its footprint. Also guard the weekly rotated
    // clearing footprint, which differs from sale for type8 aircraft.
    if (outdoor && (size.width < 1 || size.height < 1 || e.x + size.width > 96 || e.y + size.height > 96)) {
      result.push({ ...info, kind: 'deferred', reason: 'inconsistent-asset' }); continue;
    }
    const sale = sellEquipment(world, finances.accounts.assets, e.slot, soilMoisture);
    if (!sale.ok) { result.push({ ...info, kind: 'deferred', reason: sale.reason }); continue; }
    if (outdoor) for (let x = info.x; x < info.x + size.width; x++) for (let y = info.y; y < info.y + size.height; y++)
      queueClearingEffect(world, finances.clearing, x, y, soilMoisture);
    result.push({ ...info, kind: 'sold', value: sale.value, outdoor });
  }
  return result;
}
