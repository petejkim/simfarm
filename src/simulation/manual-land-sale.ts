import type { Scenario } from '../formats/scenario';
import type { FinancialState } from '../formats/finance';
import { worldIndex } from '../formats/scenario';
import { quoteLandSale } from './land';
import { sellLand, type LandSaleResult } from './land-sale';

export type ManualLandSaleResult = LandSaleResult | { ok: false; reason: 'home-plot' | 'field-on-plot' };
/** Map callback355c2..3564a protects the home region and calls1b770 to scan
 * the64 overlay words for field bit1000 before the taxable ordinary sale. */
export function checkManualLandSale(world: Scenario, finances: FinancialState, regionX: number, regionY: number,
  soilMoisture: number): ManualLandSaleResult {
  const quote = quoteLandSale(world, regionX, regionY, soilMoisture);
  if (!quote) return { ok: false, reason: 'outside-map' };
  if (quote.ownership !== 1) return { ok: false, reason: 'not-owned' };
  if (regionX === finances.accounts.homeRegionX && regionY === finances.accounts.homeRegionY)
    return { ok: false, reason: 'home-plot' };
  for (let x = regionX * 8; x < regionX * 8 + 8; x++) for (let y = regionY * 8; y < regionY * 8 + 8; y++)
    if (world.cells[worldIndex(x, y)].overlay & 0x1000) return { ok: false, reason: 'field-on-plot' };
  return { ok: true, regionX, regionY, price: quote.price, demolishedBuildings: [] };
}
export function sellManualLand(world: Scenario, finances: FinancialState, regionX: number, regionY: number,
  soilMoisture: number): ManualLandSaleResult {
  const check = checkManualLandSale(world, finances, regionX, regionY, soilMoisture);
  return check.ok ? sellLand(world, finances.accounts, regionX, regionY, finances.clearing, soilMoisture, true) : check;
}
