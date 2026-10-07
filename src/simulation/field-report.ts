import { FIELD_SLOT_COUNT, type FieldRecord } from '../formats/field';

export interface FieldReport {
  activeFields: number;
  /** Preserve the full word even though the source presence table uses only eight bits. */
  statusMask: number;
  presence: number[];
  distinctStatuses: number;
  nutrientDeficientFields: number;
  chemicallyStressedFields: number;
  musicRequest: 'dfarm' | 'ffarm' | null;
}

/** Aggregate 0x1f020..0x1f17a. Field status word is +54; this does not
 * recompute field badges, change nutrients or consume RNG. SF-077: iterate
 * real slots 1..97 once instead of trusting the declared active count. */
export function summarizeFieldStatus(fields: readonly FieldRecord[], cash: number): FieldReport {
  if (fields.length !== FIELD_SLOT_COUNT || fields.some((f, slot) => f.slot !== slot || f.bytes.length !== 68)) {
    throw new Error('Invalid report field table');
  }
  if (!Number.isInteger(cash) || cash < 0 || cash > 0xffffffff) throw new Error('Invalid report cash');
  let statusMask = 0, activeFields = 0, nutrientDeficientFields = 0, chemicallyStressedFields = 0;
  for (const field of fields.slice(1)) {
    if (!field.active) continue;
    activeFields++;
    const status = field.bytes[54] | field.bytes[55] << 8;
    statusMask |= status;
    if (status & 4) chemicallyStressedFields++;
    if (status & 128) nutrientDeficientFields++;
  }
  const presence = Array.from({ length: 8 }, (_, bit) => (statusMask >>> bit) & 1);
  const distinctStatuses = presence.reduce((sum, n) => sum + n, 0);
  return { activeFields, statusMask, presence, distinctStatuses, nutrientDeficientFields, chemicallyStressedFields,
    musicRequest: distinctStatuses >= 4 && cash < 5000 ? 'dfarm'
      : distinctStatuses <= 1 && cash > 500000 ? 'ffarm' : null };
}
