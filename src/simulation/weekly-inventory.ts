import { Binary } from '../formats/binary';
import { worldIndex, type Scenario } from '../formats/scenario';
import { withdrawStoredWater } from './water-storage';

/** Inventory tail0xc230..0xc362 of weekly0xbf02. Source loss increments
 * apply to168..191 and192..215; the age word wraps for every active item. */
export function ageInventoryAndRefillTroughs(world: Scenario): void {
  const items = world.inventory.filter(i => i.slot > 0 && i.active);
  if (items.some(i => i.slot > 511 || i.x >= 96 || i.y >= 96)) throw new Error('Invalid weekly inventory position');
  withdrawStoredWater(world, 0); // Validate the supplies before any inventory mutation.
  for (const i of items) {
    const v = new Binary(i.bytes);
    if (i.type >= 168 && i.type <= 215 && i.loss < 65530)
      v.view.setUint16(4, Math.min(65530, i.loss + ((i.bytes[10] & 4) ? 1 : 4)), true);
    if (i.type === 299 && !i.quantity) {
      const amount = withdrawStoredWater(world, 64);
      v.view.setUint16(2, amount * 2, true);
      if (amount) {
        const cell = world.cells[worldIndex(i.x, i.y)];
        cell.terrain = (cell.terrain & 0xf800) | 176;
      }
    }
    v.view.setUint16(6, (v.u16(6) + 1) & 65535, true);
  }
}
