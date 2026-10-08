import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import type { FarmRandom } from './random';

const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const shapes = [0, 0, 1, 2, 0, 0, 3, 4, 1, 5, 1, 6, 7, 8, 9, 10]; // DS59c4
const shores = [55, 51, 47, 49, 43, 57, 45, 65, 39, 53, 59, 67, 41, 61, 63, -1]; // DS23dc
type Connection = readonly [base: number, count: number, fixed: boolean];
// First four entries only, matching helpers0x24b54/0x24cf4 (SF-094).
const roads: readonly Connection[] = [[150, 11, false], [172, 2, true], [161, 11, false]];
const irrigation: readonly Connection[] = [[87, 11, false], [98, 11, false], [172, 2, true], [122, 4, true]];
const fences: readonly Connection[] = [[177, 11, false], [188, 4, true]];
const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < 96 && y < 96;
const between = (n: number, min: number, max: number) => n >= min && n <= max;

/** Manual terrain chain0x25f40..0x26222, not automatic tree clearing. */
export function removableTerrain(tile: number): boolean {
  return between(tile, 150, 171) || between(tile, 87, 108) || between(tile, 177, 193) || between(tile, 131, 146)
    || between(tile, 175, 176) || between(tile, 122, 125) || between(tile, 172, 173) || between(tile, 535, 538)
    || [73, 74, 113, 114].includes(tile);
}

/** 0x25398 with repaint=0: snapshot neighbor types, then N/E/S/W repairs.
 * A now-isolated neighbor (mask0) is deliberately not redrawn (SF-113). */
function repairNeighbors(world: Scenario, x: number, y: number, table: readonly Connection[]): void {
  const entry = (x: number, y: number) => inMap(x, y)
    ? table.find(([base, count]) => { const t = terrainTile(world.cells[worldIndex(x, y)]); return t >= base && t < base + count; }) : undefined;
  const mask = (x: number, y: number) => directions.reduce((bits, [dx, dy], i) => bits | (entry(x + dx, y + dy) ? 1 << i : 0), 0);
  const neighbors = directions.map(([dx, dy]) => entry(x + dx, y + dy));
  neighbors.forEach((definition, i) => {
    if (!definition || definition[2]) return;
    const [dx, dy] = directions[i], nx = x + dx, ny = y + dy, connections = mask(nx, ny);
    if (!connections) return;
    const cell = world.cells[worldIndex(nx, ny)]; cell.terrain = (cell.terrain & 0xf800) | (definition[0] + shapes[connections]);
  });
}

/** Water-neighbor mask0x16b3e: N/E/S/W use8/4/2/1; map edges count as water. */
function shoreMask(world: Scenario, x: number, y: number): number {
  return directions.reduce((bits, [dx, dy], i) => !inMap(x + dx, y + dy) || (world.cells[worldIndex(x + dx, y + dy)].terrain & 0x2000)
    ? bits : bits | (8 >>> i), 0);
}

/** Shore repair0x16d1c. Only mask15 expands to a3×3 scan; it necessarily
 * starts away from map edges. Recompute each mask after previous writes. */
function restoreShore(world: Scenario, x: number, y: number, random: FarmRandom): void {
  const paint = (x: number, y: number, mask: number) => {
    const c = world.cells[worldIndex(x, y)], t = terrainTile(c);
    const protectedTile = between(t, 120, 121) || between(t, 172, 173) || Boolean(c.overlay & 0x4000);
    if (mask === 15) {
      if (!protectedTile) c.terrain = (c.terrain & 0xf800) | 25;
    } else {
      if (!protectedTile) c.terrain = (c.terrain & 0xf800) | (shores[mask] + (random.nextVisual() & 1));
      c.terrain |= 0x2000;
    }
  };
  const mask = shoreMask(world, x, y);
  if (mask !== 15) { paint(x, y, mask); return; }
  for (let nx = x - 1; nx <= x + 1; nx++) for (let ny = y - 1; ny <= y + 1; ny++) paint(nx, ny, shoreMask(world, nx, ny));
}

/** Manual cleanup after affordability checks. No clearing queue for terrain.
 * Retains high bits, source shore RNG, bridge flags, and gate asymmetry. */
export function clearManualTerrain(world: Scenario, x: number, y: number, soilMoisture: number, random?: FarmRandom): void {
  const cell = world.cells[worldIndex(x, y)], tile = terrainTile(cell);
  const ground = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 65535;
  if ((ground & 0x3000) === 0x3000 && !random) throw new Error('Shoreline removal requires the original visual random stream');
  cell.terrain = ground;
  if ((cell.terrain & 0x3000) === 0x3000) {
    cell.terrain = (cell.terrain & 0xf800) | 55 | 0x3000;
    restoreShore(world, x, y, random!); return;
  }
  if (between(tile, 150, 171)) repairNeighbors(world, x, y, roads);
  else if (between(tile, 172, 173)) {
    repairNeighbors(world, x, y, roads); repairNeighbors(world, x, y, irrigation); cell.terrain &= ~0x2000;
  } else if (between(tile, 177, 187)) repairNeighbors(world, x, y, fences);
  else if (between(tile, 87, 108) || between(tile, 122, 125)) repairNeighbors(world, x, y, irrigation);
}
