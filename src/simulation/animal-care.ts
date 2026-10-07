import type { AnimalRecord } from '../formats/animal';
import type { FinancialState } from '../formats/finance';
import { worldIndex, type Scenario } from '../formats/scenario';
import { consumeAnimalSupply } from './animal-needs';
import { BUILDING_GRAPHICS, toggleBuildingInterior } from './building-storage';

// DS6190:22d8 /22dc. The water warning excludes equality with its death
// threshold, while the food warning does not. Death requires strictly greater.
const waterLimits = [50, 35, 56, 56];
const feedLimits = [160, 160, 80, 64];
export interface AnimalCareResult {
  died: 'water' | 'feed' | null;
  notices: (56 | 57 | 58 | 59)[];
  sound: 6 | null;
}

/** Generic deletion0x3a10a ->0x11b4c, with native count/storage validation.
 * Death removes occupancy without sale proceeds or a guessed asset reversal. */
function prepareDeath(world: Scenario, finances: FinancialState, animal: AnimalRecord): () => void {
  const definition = finances.accounts.assets.animalDefinitions[animal.type - 160];
  if (!definition || definition.type !== animal.type || !definition.count || definition.width !== 1 || definition.height !== 1)
    throw new Error('Invalid animal care definition');
  const building = animal.flags & 4 ? world.buildings[animal.buildingSlot] : undefined;
  let contentIndex = 0;
  if (animal.flags & 4) {
    const d = building && world.buildingDefinitions[building.type - 64];
    if (!building?.slot || !building.active || !d || BUILDING_GRAPHICS[d.graphic] === undefined ||
      animal.x < building.x || animal.y < building.y || animal.x >= building.x + d.width || animal.y >= building.y + d.height ||
      building.x + d.width > 96 || building.y + d.height > 96) throw new Error('Invalid animal care storage');
    contentIndex = (animal.x - building.x) * 3 + animal.y - building.y;
    const content = building.content(contentIndex);
    if (content.type !== animal.type || content.slot !== animal.slot) throw new Error('Animal care storage mismatch');
  }
  return () => {
    world.cells[worldIndex(animal.x, animal.y)].terrain &= 0xf7ff;
    definition.count--;
    if (building) {
      building.clearContent(contentIndex);
      toggleBuildingInterior(building, world); toggleBuildingInterior(building, world);
    }
    animal.flags &= ~0x20;
  };
}

/** 0x12a4e: post-movement water then feed, condition and death handling.
 * Returned source notice/sound identifiers belong to presentation, not state.
 * Frame scheduling and movement are deliberately separate callers. */
export function careForAnimal(world: Scenario, finances: FinancialState, slot: number, soilMoisture: number): AnimalCareResult {
  const animal = world.animals[slot];
  if (!Number.isInteger(slot) || slot <= 0 || slot > 255 || !animal?.active || animal.type < 160 || animal.type > 163 ||
    animal.x >= 96 || animal.y >= 96) throw new Error('Unsupported animal care state');
  if (!Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid animal soil moisture');
  const remove = prepareDeath(world, finances, animal), bytes = animal.bytes, type = animal.type - 160;
  const result: AnimalCareResult = { died: null, notices: [], sound: null };
  if (bytes[14]) {
    if (animal.flags & 4) {
      bytes[14] = bytes[13] = 0;
      bytes[8] = Math.min(255, bytes[8] + 30);
    } else if (consumeAnimalSupply(world, finances, animal, 'water', soilMoisture)) bytes[14] = 0;
    else if (bytes[14] > (waterLimits[type] >>> 1) && bytes[14] < waterLimits[type]) {
      result.notices.push(57); bytes[8] = Math.max(0, bytes[8] - 1);
    }
    if (bytes[14] > waterLimits[type]) {
      remove(); result.died = 'water'; result.notices.push(58); result.sound = 6;
      return result; // No feed search after death from lack of water.
    }
  }
  if (bytes[13]) {
    if (consumeAnimalSupply(world, finances, animal, 'feed', soilMoisture)) bytes[13] = 0;
    else if (bytes[13] > (feedLimits[type] >>> 1)) {
      result.notices.push(59); bytes[8] = Math.max(0, bytes[8] - 1);
    }
    if (bytes[13] > feedLimits[type]) {
      remove(); result.died = 'feed'; result.notices.push(56); result.sound = 6;
    }
  }
  return result;
}
