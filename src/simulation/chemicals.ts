import { worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding, toggleBuildingInterior } from './building-storage';

export type ChemicalResult = { ok: true; source: 'stored' | 'purchased'; cost: number }
  | { ok: false; reason: 'no-supplies' | 'insufficient-funds' | 'inconsistent-stock' };

/** Supply consumption 1234:01a0/file 0x146e0. One record per application.
 * DS a89c is shared with automatic seed buying. The source charges a fixed 275 for all four types. */
export function consumeChemical(world: Scenario, type: number, soilMoisture: number): ChemicalResult {
  if (!Number.isInteger(type) || type < 220 || type > 223) throw new Error('Invalid chemical type');
  const item = world.chemicals.find(c => c.slot && c.active && c.type === type);
  if (item) {
    const definition = world.chemicalDefinitions[type - 220];
    // SF-030: validate removal before clearing the image or returning a successful application.
    if (!definition.count || item.x >= 96 || item.y >= 96) return { ok: false, reason: 'inconsistent-stock' };
    const building = findBuilding(world, item.x, item.y);
    if (building) {
      const index = (item.x - building.x) * 3 + item.y - building.y, content = building.content(index);
      if (content.type !== type || content.slot !== item.slot) return { ok: false, reason: 'inconsistent-stock' };
      building.clearContent(index);
      toggleBuildingInterior(building, world); toggleBuildingInterior(building, world);
    } else {
      const cell = world.cells[worldIndex(item.x, item.y)];
      cell.terrain = (15 + soilMoisture + (cell.attribute >> 2)) & 0xffff;
    }
    definition.count--; item.bytes[2] &= ~32; // 0x3a25a..0x3a299 -> 0x1460c.
    return { ok: true, source: 'stored', cost: 0 };
  }
  if (!world.farm.autoBuySeeds) return { ok: false, reason: 'no-supplies' };
  if (world.farm.cash < 275) return { ok: false, reason: 'insufficient-funds' };
  world.farm.cash -= 275;
  world.farm.chemicalExpenses = (world.farm.chemicalExpenses + 275) >>> 0;
  return { ok: true, source: 'purchased', cost: 275 };
}
