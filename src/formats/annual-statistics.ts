import { Binary } from './binary';

export interface AnnualStatistics {
  /** Verified saved dwords; posting semantics remain unresolved. */
  ds3e58: number;
  ds3e5c: number;
  /** 6190:750d..7510, in original storage order. */
  regions: number[];
  /** Fourteen raw words 6190:444c..4466. Do not replace recurrences with guessed deltas. */
  words: number[];
  /** 6190:448e..4495 byte counters and :4560. Weekly field aggregation resets
   * these to presence bits; animal deaths can increment entry6 up to255. */
  fieldPresence: number[];
  distinctFieldStatuses: number;
  nutrientDeficientFields: number; // 2d9f:fa1c
  chemicallyStressedFields: number; // 2d9f:fa1e
}
export function validateAnnualStatistics(s: AnnualStatistics): void {
  const valid = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n <= max;
  if (![s.ds3e58, s.ds3e5c].every(n => valid(n, 0xffffffff)) ||
    !Array.isArray(s.regions) || s.regions.length !== 4 || !s.regions.every(n => valid(n, 255)) ||
    !Array.isArray(s.words) || s.words.length !== 14 || !s.words.every(n => valid(n, 65535)) ||
    !Array.isArray(s.fieldPresence) || s.fieldPresence.length !== 8 || !s.fieldPresence.every(n => valid(n, 255)) ||
    !valid(s.distinctFieldStatuses, 8) || !valid(s.nutrientDeficientFields, 65535) || !valid(s.chemicallyStressedFields, 65535)) {
    throw new Error('Invalid annual statistics');
  }
}
/** Saved reads 0x45ca6..0x45cd3. Remaining DS arrays are initialized zero in
 * this EXE; no SSM transfer found. Cold import does not invent prior history. */
export function readAnnualStatistics(bytes: Uint8Array): AnnualStatistics {
  const b = new Binary(bytes);
  return { ds3e58: b.u32(0x21684), ds3e5c: b.u32(0x21688), regions: [0, 0, 0, 0], words: Array(14).fill(0),
    fieldPresence: Array(8).fill(0), distinctFieldStatuses: 0, nutrientDeficientFields: 0, chemicallyStressedFields: 0 };
}
export function copyAnnualStatistics(s: AnnualStatistics): AnnualStatistics {
  return { ...s, regions: [...s.regions], words: [...s.words], fieldPresence: [...s.fieldPresence] };
}
