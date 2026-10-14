import type { FieldRecord } from '../formats/field';

/** Mode IDs are the original 18-entry dispatch table at file 0x19c3c. */
export function changeFieldCondition(field: FieldRecord, crop: readonly number[], regions: Uint8Array, mode: number, amount: number): void {
  if (regions.length !== 12 * 12 * 7 || crop.length !== 128 || !Number.isInteger(amount) || amount < 0 || amount > 255) {
    throw new Error('Invalid field condition input');
  }
  const bytes = field.bytes;
  const region = ((field.x + (field.width >> 1)) >> 3) * 12 + ((field.y + (field.height >> 1)) >> 3);
  const add = (offset: number) => { bytes[offset] = Math.min(255, bytes[offset] + amount); };
  const subtract = (offset: number) => { bytes[offset] = Math.max(0, bytes[offset] - amount); };
  const changeRegion = (channel: number, increase: boolean) => {
    const index = region * 7 + channel;
    // SF-001: native reductions saturate; original reversed branches remain documented.
    regions[index] = increase ? Math.min(255, regions[index] + amount)
      : Math.max(0, regions[index] - amount);
  };
  switch (mode) {
    case 0: for (const m of [13, 17, 15]) changeFieldCondition(field, crop, regions, m, amount); break;
    case 1: for (const m of [12, 16, 14]) changeFieldCondition(field, crop, regions, m, amount); break;
    case 2: subtract(32); changeRegion(5, false); break;
    case 3: add(32); changeRegion(5, true); break;
    case 6: subtract(22); changeRegion(3, false); break;
    case 7: if (crop[60]) amount >>= 2; add(22); changeRegion(3, true); break;
    case 8: subtract(20); changeRegion(2, false); break;
    case 9: if (crop[58]) amount >>= 2; add(20); changeRegion(2, true); break;
    case 10: subtract(21); changeRegion(4, false); break;
    case 11: if (crop[59]) amount >>= 2; add(21); changeRegion(4, true); break;
    case 12: add(29); changeRegion(6, true); break;
    case 13: subtract(29); changeRegion(6, false); break;
    case 14: add(31); break;
    case 15: if (bytes[31] >= amount) bytes[31] -= amount; break;
    case 16: add(30); break;
    case 17: if (bytes[30] >= amount) bytes[30] -= amount; break;
    // 4/5 and out-of-range mode IDs deliberately do nothing in the original.
  }
}
