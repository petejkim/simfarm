import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import type { TownConstructionState, TownLayouts } from '../formats/town';
import type { FarmRandom } from './random';
import { townStatistics, type TownSite } from './town';

// 6190:5696: paved 150..160, bridges 172..173 (connect but do not reshape),
// dirt 161..171. Shapes at 6190:59c4; mask is N/E/S/W.
const shapes = [0, 0, 1, 2, 0, 0, 3, 4, 1, 5, 1, 6, 7, 8, 9, 10];
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const inMap = (x: number, y: number) => x >= 0 && x < 96 && y >= 0 && y < 96;
function roadBase(world: Scenario, x: number, y: number): number | null {
  if (!inMap(x, y)) return null;
  const tile = terrainTile(world.cells[worldIndex(x, y)]);
  return tile >= 150 && tile < 161 ? 150 : tile >= 161 && tile < 172 ? 161 : tile >= 172 && tile < 174 ? 172 : null;
}
function roadMask(world: Scenario, x: number, y: number): number {
  let mask = 0;
  directions.forEach(([dx, dy], bit) => { if (roadBase(world, x + dx, y + dy) !== null) mask |= 1 << bit; });
  return mask;
}
/** Town specialization of 0x25398. Capture neighbor categories before drawing;
 * then reshape N/E/S/W in source order, retaining each road's own base/flags. */
export function connectTownRoad(world: Scenario, x: number, y: number): void {
  const cell = world.cells[worldIndex(x, y)];
  const neighbors = directions.map(([dx, dy]) => roadBase(world, x + dx, y + dy));
  cell.terrain = (cell.terrain & 0xf800) | (161 + shapes[roadMask(world, x, y)]);
  neighbors.forEach((base, i) => {
    if (base === null || base === 172) return;
    const [dx, dy] = directions[i], nx = x + dx, ny = y + dy;
    const neighbor = world.cells[worldIndex(nx, ny)];
    neighbor.terrain = (neighbor.terrain & 0xf800) | (base + shapes[roadMask(world, nx, ny)]);
  });
}

export type TownConstructionResult = { ok: true; type: number; site: TownSite }
  | { ok: false; reason: 'invalid-site' | 'invalid-type' | 'invalid-state' | 'recreation-limit' };
function validSite(site: TownSite): boolean {
  return [site.regionX, site.regionY].every(n => Number.isInteger(n) && n >= 0 && n < 12);
}
/** Original 0x3aba0..0x3ae18. District buildings appear through the later town
 * growth routine; ordinary construction clears non-road template cells to grass.
 * Only airport type 5 writes the complete template immediately. */
export function constructTownDistrict(world: Scenario, state: TownConstructionState, layouts: TownLayouts,
  site: TownSite, type: number): TownConstructionResult {
  if (!validSite(site)) return { ok: false, reason: 'invalid-site' };
  if (!Number.isInteger(type) || type < 0 || type > 14) return { ok: false, reason: 'invalid-type' };
  if (![state.airportCount, state.recreationCount].every(n => Number.isInteger(n) && n >= 0 && n <= 255) ||
    state.recreationCoordinates.length !== 16 || state.recreationCount > 7) return { ok: false, reason: 'invalid-state' };
  if (type === 4 && (state.recreationCount >= 7 || state.recreationCount * 16 >= townStatistics(world).regions)) {
    return { ok: false, reason: 'recreation-limit' };
  }
  const x = site.regionX * 8, y = site.regionY * 8;
  if (type === 0) { world.farm.townRegionX = site.regionX; world.farm.townRegionY = site.regionY; }
  if (type === 5) state.airportCount = (state.airportCount + 1) & 255;
  if (type === 4) {
    state.recreationCoordinates.set([x, y], state.recreationCount * 2);
    state.recreationCount++;
  }
  for (let dx = 0; dx < 8; dx++) for (let dy = 0; dy < 8; dy++) {
    const cell = world.cells[worldIndex(x + dx, y + dy)];
    if (![71, 72, 111, 112].includes(terrainTile(cell))) {
      const tile = layouts.tile(type, dx, dy);
      cell.terrain &= 0xcfff;
      if (type === 5) cell.terrain = (cell.terrain & 0xf800) | tile;
      else if (tile >= 161 && tile <= 172) connectTownRoad(world, x + dx, y + dy);
      else cell.terrain = 15 + (cell.attribute & 15);
    }
    cell.overlay |= 0x4000;
  }
  const region = (site.regionX * 12 + site.regionY) * 7;
  world.regionalConditions[region] = type === 0 || type === 5 ? type | 0xa0 : type;
  world.regionalConditions[region + 1] = 2;
  return { ok: true, type, site: { ...site } };
}

export type TownChoice = 'residential' | 'commercial' | 'airport' | 'recreational' | 'timeout';
/** Chooser 0x3c152/0x3c1c6/0x3c24a/0x3c2bc, timeout 0x3c385.
 * A failed recreational choice leaves the reserved plot pending. */
export function resolveTownChoice(world: Scenario, state: TownConstructionState, layouts: TownLayouts,
  site: TownSite, choice: TownChoice, random: FarmRandom): TownConstructionResult {
  if (!validSite(site) || world.regionalConditions[(site.regionX * 12 + site.regionY) * 7 + 1] !== 2) {
    return { ok: false, reason: 'invalid-site' };
  }
  let type: number;
  switch (choice) {
    case 'residential': type = (random.nextSimulation() & 7) + 6; break;
    case 'commercial': type = Math.min(3, (random.nextSimulation() & 3) + 1); break;
    case 'airport': type = 5; break;
    case 'recreational': type = 4; break;
    case 'timeout': type = random.below(14) + 1; break;
    default: return { ok: false, reason: 'invalid-type' };
  }
  return constructTownDistrict(world, state, layouts, site, type);
}
