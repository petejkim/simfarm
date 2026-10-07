import { Binary } from '../formats/binary';
import type { AnimalRecord } from '../formats/animal';
import type { CropDefinition } from '../formats/crop';
import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding } from './building-storage';
import { equipmentDistance } from './equipment';
import type { FarmRandom } from './random';
import { careForAnimal, type AnimalCareResult } from './animal-care';
import { ANIMAL_GRAPHICS, ANIMAL_STEPS, animalCanWalk, animalDirection, animalHerdTarget,
  inAnimalMap, refreshAnimalHerd, stepStoredAnimal, storeMovingAnimal, validateAnimalFrameState, validateMovingAnimal, type AnimalFrameState } from './animal-world';

export interface AnimalMovementContext {
  tick: number;
  frame: AnimalFrameState;
  random: FarmRandom;
  crops: readonly CropDefinition[];
  /** Native map coordinates corresponding to the original pointer in a map
   * window. Null follows the original absent-window initialization at(0,0). */
  pointer: { x: number; y: number } | null;
}
export interface AnimalMovementResult {
  moved: boolean;
  stored: boolean;
  notices: (67)[];
  sounds: string[];
}

export interface AnimalFrameResult {
  slot: number;
  exited?: boolean;
  movement?: AnimalMovementResult;
  care?: AnimalCareResult;
}

/** Original frame wrapper0xdf48. Native visits the bounded initial active
 * slots once even if an earlier animal dies, correcting SF-059's skipped tail.
 * This state/operation still needs its canonical live-clock/checkpoint hook. */
export function advanceAnimalFrame(world: Scenario, finances: FinancialState, context: AnimalMovementContext, soilMoisture: number): AnimalFrameResult[] {
  validateAnimalFrameState(context.frame);
  if (!Number.isInteger(context.tick) || context.tick < 0 || context.tick > 65535) throw new Error('Invalid animal tick');
  const animals = world.animals.filter(a => a.active), result: AnimalFrameResult[] = [];
  animals.forEach(validateMovingAnimal);
  if (!animals.length) return result;
  refreshAnimalHerd(world, context.frame, context.random, context.tick);
  if (((context.tick - context.frame.lastMoveTick) & 65535) < 16) return result;
  for (const a of animals) {
    if (a.flags & 4) result.push({ slot: a.slot, exited: stepStoredAnimal(world, a, context.random) });
    else {
      const movement = moveAnimal(world, finances, a.slot, context);
      result.push({ slot: a.slot, movement, care: careForAnimal(world, finances, a.slot, soilMoisture) });
    }
  }
  context.frame.lastMoveTick = context.tick;
  return result;
}

/** Inventory0x155e4 /building0x1b3cc /field0x1bfd8 all keep the first
 * strict distance minimum. Native bounded arrays replace count-driven scans. */
function nearest<T extends { x: number; y: number }>(items: readonly T[], a: AnimalRecord): T | undefined {
  let best: T | undefined, distance = 1_000_000;
  for (const item of items) {
    const next = equipmentDistance(a.x, a.y, item.x, item.y);
    if (next < distance) { best = item; distance = next; }
  }
  return best;
}

/** Source routine0x11bce..0x1285e: target selection, one tile of motion,
 * storage entry, crop grazing and blocked/fence behavior. Canvas redraw calls
 * are replaced by canonical world writes. Frame scheduling is a caller concern. */
export function moveAnimal(world: Scenario, finances: FinancialState, slot: number, context: AnimalMovementContext): AnimalMovementResult {
  const a = world.animals[slot];
  if (!Number.isInteger(slot) || !a || slot <= 0 || slot > 255) throw new Error('Invalid moving animal slot');
  validateMovingAnimal(a); validateAnimalFrameState(context.frame);
  if ((a.flags & 4) || !Number.isInteger(context.tick) || context.tick < 0 || context.tick > 65535 ||
    (context.pointer && !inAnimalMap(context.pointer.x, context.pointer.y))) throw new Error('Invalid animal movement context');
  const definition = finances.accounts.assets.animalDefinitions[a.type - 160], base = definition && ANIMAL_GRAPHICS[definition.graphic];
  if (!definition || definition.type !== a.type || definition.width !== 1 || definition.height !== 1 || base === undefined)
    throw new Error('Invalid animal movement definition');
  const fields = world.fields.filter(f => f.slot > 0 && f.active);
  for (const f of fields) if (context.crops[f.cropSlot]?.rawDefinition.length !== 128) throw new Error('Invalid animal crop definition');
  const b = a.bytes, random = context.random, type = a.type - 160;
  const water = [50, 35, 56, 56][type], feed = [160, 160, 80, 64][type];
  const result: AnimalMovementResult = { moved: false, stored: false, notices: [], sounds: [] };
  let knocked = Boolean(a.flags & 8), target = { x: -1, y: 0 };
  if (knocked && ((context.tick - new Binary(b).u16(30)) & 65535) > 640) {
    a.flags &= ~8; knocked = false;
    // 0x135f8: cow/sheep choose a variant using visual RNG; other two do not.
    result.sounds.push(type === 0 ? 'horse1.voc' : type === 1 ? `cow${(random.nextVisual() & 1) + 1}.voc`
      : type === 2 ? 'pig.voc' : `sheep${(random.nextVisual() & 1) + 1}.voc`);
  }
  if (b[5]) { b[4] = random.nextVisual() & 7; b[5]--; }
  else if (b[14] > (water >>> 4)) {
    const supply = nearest(world.inventory.filter(i => i.slot > 0 && i.active && i.type === 299 && i.quantity > 0), a);
    const medium = nearest(world.buildings.filter(b => b.slot > 0 && b.active && b.type === 68), a);
    const large = nearest(world.buildings.filter(b => b.slot > 0 && b.active && b.type === 69), a);
    const selected = nearest([supply, medium, large].filter((v): v is NonNullable<typeof v> => v !== undefined), a);
    if (selected) {
      target = { x: selected.x, y: selected.y };
      b[4] = animalDirection(a.x, a.y, target.x, target.y);
      if ((random.nextSimulation() & 15) === 3) b[4] = (b[4] + 1) & 7;
    }
  } else if (b[13] > (feed >>> 4)) {
    const supply = nearest(world.inventory.filter(i => i.slot > 0 && i.active && i.type === 300 && i.quantity > 0), a);
    if (supply) {
      target = { x: supply.x, y: supply.y }; b[4] = animalDirection(a.x, a.y, target.x, target.y);
      if ((random.nextSimulation() & 15) === 6) b[4] = (b[4] + 1) & 7;
    } else {
      const field = nearest(fields.filter(f => !(context.crops[f.cropSlot].rawDefinition[62] & 4)), a);
      if (field) {
        target = { x: field.x + (random.nextVisual() & 7) + 2, y: field.y + (random.nextVisual() & 7) + 2 };
        b[4] = animalDirection(a.x, a.y, target.x, target.y);
      }
    }
  } else {
    target = animalHerdTarget(context.frame, a.type);
    const pointer = context.pointer ?? { x: 0, y: 0 };
    if (equipmentDistance(a.x, a.y, pointer.x, pointer.y) < 50) b[4] = animalDirection(a.x, a.y, pointer.x, pointer.y, true);
    else if (equipmentDistance(a.x, a.y, target.x, target.y) > 40 && (random.nextVisual() & 7) < 4)
      b[4] = animalDirection(a.x, a.y, target.x, target.y);
  }
  const [dx, dy] = ANIMAL_STEPS[b[4]], x = a.x + dx, y = a.y + dy;
  if (!inAnimalMap(x, y)) { b[4] = animalDirection(a.x, a.y, target.x, target.y); return result; }
  const origin = world.cells[worldIndex(a.x, a.y)], destination = world.cells[worldIndex(x, y)], tile = terrainTile(destination);
  if ((tile >= 460 && tile < 481) || tile === 217) {
    const building = findBuilding(world, x, y);
    if (building) result.stored = storeMovingAnimal(world, finances, a, building);
    return result;
  }
  const image = () => knocked ? a.type + 878 : base + b[4] * 2 + b[18];
  if (animalCanWalk(world, x, y)) {
    origin.terrain &= 0xf7ff;
    destination.overlay = ((destination.overlay & 0xf800) | image()) & 65535;
    destination.terrain |= 0x800; b[0] = x; b[1] = y; result.moved = true;
    if (tile >= 680 && tile <= 840) {
      const field = fields.find(f => f.contains(x, y));
      if (field && !(context.crops[field.cropSlot].rawDefinition[62] & 4)) {
        const v = new Binary(field.bytes).view;
        v.setUint16(18, Math.min(65535, v.getUint16(18, true) + 1024), true);
        destination.terrain = (destination.terrain & 0xf824) | 36; b[13] = 0;
      }
    }
  } else {
    if (tile >= 177 && tile < 188 && (b[13] > (feed >>> 1) || b[14] > (water >>> 1)) && (random.nextSimulation() & 127) === 5) {
      destination.terrain = (destination.terrain & 0xf8c0) | 192; result.notices.push(67);
    }
    b[4] = (b[4] + (random.nextSimulation() & 7)) & 7; b[5] = 8;
    origin.overlay = ((origin.overlay & 0xf800) | image()) & 65535; origin.terrain |= 0x800;
  }
  return result;
}
