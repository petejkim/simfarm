import type { Scenario } from '../formats/scenario';
import { worldIndex } from '../formats/scenario';
import { queueClearingEffect, validateClearingEffects, type ClearingEffects } from './clearing-effects';
import { eraseEquipment, equipmentChain } from './equipment-world';
import { releaseEquipment } from './equipment-dispatch';
import { validAircraftHome } from './aircraft-home';

/** Native correction of corner-only query 0x1b868 (SF-062): first active slot
 * with a nonempty overlap, using the saved dimensions and exclusive far edges. */
export function findOverlappingField(world: Scenario, x: number, y: number, width: number, height: number): number | null {
  if (![x, y, width, height].every(Number.isInteger) || width <= 0 || height <= 0) throw new Error('Invalid field query');
  return world.fields.find(f => f.slot > 0 && f.active && x < f.x + f.width && x + width > f.x &&
    y < f.y + f.height && y + height > f.y)?.slot ?? null;
}

/** 0x1b996 followed by 0x1ba6a, as called by default 0x1da1c..0x1da2d.
 * Keep all plan/record bytes except active bit; original calls do not clear them. */
export function removeField(world: Scenario, slot: number, effects: ClearingEffects, soilMoisture: number): boolean {
  const f = world.fields[slot];
  if (!Number.isInteger(slot) || slot <= 0 || !f?.active) return false;
  validateClearingEffects(effects, soilMoisture);
  if (!f.width || !f.height || f.x + f.width > 96 || f.y + f.height > 96) throw new Error('Invalid field bounds');
  const released = new Set<Scenario['equipment'][number]>();
  const machines = f.state ? [f.equipment, f.pendingEquipment].filter(Boolean).map(id => {
    const e = world.equipment[id];
    if (!e) throw new Error('Invalid field equipment');
    if (e.active) for (const member of equipmentChain(e, world)) {
      if (!world.equipmentDefinitions[member.type]) throw new Error('Invalid field equipment type');
      if (member.type === 8 && (member.flags & 0x40) && !validAircraftHome(member)) throw new Error('Invalid aircraft home');
      released.add(member);
    }
    return e;
  }) : [];
  for (const e of machines) { eraseEquipment(e, world); releaseEquipment(e, world); }
  // SF-063: source leaves free tractors attached to now-inactive rentals.
  // Detach the released chains after both original release calls have run.
  for (const e of released) { if (e.type !== 7) e.parent = 0; e.attachment = 0; }
  for (let x = f.x; x < f.x + f.width; x++) for (let y = f.y; y < f.y + f.height; y++) {
    queueClearingEffect(world, effects, x, y, soilMoisture);
    world.cells[worldIndex(x, y)].overlay &= 0xefff;
  }
  f.bytes[7] &= ~1;
  return true;
}
