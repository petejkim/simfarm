import type { AnimalRecord } from '../formats/animal';
import { Binary } from '../formats/binary';
import type { FinancialState } from '../formats/finance';
import type { Scenario } from '../formats/scenario';
import { allocateAnimal, animalVocal, ANIMAL_ADULT_WEEKS, ANIMAL_GESTATION_WEEKS, ANIMAL_LIFESPAN_WEEKS } from './animal-allocation';
import { prepareAnimalDeath } from './animal-care';
import type { FarmRandom } from './random';
import type { AnimalVocal } from './events';

/** Native presentation notices; these are not invented original string IDs. */
export interface AnimalLifecycleNotice {
  kind: 'born' | 'old-age' | 'birth-capacity';
  slot: number;
  animalType: number;
  parentSlot?: number;
}

function activeAnimals(world: Scenario): AnimalRecord[] {
  const animals = world.animals.filter(a => a.active && a.slot > 0);
  if (animals.some(a => a.slot > 255 || a.type < 160 || a.type > 163 || a.x >= 96 || a.y >= 96))
    throw new Error('Invalid animal lifecycle state');
  return animals;
}

/** Weekly phase0xc14c..0xc21f: vocal request, wrapped age, adult image and
 * old-age removal. Bounded initial slots correct the shrinking-count scan
 * (SF-059); removal also keeps the species count consistent (SF-106). */
export function ageAnimals(world: Scenario, finances: FinancialState, random: FarmRandom): {
  notices: AnimalLifecycleNotice[]; sounds: AnimalVocal[];
} {
  const animals = activeAnimals(world), removals = new Map<number, () => void>(), counts = [0, 0, 0, 0];
  for (const a of animals) if (((a.ageWeeks + 1) & 65535) > ANIMAL_LIFESPAN_WEEKS[a.type - 160]) {
    removals.set(a.slot, prepareAnimalDeath(world, finances, a)); counts[a.type - 160]++;
  }
  counts.forEach((count, type) => {
    if (count && count > finances.accounts.assets.animalDefinitions[type].count) throw new Error('Invalid animal lifecycle count');
  });
  const result: { notices: AnimalLifecycleNotice[]; sounds: AnimalVocal[] } = { notices: [], sounds: [] };
  for (const a of animals) {
    if ((random.nextSimulation() & 127) === 75) result.sounds.push(animalVocal(a.type, random));
    const age = (a.ageWeeks + 1) & 65535;
    new Binary(a.bytes).view.setUint16(10, age, true);
    if (age > ANIMAL_ADULT_WEEKS[a.type - 160]) a.bytes[18] = 1;
    const remove = removals.get(a.slot);
    if (remove) { remove(); result.notices.push({ kind: 'old-age', slot: a.slot, animalType: a.type }); }
  }
  return result;
}

/** Monthly0x12c38, called at0xd032 after loan collection. The original
 * predicate requires no mate or distance query; flag2 controls eligibility. */
export function beginAnimalPregnancies(world: Scenario): number[] {
  const started: number[] = [];
  for (const a of activeAnimals(world)) {
    if ((a.flags & 2) && !(a.flags & 1) && a.ageWeeks > ANIMAL_ADULT_WEEKS[a.type - 160] && a.conditionByte > 110) {
      a.flags |= 1; a.bytes[28] = 0; started.push(a.slot);
    }
  }
  return started;
}

/** Weekly0x12cae, called at0xbe81 after wind. Queue all births before
 * allocation so reused low slots/newborns cannot enter this week's scan.
 * Source newborns share the parent's coordinates, with no immediate painting
 * or inherited storage reference; their next ordinary frame moves them. */
export function advanceAnimalGestation(world: Scenario, finances: FinancialState, random: FarmRandom): AnimalLifecycleNotice[] {
  const animals = activeAnimals(world), births: AnimalRecord[] = [];
  // Validate definitions/accounting before clearing any pregnancy or consuming RNG.
  for (const a of animals) {
    const def = finances.accounts.assets.animalDefinitions[a.type - 160];
    if (!def || def.type !== a.type || def.width !== 1 || def.height !== 1) throw new Error('Invalid animal lifecycle definition');
  }
  if (!Number.isInteger(finances.statistics.ds3e5c) || finances.statistics.ds3e5c < 0 || finances.statistics.ds3e5c > 0xffffffff)
    throw new Error('Invalid animal lifecycle account');
  for (const a of animals) if ((a.flags & 3) === 3) {
    a.bytes[28] = (a.bytes[28] + 1) & 255;
    if (a.bytes[28] > ANIMAL_GESTATION_WEEKS[a.type - 160]) {
      a.flags &= ~1; a.bytes[28] = 0; births.push(a);
    }
  }
  return births.map(parent => {
    const child = allocateAnimal(world, finances, random, parent.type, parent.x, parent.y);
    return child ? { kind: 'born', slot: child.slot, animalType: child.type, parentSlot: parent.slot }
      : { kind: 'birth-capacity', slot: parent.slot, animalType: parent.type };
  });
}
