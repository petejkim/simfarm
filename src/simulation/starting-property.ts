import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import type { HomesteadState } from '../formats/homestead';
import { fenceOwnedRegion } from './land';
import { updateHomestead } from './homestead';
import type { FarmRandom } from './random';
import type { TownSite } from './town';

export interface StartingLocations { town: TownSite; player: TownSite }
export type StartingLocationResult = { ok: true; locations: StartingLocations; attempts: number }
  | { ok: false; reason: 'no-reachable-location'; attempts: number };
type Map = Pick<Scenario, 'cells'>;
const validRegion = (n: number) => Number.isInteger(n) && n >= 0 && n < 12;

/** Region scan0x33e36 rejects water images39..68, independently of terrain flags. */
export function isDrySetupRegion(world: Map, regionX: number, regionY: number): boolean {
  if (!validRegion(regionX) || !validRegion(regionY)) return false;
  for (let x = regionX * 8; x < regionX * 8 + 8; x++) for (let y = regionY * 8; y < regionY * 8 + 8; y++) {
    const tile = terrainTile(world.cells[worldIndex(x, y)]);
    if (tile >= 39 && tile < 69) return false;
  }
  return true;
}

/** Chooser0x33aa6. Preserve branch-specific draw counts and 2x2 player checks.
 * Cycle detection bounds the original unending rejection loop (SF-142). */
export function selectStartingLocations(world: Map, random: Pick<FarmRandom, 'nextVisual' | 'snapshot'>): StartingLocationResult {
  if (world.cells.length !== 9216) throw new Error('Invalid starting map');
  const dry = Array.from({ length: 144 }, (_, i) => isDrySetupRegion(world, Math.floor(i / 12), i % 12));
  const clear = (x: number, y: number) => dry[x * 12 + y];
  const visited = new Set<number>();
  let attempts = 0;
  while (!visited.has(random.snapshot().visual)) {
    visited.add(random.snapshot().visual); attempts++;
    const side = random.nextVisual() & 3;
    let tx: number, ty: number, px: number, py: number;
    if (side === 0) {
      tx = (random.nextVisual() & 7) + 2; ty = 0;
      px = (random.nextVisual() & 7) + 2; py = (random.nextVisual() & 3) + 6;
    } else if (side === 1) {
      tx = 11 - (random.nextVisual() & 3); ty = (random.nextVisual() & 7) + 2;
      px = (random.nextVisual() & 3) + 1; py = (random.nextVisual() & 7) + 2;
    } else if (side === 2) {
      tx = (random.nextVisual() & 7) + 2; ty = 11 - (random.nextVisual() & 3);
      px = (random.nextVisual() & 7) + 2; py = random.nextVisual() & 3;
    } else {
      tx = 0; ty = (random.nextVisual() & 7) + 2;
      px = (random.nextVisual() & 3) + 6; py = (random.nextVisual() & 7) + 2;
    }
    if (clear(px, py) && clear(tx, ty) && clear(px + 1, py) && clear(px, py + 1) && clear(px + 1, py + 1)) {
      return { ok: true, locations: { town: { regionX: tx, regionY: ty }, player: { regionX: px, regionY: py } }, attempts };
    }
  }
  return { ok: false, reason: 'no-reachable-location', attempts };
}

/** Finalization0x40ef2..0x4102f: grant land before fencing, then rank0 homestead.
 * This is one initialization phase, not a full farm constructor or a purchase. */
export function initializeStartingProperty(world: Pick<Scenario, 'cells' | 'regionalConditions'>, player: TownSite): { cash: number; homestead: HomesteadState } {
  const { regionX, regionY } = player;
  if (world.cells.length !== 9216 || world.regionalConditions.length !== 1008 ||
    ![regionX, regionY].every(n => Number.isInteger(n) && n >= 0 && n <= 9)) throw new Error('Invalid starting property');
  for (let x = regionX; x < regionX + 3; x++) for (let y = regionY; y < regionY + 3; y++) {
    world.regionalConditions[(x * 12 + y) * 7 + 1] = 1;
  }
  for (let x = regionX * 8; x < regionX * 8 + 24; x++) for (let y = regionY * 8; y < regionY * 8 + 24; y++) {
    world.cells[worldIndex(x, y)].overlay |= 0x0800;
  }
  for (let x = regionX; x < regionX + 3; x++) for (let y = regionY; y < regionY + 3; y++) fenceOwnedRegion(world, x, y);
  const cash = 40000, homestead = { x: regionX * 8, y: regionY * 8, rank: 255 };
  updateHomestead(world.cells, homestead, cash);
  return { cash, homestead };
}
