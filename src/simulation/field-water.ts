import { Binary } from '../formats/binary';
import type { FieldRecord } from '../formats/field';
import { terrainTile, worldIndex, type WorldCell } from '../formats/scenario';

/** Field water and border tolerances, file 0x18d16..0x19001. */
export function updateFieldWater(field: FieldRecord, cells: WorldCell[], soilMoisture: number, disasterFlags: number): void {
  new Binary(field.bytes).view.setUint16(24, soilMoisture * 2 + (disasterFlags & 4 ? 5 : 0), true);
  field.bytes[51] = field.bytes[52] = 0;
  const count = (x: number, y: number) => {
    const tile = terrainTile(cells[worldIndex(x, y)]);
    // Original tile-base tables at 2be7:0906/0904 and lengths at :09f2/:09f1.
    if (tile >= 98 && tile < 109) field.bytes[51]++;
    if (tile >= 87 && tile < 98) field.bytes[52]++;
  };
  // Horizontal loop includes the far-right corner; vertical loop excludes the bottom row.
  for (let x = field.x; x <= field.x + field.width; x++) {
    count(x, field.y + field.height); count(x, field.y - 1);
  }
  for (let y = field.y; y < field.y + field.height; y++) {
    count(field.x + field.width, y); count(field.x - 1, y);
  }
}
