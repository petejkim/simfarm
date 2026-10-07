import { Binary } from '../formats/binary';
import type { FieldRecord } from '../formats/field';

/** 0x1c1aa: unsigned 16.16 maturity, capped to a word and suppressed below one eighth.
 * Age and the low byte of the heat delay are signed chars in the original. */
export function cropMaturity(field: FieldRecord, definition: readonly number[]): number {
  if (field.state === 0) return 0;
  if (definition.length !== 128 || !definition[56]) throw new Error('Invalid harvest maturity definition');
  const crop = new Binary(Uint8Array.from(definition)), f = new Binary(field.bytes);
  const heat = crop.u16(30), divisor = (heat + 2) & 0xffff;
  if (heat && !divisor) throw new Error('Invalid harvest heat divisor');
  const delay = heat ? (Math.floor(f.u16(38) / divisor) & 255) << 24 >> 24 : 0;
  const age = field.bytes[34] << 24 >> 24;
  // SF-019: negative effective age wraps before the unsigned long division helper.
  const fraction = Math.min(65535, Math.floor(((age - delay) & 65535) * 65536 / definition[56]));
  return fraction < 8192 ? 0 : fraction;
}

/** 0x1c24e combines immaturity and accumulated stress (+18), saturating at 65535. */
export function harvestLoss(field: FieldRecord, definition: readonly number[]): number {
  return Math.min(65535, 65535 - cropMaturity(field, definition) + new Binary(field.bytes).u16(18));
}

/** 0x1c4aa. Quantity × price loses its high word BEFORE applying the loss fraction.
 * The crop-slot and extra word arguments in the DOS function are unused. */
export function harvestValue(quantity: number, loss: number, unitPrice: number): number {
  if (![quantity, loss, unitPrice].every(n => Number.isInteger(n) && n >= 0 && n <= 65535)) {
    throw new Error('Harvest value arguments must be unsigned words');
  }
  if (loss > 51000) return 0;
  return Math.floor(((quantity * unitPrice) & 65535) * (65535 - loss) / 65536);
}

/** 0x1c092: use the field's contract price if present, otherwise its crop trade price. */
export function fieldHarvestValue(field: FieldRecord, definition: readonly number[], marketPrice: number): number {
  if (field.state === 0) return 0;
  const crop = new Binary(Uint8Array.from(definition)), contract = new Binary(field.bytes).u16(48);
  return harvestValue(crop.u16(32), harvestLoss(field, definition), Math.floor((contract || marketPrice) / 10));
}
