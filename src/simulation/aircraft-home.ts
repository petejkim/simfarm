import { worldIndex, type Scenario } from '../formats/scenario';
import type { EquipmentRecord } from '../formats/equipment';

export function validAircraftHome(e: EquipmentRecord): boolean { return e.bytes[50] < 95 && e.bytes[51] < 95; }

/** 0x319ee..0x31acb, called by type-8 record deletion (sale or rental return). */
export function clearAircraftHome(world: Scenario, e: EquipmentRecord): void {
  if (!validAircraftHome(e)) throw new Error('Invalid aircraft home');
  const x = e.bytes[50], y = e.bytes[51];
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
    const cell = world.cells[worldIndex(x + dx, y + dy)];
    cell.terrain = (cell.terrain & 0xf800) | 23;
  }
  const index = ((x >>> 3) * 12 + (y >>> 3)) * 7;
  if ((x & 7) === 3) world.regionalConditions[index] &= ~0x20;
  else if ((x & 7) === 5) world.regionalConditions[index] &= ~0x40;
}
