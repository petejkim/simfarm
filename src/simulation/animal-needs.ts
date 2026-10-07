import type { AnimalRecord } from '../formats/animal';
import { Binary } from '../formats/binary';
import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';

function validAnimal(animal: AnimalRecord): void {
  if (!animal.active || animal.slot < 1 || animal.slot > 255 || animal.type < 160 || animal.type > 163 ||
    animal.x >= 96 || animal.y >= 96) throw new Error('Unsupported animal needs state');
}

/** 0x12d8e, called by odd-day work at0xd28b. Bounded native traversal
 * replaces the original count-driven scan. This is not yet a live clock hook. */
export function increaseAnimalNeeds(world: Scenario, temperature: number): void {
  if (!Number.isInteger(temperature) || temperature < -128 || temperature > 127) throw new Error('Invalid animal temperature');
  const animals = world.animals.filter(a => a.active);
  animals.forEach(validAnimal); // Unsupported state cannot leave a partially updated herd.
  for (const a of animals) {
    const type = a.type - 160;
    a.bytes[13] = Math.min(255, a.bytes[13] + [8, 8, 4, 2][type]);
    a.bytes[14] = Math.min(255, a.bytes[14] + [2, 2, 1, 1][type]);
    if (!(a.flags & 4) && (temperature < 32 || temperature > 95)) a.bytes[8] = Math.max(0, a.bytes[8] - 5);
  }
}

/** Consumption0x12ea0/0x12fde. Search5×5 x-major with original coordinate
 * clamping. The caller owns need reset, condition loss and death decisions.
 * Native supply records must match their visible resource (SF-096). */
export function consumeAnimalSupply(world: Scenario, finances: FinancialState, animal: AnimalRecord,
  kind: 'water' | 'feed', soilMoisture: number): boolean {
  validAnimal(animal);
  if (kind !== 'water' && kind !== 'feed') throw new Error('Invalid animal supply kind');
  if (!Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid animal soil moisture');
  const type = kind === 'water' ? 299 : 300, need = animal.bytes[kind === 'water' ? 14 : 13];
  for (let x = animal.x - 2; x <= animal.x + 2; x++) for (let y = animal.y - 2; y <= animal.y + 2; y++) {
    const px = Math.max(0, Math.min(95, x)), py = Math.max(0, Math.min(95, y)), cell = world.cells[worldIndex(px, py)];
    const image = kind === 'water' ? terrainTile(cell) : cell.overlay & 0x7ff;
    if (kind === 'water' ? image !== 175 : image < 1020 || image > 1024) continue;
    const item = world.inventory.find(i => i.slot > 0 && i.active && i.x === px && i.y === py);
    if (!item || item.type !== type || !item.quantity) continue;
    const quantity = Math.max(0, item.quantity - need), def = finances.accounts.otherDefinitions[type - 288];
    if (!def || def.type !== type || (kind === 'feed' && !quantity && !def.count)) throw new Error('Invalid animal supply definition');
    new Binary(item.bytes).view.setUint16(2, quantity, true);
    if (kind === 'water') {
      if (!quantity) cell.terrain = (cell.terrain & 0xf800) | 174; // Empty trough remains allocated.
    } else if (!quantity) {
      cell.terrain &= 0xf7ff;
      cell.overlay = ((cell.overlay & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 65535;
      def.count--; item.bytes[10] &= ~0x20;
    } else {
      const stage = quantity < 102 ? 4 : quantity < 206 ? 3 : quantity < 308 ? 2 : quantity < 410 ? 1 : 0;
      cell.overlay = (cell.overlay & 0xf800) | (1020 + stage); cell.terrain |= 0x800;
    }
    return true;
  }
  return false;
}
