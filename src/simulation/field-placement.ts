import { Binary } from '../formats/binary';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { updateFieldStatus } from './field-status';

export type FieldPlacementResult = { ok: true; slot: number } | { ok: false;
  reason: 'outside-map' | 'not-owned' | 'blocked-terrain' | 'field-too-close' | 'no-field-slots' };

// 2be7 tile table at file 0x4ec60; automatic-clearing categories in 0x1bcf0..0x1bef8.
const clearable = [[15, 16], [535, 4], [177, 11], [161, 11], [150, 11], [87, 11], [98, 11], [122, 4], [131, 16]];

/** Original 8×8 placement wrapper 0x1bfa0 and validator 0x1bc68.
 * Native map bounds guard precedes the original unchecked rectangle reads. */
export function checkFieldPlacement(world: Scenario, x: number, y: number): FieldPlacementResult {
  if (![x, y].every(n => Number.isInteger(n) && n >= 0 && n <= 88)) return { ok: false, reason: 'outside-map' };
  for (let dx = 0; dx < 8; dx++) for (let dy = 0; dy < 8; dy++) {
    const cell = world.cells[worldIndex(x + dx, y + dy)], tile = terrainTile(cell);
    if (!(cell.overlay & 0x0800)) return { ok: false, reason: 'not-owned' };
    const allowed = world.farm.autoClear ? clearable.some(([base, count]) => tile >= base && tile < base + count) : tile >= 15 && tile < 31;
    if (!allowed || cell.terrain & 0x0800) return { ok: false, reason: 'blocked-terrain' };
  }
  // Original boundary probes use coordinate clamp 0xa298, inclusive one-tile border.
  for (let px = x - 1; px <= x + 8; px++) for (let py = y - 1; py <= y + 8; py++) {
    const cell = world.cells[worldIndex(Math.max(0, Math.min(95, px)), Math.max(0, Math.min(95, py)))];
    if (cell.overlay & 0x1000) return { ok: false, reason: 'field-too-close' };
  }
  const field = world.fields.find(f => f.slot > 0 && !f.active);
  return field ? { ok: true, slot: field.slot } : { ok: false, reason: 'no-field-slots' };
}

/** Constructor 0x1ba84..0x1bc32. Retain every member the source does not initialize. */
export function createField(world: Scenario, x: number, y: number): FieldPlacementResult {
  const result = checkFieldPlacement(world, x, y);
  if (!result.ok) return result;
  const field = world.fields[result.slot], b = field.bytes, f = new Binary(b);
  const count = world.fields.filter(f => f.active).length;
  for (const offset of [42, 6, 18, 36, 38, 48, 54, 64]) f.view.setUint16(offset, 0, true);
  f.view.setUint16(8, 0x180, true); f.view.setUint16(0, count + 1, true); f.view.setUint16(58, 500, true);
  for (const offset of [2, 3, 4, 5, 14, 32, 33, 34, 51, 52, 56, 57, 60, 61, 62]) b[offset] = 0;
  b[7] |= 1; b[10] = x; b[11] = y; b[12] = b[13] = 8; b[66] = b[67] = 255;
  const region = (((x + 4) >> 3) * 12 + ((y + 4) >> 3)) * 7;
  b[28] = b[29] = world.regionalConditions[region + 6]; b[30] = 65; b[31] = 80;
  b[20] = world.regionalConditions[region + 2]; b[21] = world.regionalConditions[region + 4]; b[22] = world.regionalConditions[region + 3];
  for (let dx = 0; dx < 8; dx++) for (let dy = 0; dy < 8; dy++) {
    const cell = world.cells[worldIndex(x + dx, y + dy)];
    cell.overlay |= 0x1000; cell.terrain = (cell.terrain & 0xf824) | 36;
  }
  updateFieldStatus(field, [], world.cells); // State Waiting only erases status badges.
  return result;
}
