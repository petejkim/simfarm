import { cropBadgeTile } from '../formats/crop-slots';
import { Binary } from '../formats/binary';
import type { FieldRecord } from '../formats/field';
import { terrainTile, worldIndex, type WorldCell } from '../formats/scenario';

/** Original 2×2 field badge writer, file 0x196b8..0x19845. Position is a badge column. */
export function writeFieldBadge(field: FieldRecord, cells: WorldCell[], position: number, badge: number, cropBadge = false): void {
  const x = field.x + position * 2, y = field.y;
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const cell = cells[worldIndex(x + dx, y + dy)];
    // Erasure copies the two rows immediately below the badge, retaining destination flags.
    const tile = badge === -1 ? terrainTile(cells[worldIndex(x + dx, y + dy + 2)]) : cropBadge ? cropBadgeTile(badge, dy * 2 + dx) : 539 + badge * 4 + dy * 2 + dx;
    cell.terrain = (cell.terrain & 0xf800) | tile;
  }
}

/** File 0x19002..0x192e1. Besides drawing badges this updates the nutrient value used by growth. */
export function updateFieldStatus(field: FieldRecord, crop: readonly number[], cells: WorldCell[]): number {
  const b = field.bytes, f = new Binary(b);
  if (field.slot === 0 || f.u16(42) !== 0) return 0;
  f.view.setUint16(54, 0, true);
  for (const position of [1, 2, 3]) writeFieldBadge(field, cells, position, -1);
  if (field.state === 0) return 0;
  // These thresholds use signed BYTE arithmetic, unlike waterStress's word arithmetic.
  const lower = Math.max(0, (crop[40] - b[51] * 2) << 24 >> 24);
  const upper = ((crop[42] + b[52] * 2) << 24 >> 24) & 65535;
  const water = f.u16(24);
  if (water < lower) { writeFieldBadge(field, cells, 1, 19); b[54] |= 8; }
  else if (water > upper) { writeFieldBadge(field, cells, 1, 17); b[54] |= 2; }
  // 0x1c50a copies +29 into +28 and returns it, rather than averaging three nutrients.
  b[28] = b[29];
  if (b[28] < 128) { writeFieldBadge(field, cells, 2, 23); b[54] |= 0x80; }
  // Initialized DS:016b = 128 (file 0x8485b); no writer found in the executable.
  if (b[32] > 128) { writeFieldBadge(field, cells, 3, 18); b[54] |= 4; }
  const badges: number[] = [];
  if (b[22] > 52) { badges.push(21); b[54] |= 0x20; }
  if (b[20] > 52) { badges.push(16); b[54] |= 1; }
  if (b[21] > 52) { badges.push(20); b[54] |= 0x10; }
  let index = b[56];
  if (index > 2) throw new Error('Invalid field badge cycle');
  if (badges.length) {
    while (index >= badges.length) index = (index + 1) % 3;
    // Pest warnings overwrite the toxicity badge but retain its status flag.
    writeFieldBadge(field, cells, 3, badges[index]);
  }
  b[56] = (index + 1) % 3;
  return f.u16(54);
}
