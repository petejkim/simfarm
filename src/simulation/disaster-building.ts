import type { Scenario } from '../formats/scenario';
import type { FinancialState } from '../formats/finance';
import { prepareBuildingDemolitions } from './building-demolition';
import { drawEquipment, eraseEquipment, equipmentChain, equipmentImage } from './equipment-world';
import { releaseFirstHarvestReservation } from './harvest-storage';

/** Native SF-128 correction: destruction cannot leave field jobs and surviving
 * machines pointing at deleted contents/storage. Original cleanup does not do
 * this. Cancel affected work without granting harvest, refunds or new crops. */
export function prepareDisasterBuilding(world: Scenario, finances: FinancialState, slot: number, soil: number): () => void {
  const demolish = prepareBuildingDemolitions(world, finances.accounts, [slot], finances.clearing, soil, true).get(slot)!;
  const building = world.buildings[slot], def = world.buildingDefinitions[building.type - 64];
  const lost = new Set<number>(), stopped = new Set<number>();
  for (let x = 0; x < def.width; x++) for (let y = 0; y < def.height; y++) {
    const c = building.content(x * 3 + y);
    if (c.type >= 0 && c.type <= 8 && world.equipment[c.slot]?.active) { lost.add(c.slot); stopped.add(c.slot); }
  }
  for (const e of world.equipment) if (e.active && e.type === 7 && e.parent === slot) stopped.add(e.slot);
  const fields = new Set<Scenario['fields'][number]>();
  const header = (f: Scenario['fields'][number]) => f.state === 5 && f.step < 4 ? f.bytes[46] | f.bytes[47] << 8 : 0;
  // Close over both job references and entire linked groups before mutation.
  let changed: boolean;
  do {
    const previous = stopped.size + fields.size;
    for (const e of world.equipment) if (e.active && (stopped.has(e.slot) || stopped.has(e.attachment) || (e.type !== 7 && stopped.has(e.parent)))) {
      stopped.add(e.slot);
      if (e.attachment) stopped.add(e.attachment);
      if (e.type !== 7 && e.parent) stopped.add(e.parent);
    }
    for (const f of world.fields) if (f.active &&
      ([f.equipment, f.pendingEquipment, header(f)].some(id => id && stopped.has(id)) ||
        (f.state === 5 && (f.bytes[64] | f.bytes[65] << 8) === slot))) {
      fields.add(f);
      for (const id of [f.equipment, f.pendingEquipment, header(f)]) if (id) stopped.add(id);
    }
    changed = previous !== stopped.size + fields.size;
  } while (changed);
  // These are native retained references, not permission to tolerate malformed saves.
  for (const id of stopped) {
    const e = world.equipment[id];
    if (!e?.active) throw new Error('Invalid disaster equipment reference');
    equipmentChain(e, world); equipmentImage(e, world);
  }
  return () => {
    for (const id of stopped) if (!lost.has(id)) eraseEquipment(world.equipment[id], world);
    for (const f of fields) {
      if (f.state === 5) {
        const storage = f.bytes[64] | f.bytes[65] << 8;
        if (storage && world.buildings[storage]?.active) releaseFirstHarvestReservation(world, storage);
        f.bytes[64] = f.bytes[65] = 0;
        if (header(f)) f.bytes[46] = f.bytes[47] = 0;
      }
      // Preserve an existing growing crop; unfinished new planting returns to Waiting.
      if (f.state !== 0 && f.state !== 4) { f.bytes[2] = f.bytes[6] & 4 ? 4 : 0; f.bytes[3] = f.bytes[4] = f.bytes[5] = 0; }
      f.equipment = f.pendingEquipment = 0;
    }
    for (const id of stopped) {
      if (lost.has(id)) continue; // Retain destroyed record bytes; original deletion clears active32 only.
      const e = world.equipment[id];
      e.parent = e.attachment = 0; e.bytes[48] = 0;
      e.flags &= ~0x1f0b; // Clear work/reservation/motion/arrival modes, keep storage/rental/activity.
      if (!(e.flags & 4)) { e.flags |= 128; drawEquipment(e, world); }
    }
    demolish();
  };
}
