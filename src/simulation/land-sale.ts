import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { prepareBuildingDemolitions, type BuildingDemolitionState } from './building-demolition';
import { validateClearingEffects, type ClearingEffects } from './clearing-effects';
import { fenceLandSaleNeighbors, quoteLandSale } from './land';

export interface LandSaleState extends BuildingDemolitionState { landIncome: number }
export type LandSaleResult = { ok: true; regionX: number; regionY: number; price: number; demolishedBuildings: number[] }
  | { ok: false; reason: 'outside-map' | 'not-owned' };

/** Overlay 15:1e22 / file 0x3c9c2. Field teardown belongs to the caller,
 * not this routine. Default passes taxable=false; ordinary sales may pass true. */
export function sellLand(world: Scenario, state: LandSaleState, regionX: number, regionY: number,
  effects: ClearingEffects, soilMoisture: number, taxable: boolean): LandSaleResult {
  const quote = quoteLandSale(world, regionX, regionY, soilMoisture);
  if (!quote) return { ok: false, reason: 'outside-map' };
  if (quote.ownership !== 1) return { ok: false, reason: 'not-owned' };
  validateClearingEffects(effects, soilMoisture);
  if (typeof taxable !== 'boolean' || ![world.farm.cash, world.farm.salesAccumulator, state.landIncome]
    .every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff)) throw new Error('Invalid land sale accounts');
  const x0 = regionX * 8, y0 = regionY * 8;
  const encounters = new Map<number, number>(), selected = new Set<number>();
  // Reproduce one first-active building lookup per tile, with earlier removals
  // excluded. This retains source ordering even for overlapping footprints.
  for (let x = x0; x < x0 + 8; x++) for (let y = y0; y < y0 + 8; y++) {
    const b = world.buildings.find(b => {
      if (!b.slot || !b.active || selected.has(b.slot)) return false;
      const d = world.buildingDefinitions[b.type - 64];
      if (!d) throw new Error('Invalid building type during land sale');
      return x >= b.x && x < b.x + d.width && y >= b.y && y < b.y + d.height;
    });
    if (b) { encounters.set(worldIndex(x, y), b.slot); selected.add(b.slot); }
  }
  const demolition = prepareBuildingDemolitions(world, state, [...selected], effects, soilMoisture);
  world.farm.cash = Math.min(9_999_999, (world.farm.cash + quote.price) >>> 0); // Credit category 2000 has no expense reversal.
  if (taxable) world.farm.salesAccumulator = (world.farm.salesAccumulator + quote.price) >>> 0;
  state.landIncome = (state.landIncome + quote.price) >>> 0;
  world.regionalConditions[(regionX * 12 + regionY) * 7 + 1] = 0;
  for (let x = x0; x < x0 + 8; x++) for (let y = y0; y < y0 + 8; y++) {
    const index = worldIndex(x, y), slot = encounters.get(index);
    if (slot !== undefined) demolition.get(slot)!();
    const cell = world.cells[index];
    cell.overlay &= 0xb7ff;
    const tile = terrainTile(cell);
    if (tile < 39 || tile >= 69) cell.terrain = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 65535;
  }
  fenceLandSaleNeighbors(world, regionX, regionY);
  return { ok: true, regionX, regionY, price: quote.price, demolishedBuildings: [...selected] };
}
