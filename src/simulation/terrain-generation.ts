import { worldIndex, type Scenario } from '../formats/scenario';
import type { FarmRandom } from './random';
import type { TerrainRandom } from './terrain-random';
import { refreshShorelines } from './terrain-removal';

export type TerrainWorld = Pick<Scenario, 'cells' | 'regionalConditions'>;
export interface TerrainOptions { soilMoisture: number; river: boolean; lake: boolean }
const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < 96 && y < 96;
const clamp = (n: number) => Math.max(0, Math.min(95, n));

/** Source0x39c48 mirrors negatives, wraps only >96, and retains ==96 aliasing (SF-139). */
export function terrainHeightAt(world: Pick<Scenario, 'cells'>, x: number, y: number): number {
  const wrap = (n: number) => { if (n < 0) n = 96 - n; return n > 96 ? n - 96 : n; };
  const index = wrap(x) * 96 + wrap(y);
  // Map words are followed immediately by overlay words in original memory.
  const word = index < 9216 ? world.cells[index].terrain : world.cells[index - 9216].overlay;
  return (word - 15) & 15;
}

/** Five source interpolation passes0x39ca4/0x39e1e, with evolving x-major reads. */
export function generateTerrainHeights(world: Pick<Scenario, 'cells'>, random: Pick<TerrainRandom, 'inclusive'>): void {
  if (world.cells.length !== 9216) throw new Error('Invalid terrain map size');
  for (const cell of world.cells) { cell.terrain = 0; cell.overlay = 0; cell.attribute = 0; }
  for (const step of [16, 8, 4, 2, 1]) {
    const mask = step * 2 - 1;
    for (let x = 0; x < 96; x += step) for (let y = 0; y < 96; y += step) {
      const evenX = (x & mask) === 0, evenY = (y & mask) === 0;
      if (evenX && evenY) continue;
      const perturbation = random.inclusive(mask) - step;
      const h = (dx: number, dy: number) => terrainHeightAt(world, x + dx, y + dy);
      const average = evenY ? (h(step, 0) + h(-step, 0)) >> 1
        : evenX ? (h(0, -step) + h(0, step)) >> 1
          : (h(step, -step) + h(-step, -step) + h(step, step) + h(-step, step)) >> 2;
      world.cells[worldIndex(x, y)].terrain = 15 + Math.max(1, Math.min(15, average + perturbation));
    }
  }
}

/** Source0x40a82: tree chance7/16 on attributes>=10; rock chance2/16 on4..5.
 * Smooth attributes in-place y-major, then seed five region channels (SF-141). */
export function populateTerrain(world: TerrainWorld, soilMoisture: number, random: Pick<FarmRandom, 'nextVisual'>): void {
  if (world.cells.length !== 9216 || world.regionalConditions.length !== 1008) throw new Error('Invalid terrain dimensions');
  if (!Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid setup soil moisture');
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const cell = world.cells[worldIndex(x, y)];
    const attribute = cell.attribute = (cell.terrain - 15) & 15;
    //40ab7 sign-extends soil;40ae1..40afa adds/ORs/stores unsigned words.
    cell.terrain = ((cell.terrain & 0xf800) | (15 + soilMoisture + (attribute >> 2))) & 65535;
    if (attribute >= 10 && (random.nextVisual() & 15) < 7) cell.terrain = 131 + attribute;
    if (attribute > 3 && attribute < 6 && (random.nextVisual() & 15) < 2) cell.terrain = 535 + (random.nextVisual() & 3);
  }
  const attributeAt = (x: number, y: number) => world.cells[worldIndex(clamp(x), clamp(y))].attribute;
  for (let y = 1; y < 96; y++) for (let x = 1; x < 96; x++) {
    const sum = attributeAt(x - 1, y) + attributeAt(x + 1, y)
      + attributeAt(x - 1, y + 1) + attributeAt(x, y + 1) + attributeAt(x + 1, y + 1)
      + attributeAt(x - 1, y - 1) + attributeAt(x, y - 1) + attributeAt(x + 1, y - 1);
    world.cells[worldIndex(x, y)].attribute = (sum & 255) >>> 3;
  }
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) {
    const region = (x * 12 + y) * 7;
    world.regionalConditions[region + 4] = (random.nextVisual() & 15) << 2;
    world.regionalConditions[region + 3] = (random.nextVisual() & 15) << 2;
    world.regionalConditions[region + 2] = (random.nextVisual() & 15) << 2;
    // Original samples map(x,y), not map(x*8,y*8) and not a region average.
    const attribute = world.cells[worldIndex(x, y)].attribute;
    world.regionalConditions[region + 6] = attribute << 4;
    world.regionalConditions[region + 5] = attribute << 2;
  }
  for (const cell of world.cells) if ((cell.terrain & 2047) < 15) cell.terrain = (cell.terrain & 0xf800) | 15;
}

/** Water feature strokes0x3fea2..0x401f3. Clip the unchecked river brush (SF-140). */
export function addTerrainWater(world: Pick<Scenario, 'cells'>, options: Pick<TerrainOptions, 'river' | 'lake'>,
  random: Pick<FarmRandom, 'nextVisual' | 'below'>): void {
  const water = (x: number, y: number) => {
    if (!inMap(x, y)) return;
    const cell = world.cells[worldIndex(x, y)]; cell.terrain = 0x3000 | 55; cell.attribute = 1;
  };
  if (options.river) {
    const alongY = Boolean(random.nextVisual() & 1);
    let transverse = random.below(94);
    for (let distance = 0; distance < 96; distance++) {
      if (inMap(transverse, distance)) for (let width = 0; width < 3; width++) {
        water(alongY ? transverse + width : distance, alongY ? distance : transverse + width);
      }
      // Consume direction and magnitude even after the river leaves the map or on its last step.
      const increase = Boolean(random.nextVisual() & 1), amount = random.nextVisual() & 1;
      transverse += increase ? amount : -amount;
    }
  }
  if (options.lake) {
    const centerX = random.below(24) + random.below(48), centerY = random.below(24) + random.below(48);
    const radius = (random.nextVisual() & 7) + 4;
    let y = centerY;
    const row = (size: number) => {
      const jitter = random.nextVisual() & 3, width = jitter + size * 2 + 1;
      const start = (jitter >> 1) - (width >> 1) + centerX;
      for (let x = start; x < start + width; x++) {
        // Source checks centerY rather than y; valid setup ranges still keep y<96.
        if (inMap(x, centerY)) water(x, y);
      }
      y++;
    };
    for (let size = 0; size < radius; size++) row(size);
    for (let size = radius; size > 0; size--) row(size);
  }
}

/** Complete terrain-generation chain0x3fe1a. Starting ownership/records remain separate. */
export function generateFarmTerrain(regionalConditions: Uint8Array, options: TerrainOptions, random: FarmRandom, terrainRandom: TerrainRandom): TerrainWorld {
  if (regionalConditions.length !== 1008 || !Number.isInteger(options.soilMoisture) || options.soilMoisture < -128 || options.soilMoisture > 127 ||
    typeof options.river !== 'boolean' || typeof options.lake !== 'boolean') {
    throw new Error('Invalid terrain setup');
  }
  const world: TerrainWorld = { cells: Array.from({ length: 9216 }, () => ({ terrain: 0, overlay: 0, attribute: 0 })),
    regionalConditions: Uint8Array.from(regionalConditions) };
  generateTerrainHeights(world, terrainRandom);
  populateTerrain(world, options.soilMoisture, random);
  addTerrainWater(world, options, random);
  refreshShorelines(world, random);
  return world;
}
