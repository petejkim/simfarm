import { cropStageTile, isCropStageTile } from '../formats/crop-slots';
import { Binary } from '../formats/binary';
import type { FieldRecord } from '../formats/field';
import { terrainTile, worldIndex, type WorldCell } from '../formats/scenario';
import { changeFieldCondition } from './field-conditions';
import type { FarmRandom } from './random';

/** Water-stress contribution, file 0x195d0..0x196b7. Result deliberately wraps to a byte. */
export function waterStress(field: FieldRecord, definition: readonly number[], random: FarmRandom): number {
  const crop = new Binary(Uint8Array.from(definition)), f = new Binary(field.bytes);
  const lower = Math.max(0, crop.u16(40) - field.bytes[51] * 2), upper = crop.u16(42) + field.bytes[52] * 2;
  const water = f.u16(24) << 16 >> 16;
  if (water < lower) return (definition[71] * (random.nextSimulation() & 31) + 128) & 255;
  if (water >= upper) return (definition[70] * (random.nextSimulation() & 31) + 128) & 255;
  return 0;
}

export interface GrowthContext {
  week: number;
  temperature: number;
  regions: Uint8Array;
  cells: WorldCell[];
  random: FarmRandom;
}
export interface GrowthResult { updated: boolean; expired: boolean }

/** Growing-state arithmetic, 0x1843c..0x1859a and 0x192e2..0x195ce.
 * Status badges, expired-field cleanup and other work states belong to the caller's scheduler.
 */
export function growField(field: FieldRecord, definition: readonly number[], context: GrowthContext): GrowthResult {
  if (!field.active || field.state !== 4 || field.bytes[33] !== context.week) return { updated: false, expired: false };
  if (definition.length !== 128 || !definition[56] || !definition[66]) throw new Error('Invalid crop growth definition');
  // No distributed crop uses this optional bust/fine event (file 0xa7de). Avoid silently skipping it in custom files.
  if (definition[63] & 0x20) throw new Error('Crop fine event is not reconstructed yet');
  const crop = new Binary(Uint8Array.from(definition)), f = new Binary(field.bytes), b = field.bytes;
  if (crop.u16(30)) {
    let heat = Math.max(0, context.temperature - definition[67]) * 7;
    const deficit = f.u16(38), used = Math.min(deficit, heat);
    f.view.setUint16(38, deficit - used, true); heat -= used;
    if (crop.u16(30) > heat) f.view.setUint16(38, (f.u16(38) + crop.u16(30) - heat) & 65535, true);
  }
  if (crop.u16(28) && context.temperature < 45) f.view.setUint16(40, (f.u16(40) + 1) & 65535, true);
  b[33] = (b[33] + 1) & 3;
  const previousAge = b[34] << 24 >> 24; b[34]++;
  for (const [mode, amount] of [[13, definition[50]], [17, definition[51]], [15, definition[52]],
    [9, b[60]], [7, b[62]], [11, b[61]]]) changeFieldCondition(field, definition, context.regions, mode, amount);
  const rate = Math.floor(65535 / definition[56]) * 2;
  const stress = Math.floor((b[22] - b[28] + b[20] + b[21] + b[32] + 255 + waterStress(field, definition, context.random)) / 6);
  // Original uint32 multiplication, >>8 extraction and saturating uint16 accumulation at 0x1b7c6.
  const increment = Math.floor(((rate * stress) >>> 0) / 256) & 65535;
  f.view.setUint16(18, Math.min(65535, f.u16(18) + increment), true);
  if (previousAge >= definition[56]) return { updated: true, expired: definition[76] === 0 };
  const weeksPerStage = Math.ceil(definition[56] / definition[66]);
  const delayByte = crop.u16(30) ? Math.floor(f.u16(38) / (crop.u16(30) + 2)) & 255 : 0;
  const delay = delayByte << 24 >> 24;
  const age = b[34] << 24 >> 24;
  const stage = Math.trunc((age - delay + (weeksPerStage >> 1)) / weeksPerStage);
  const tile = cropStageTile(field.cropSlot, stage);
  f.view.setUint16(16, tile & 65535, true);
  for (let x = field.x; x < field.x + field.width; x++) for (let y = field.y; y < field.y + field.height; y++) {
    const cell = context.cells[worldIndex(x, y)], previousTile = terrainTile(cell);
    // Preserve badges, non-crop tiles and upper terrain flags.
    if (isCropStageTile(previousTile)) cell.terrain = (cell.terrain & 0xf800) | (tile & 65535);
  }
  return { updated: true, expired: false };
}
