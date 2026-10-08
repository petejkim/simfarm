import { Binary } from '../formats/binary';
import type { BuildingRecord } from '../formats/building';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import type { FarmRandom } from './random';

function waterStores(world: Scenario): BuildingRecord[] {
  const stores = world.buildings.filter(b => b.slot > 0 && b.active && b.type === 72);
  if (stores.some(b => b.slot > 126 || b.x >= 96 || b.y >= 96)) throw new Error('Invalid water storage position');
  return stores;
}

export function storedWater(building: BuildingRecord): number {
  if (building.type !== 72) throw new Error('Not a water storage building');
  return new Binary(building.bytes).u16(10);
}

function setStoredWater(world: Scenario, b: BuildingRecord, amount: number): void {
  new Binary(b.bytes).view.setUint16(10, amount, true);
  // Source0xc508 /0x1a2b8 writes the raw interior image, not masked flags.
  if (b.flags & 1) world.cells[worldIndex(b.x, b.y)].terrain = 83 + (amount >>> 6);
}

/** Odd-day producer0xc364..0xc548. Ignore out-of-map neighbors (SF-103);
 * retain the source word-add-before-cap arithmetic (SF-104). */
export function fillWaterStorage(world: Scenario): void {
  for (const b of waterStores(world)) {
    if (b.bytes[6] === 255 || (b.flags & 64)) continue;
    const wet = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
      const x = b.x + dx, y = b.y + dy;
      if (x < 0 || x >= 96 || y < 0 || y >= 96) return false;
      const tile = terrainTile(world.cells[worldIndex(x, y)]);
      return tile >= 98 && tile < 109;
    });
    if (wet) setStoredWater(world, b, Math.min(255, (storedWater(b) + 50) & 65535));
  }
}

/** 0x1a244, used with64 by weekly empty-trough refill. Native partial
 * withdrawals preserve unused water instead of discarding it (SF-101). */
export function withdrawStoredWater(world: Scenario, requested: number): number {
  if (!Number.isInteger(requested) || requested < 0 || requested > 32767) throw new Error('Invalid stored water request');
  const stores = waterStores(world);
  let delivered = 0;
  for (const b of stores) {
    if (delivered === requested) break;
    const amount = storedWater(b), take = Math.min(amount, requested - delivered);
    if (!take) continue;
    setStoredWater(world, b, amount - take); delivered += take;
  }
  return delivered;
}

/** Weekly building phase0xc03a..0xc104, before inventory refills. Return
 * source notice44's building slots; the UI can show their persistent condition. */
export function ageBuildings(world: Scenario, random: FarmRandom): number[] {
  waterStores(world); // Prevalidate any possible water-loss/repaint before aging.
  const wornOut: number[] = [];
  for (const b of world.buildings) {
    if (!b.slot || !b.active || (b.flags & 2)) continue;
    const v = new Binary(b.bytes), age = (v.u16(8) + 1) & 65535;
    v.view.setUint16(8, age, true);
    b.bytes[6] = age < 1020 ? age >>> 2 : 255;
    if (b.type === 72 && age > 480 && (random.nextVisual() & 63) === 7) {
      b.bytes[6] = 255; v.view.setUint16(10, 0, true); b.flags |= 2;
      const cell = world.cells[worldIndex(b.x, b.y)];
      cell.terrain = (cell.terrain & 0xf800) | 149;
      wornOut.push(b.slot);
    }
  }
  return wornOut;
}
