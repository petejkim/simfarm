import { Binary } from '../formats/binary';
import type { FinancialState } from '../formats/finance';
import type { Scenario } from '../formats/scenario';
import type { FarmRandom } from './random';

export const ANIMAL_ADULT_WEEKS = [192, 80, 32, 12] as const; // DS2290.
export const ANIMAL_LIFESPAN_WEEKS = [960, 960, 720, 480] as const; // DS2288.
export const ANIMAL_GESTATION_WEEKS = [48, 40, 44, 24] as const; // DS2294; birth requires strictly greater.

/** Allocator0x11a76 and generic add0x3a37a. Used by purchases AND births:
 * no cash debit, placement validation, storage insertion or immediate painting.
 * Every byte not written by the original initializer survives slot reuse. */
export function allocateAnimal(world: Scenario, finances: FinancialState, random: FarmRandom, type: number, x: number, y: number) {
  if (!Number.isInteger(type) || type < 160 || type > 163 ||
    ![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96)) throw new Error('Invalid animal allocation');
  const definition = finances.accounts.assets.animalDefinitions[type - 160];
  if (!definition || definition.type !== type || definition.width !== 1 || definition.height !== 1 ||
    !Number.isInteger(finances.statistics.ds3e5c) || finances.statistics.ds3e5c < 0 || finances.statistics.ds3e5c > 0xffffffff)
    throw new Error('Invalid animal allocation definition');
  const animal = world.animals.find(a => a.slot > 0 && a.slot < 256 && !a.active);
  if (!animal) return undefined;
  const bytes = animal.bytes, v = new Binary(bytes).view;
  bytes[0] = x; bytes[1] = y; v.setUint16(6, type, true);
  bytes[4] = random.nextVisual() & 7; bytes[5] = 1; bytes[8] = 255;
  bytes[14] = bytes[13] = 0; v.setUint16(10, 0, true); bytes[12] = 1;
  v.setUint16(16, 0, true); v.setUint16(20, 0, true); bytes[18] = 0;
  animal.flags = 0x20; v.setUint16(26, ANIMAL_GESTATION_WEEKS[type - 160], true); bytes[28] = 0;
  if (random.nextSimulation() & 1) animal.flags |= 2;
  definition.count = (definition.count + 1) & 65535;
  finances.statistics.ds3e5c = (finances.statistics.ds3e5c + (definition.price << 16 >> 16)) >>> 0;
  return animal;
}

/** Source0x135f8 consumes visual RNG only for cow/sheep variants, even if
 * presentation is muted. Delivery belongs to the independent audio layer. */
export function animalVocal(type: number, random: FarmRandom): string {
  if (type === 160) return 'horse1.voc';
  if (type === 161) return `cow${(random.nextVisual() & 1) + 1}.voc`;
  if (type === 162) return 'pig.voc';
  if (type === 163) return `sheep${(random.nextVisual() & 1) + 1}.voc`;
  throw new Error('Invalid animal vocal type');
}
