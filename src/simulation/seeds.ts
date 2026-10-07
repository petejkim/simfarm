import { worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding, toggleBuildingInterior } from './building-storage';

export type SeedResult = { ok: true; source: 'stored' | 'purchased'; cost: number } | { ok: false; reason: 'no-seeds' | 'insufficient-funds' };

/** 0x152d6. Consume the first matching seed item, otherwise buy with the original 20-unit surcharge. */
export function consumeSeed(world: Scenario, cropSlot: number, soilMoisture: number): SeedResult {
  if (!Number.isInteger(cropSlot) || cropSlot < 0 || cropSlot >= 16) throw new Error('Invalid seed crop slot');
  const definition = world.seedDefinitions[cropSlot];
  const item = world.inventory.find(i => i.slot && i.active && i.type === 192 + cropSlot);
  if (item) {
    // SF-016: fail before world edits if the original removal routine would leave the seed active.
    if (!definition.count) throw new Error('Seed inventory count does not match active item');
    const building = findBuilding(world, item.x, item.y);
    if (building) {
      const dx = item.x - building.x, dy = item.y - building.y, def = world.buildingDefinitions[building.type - 64];
      const content = building.content(dx * 3 + dy);
      if (content.type !== item.type || content.slot !== item.slot || dx + definition.width > def.width || dy + definition.height > def.height) {
        throw new Error('Seed inventory does not match building contents');
      }
      for (let x = dx; x < dx + definition.width; x++) for (let y = dy; y < dy + definition.height; y++) building.clearContent(x * 3 + y);
      toggleBuildingInterior(building, world); toggleBuildingInterior(building, world);
    } else {
      // 0x95ca replaces the complete terrain word; the second word is left intact.
      const cell = world.cells[worldIndex(item.x, item.y)];
      cell.terrain = (15 + soilMoisture + (cell.attribute >> 2)) & 0xffff;
    }
    definition.count--; item.bytes[10] &= ~0x20; // 0x3a1b2..0x3a1f1 -> 0x152b0.
    return { ok: true, source: 'stored', cost: 0 };
  }
  if (!world.farm.autoBuySeeds) return { ok: false, reason: 'no-seeds' };
  const cost = (definition.price + 20) & 0xffff;
  if (cost > world.farm.cash || !cost) return { ok: false, reason: 'insufficient-funds' };
  world.farm.cash -= cost;
  world.farm.seedExpenses = (world.farm.seedExpenses + cost) >>> 0;
  return { ok: true, source: 'purchased', cost };
}
