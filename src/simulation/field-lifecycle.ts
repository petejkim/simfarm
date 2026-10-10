import { isCropStageTile } from '../formats/crop-slots';
import { Binary } from '../formats/binary';
import type { FieldRecord } from '../formats/field';
import { terrainTile, worldIndex, type WorldCell } from '../formats/scenario';
import { changeFieldCondition } from './field-conditions';
import { growField, type GrowthContext, type GrowthResult } from './field-growth';
import { updateFieldStatus } from './field-status';

/** Abandon/expiry cleanup, file 0x1c2a8..0x1c3f0. Sound and camera movement belong to the UI. */
export function clearFieldCrop(field: FieldRecord, crop: readonly number[], regions: Uint8Array, cells: WorldCell[]): void {
  if (field.state === 0) { changeFieldCondition(field, crop, regions, 1, 10); return; }
  if (field.state === 4) changeFieldCondition(field, crop, regions, 1, 70);
  field.bytes[2] = 0; field.bytes[3] = 0;
  new Binary(field.bytes).view.setUint16(18, 0, true);
  updateFieldStatus(field, crop, cells);
  for (let x = field.x; x < field.x + field.width; x++) for (let y = field.y; y < field.y + field.height; y++) {
    const cell = cells[worldIndex(x, y)], tile = terrainTile(cell);
    if (isCropStageTile(tile)) cell.terrain = (cell.terrain & 0xf822) | 0x22;
  }
}

/** The Growing branch of the work dispatcher, 0x1843c..0x1859a, including its stateful status update. */
export function updateGrowingField(field: FieldRecord, crop: readonly number[], context: GrowthContext): GrowthResult {
  if (!field.active || field.state !== 4 || field.bytes[33] !== context.week) return { updated: false, expired: false };
  updateFieldStatus(field, crop, context.cells);
  const result = growField(field, crop, context);
  if (result.expired) clearFieldCrop(field, crop, context.regions, context.cells);
  return result;
}
