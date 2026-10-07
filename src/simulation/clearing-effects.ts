import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';

export interface ClearingEffects {
  x: Uint8Array;
  y: Uint8Array;
  cursor: number;
  count: number;
  lastTick: number;
}

/** Native empty queue uses the source's free-slot sentinel (SF-060).
 * Runtime 2d9f:d53a/d57a, 6190:1eaa/1ea7/1ea8; not stored in SSM. */
export function createClearingEffects(): ClearingEffects {
  return { x: new Uint8Array(64).fill(255), y: new Uint8Array(64), cursor: 0, count: 0, lastTick: 0 };
}

export function validateClearingEffects(e: ClearingEffects, soilMoisture: number): void {
  if (e.x.length !== 64 || e.y.length !== 64 || !Number.isInteger(e.cursor) || e.cursor < 0 || e.cursor >= 64 ||
    !Number.isInteger(e.count) || e.count < 0 || e.count > 64 || !Number.isInteger(e.lastTick) || e.lastTick < 0 || e.lastTick > 65535 ||
    !Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid clearing effects');
  for (let i = 0; i < 64; i++) if (e.x[i] !== 255 && (e.x[i] >= 96 || e.y[i] >= 96)) throw new Error('Invalid clearing coordinate');
}
function restore(world: Scenario, x: number, y: number, moisture: number): void {
  const cell = world.cells[worldIndex(x, y)];
  const tile = cell.terrain & 0x3000 ? 55 : 15 + moisture + (cell.attribute >>> 2);
  cell.terrain = ((cell.terrain & 0xf800) | tile) & 65535;
}

/** 0xa2f6..0xa416: enqueue one tile and immediately restore the displaced slot. */
export function queueClearingEffect(world: Scenario, effects: ClearingEffects, x: number, y: number, soilMoisture: number): void {
  validateClearingEffects(effects, soilMoisture);
  const cell = world.cells[worldIndex(x, y)];
  const slot = (effects.cursor + 1) & 63;
  effects.cursor = slot; effects.count = Math.min(64, effects.count + 1);
  if (effects.x[slot] !== 255) restore(world, effects.x[slot], effects.y[slot], soilMoisture);
  cell.terrain = (cell.terrain & 0xfa98) | 0x298;
  effects.x[slot] = x; effects.y[slot] = y;
}

/** 0xa418..0xa5ba: each eligible tick advances images by two. Retain the
 * changing-count work limit, but bound the original unchecked scan (SF-061). */
export function updateClearingEffects(world: Scenario, effects: ClearingEffects, soilMoisture: number, animationTick: number): void {
  validateClearingEffects(effects, soilMoisture);
  if (!Number.isInteger(animationTick) || animationTick < 0 || animationTick > 65535) throw new Error('Invalid clearing tick');
  if (!effects.count || ((animationTick - effects.lastTick) & 65535) < 16) return;
  let visited = 0;
  for (let i = 0; i < 64 && visited <= effects.count; i++) {
    if (effects.x[i] === 255) continue;
    const x = effects.x[i], y = effects.y[i], cell = world.cells[worldIndex(x, y)], next = terrainTile(cell) + 1;
    if (next >= 664 && next < 672) {
      cell.terrain = (cell.terrain & 0xf800) | (next + 1);
      if (next === 670 && (cell.terrain & 0x3000)) restore(world, x, y, soilMoisture);
    } else if (next >= 672) {
      restore(world, x, y, soilMoisture); effects.x[i] = 255; effects.count = (effects.count - 1) & 255;
    }
    visited++;
  }
  effects.lastTick = animationTick;
}
