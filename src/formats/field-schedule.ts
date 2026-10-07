import { Binary } from './binary';

export const FIELD_SCHEDULE_OFFSET = 0x9b04;
export const SCHEDULE_WEEKS = 240;
export const SCHEDULE_COLUMNS = 98;
export const FIELD_SCHEDULE_SIZE = SCHEDULE_WEEKS * SCHEDULE_COLUMNS * 2;

export type ScheduleEntry = { kind: 'plant'; cropSlot: number } | { kind: 'crop-stage'; cropSlot: number; stage: number }
  | { kind: 'harvest' | 'alternate-harvest' | 'fallow' | 'contract' | 'plow' | 'fertilizer' | 'pesticide' | 'herbicide' | 'fungicide' }
  | { kind: 'unknown'; code: number };

/** Dispatcher 0x2f66a..0x2fb12. Preserve unrecognized words, including zero, without inventing an action. */
export function describeScheduleEntry(code: number): ScheduleEntry {
  word(code);
  if (code >= 832 && code < 848) return { kind: 'plant', cropSlot: code - 832 };
  if (code >= 688 && code < 816) return { kind: 'crop-stage', cropSlot: (code - 688) >> 3, stage: (code - 688) & 7 };
  switch (code) {
    case 198: return { kind: 'contract' };
    case 209: return { kind: 'fallow' };
    case 239: return { kind: 'alternate-harvest' };
    case 440: return { kind: 'harvest' };
    case 852: return { kind: 'plow' };
    case 912: return { kind: 'fungicide' };
    case 913: return { kind: 'herbicide' };
    case 914: return { kind: 'pesticide' };
    case 915: return { kind: 'fertilizer' };
    default: return { kind: 'unknown', code };
  }
}
function word(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 65535) throw new Error('Invalid schedule word');
}
function index(week: number, column: number): number {
  if (!Number.isInteger(week) || week < 0 || week >= SCHEDULE_WEEKS ||
    !Number.isInteger(column) || column < 0 || column >= SCHEDULE_COLUMNS) throw new Error('Invalid schedule position');
  return (week * SCHEDULE_COLUMNS + column) * 2;
}

/** Week-major schedual.his image. Active field slot N uses column N-1; keep the extra 98th column.
 * Original get/set: overlay 25:044c/02a4, file 0x48b0c/0x48964. No work is dispatched here. */
export class FieldSchedule {
  private readonly data: Binary;
  constructor(readonly bytes: Uint8Array) {
    if (bytes.length !== FIELD_SCHEDULE_SIZE) throw new Error('Invalid field schedule size');
    this.data = new Binary(bytes);
  }
  get(week: number, column: number): number { return this.data.u16(index(week, column)); }
  set(week: number, column: number, code: number): void {
    word(code); this.data.view.setUint16(index(week, column), code, true);
  }
  /** Original column reader 0x48a7a traverses all 240 weeks using a 196-byte stride. */
  column(column: number): number[] {
    index(0, column);
    return Array.from({ length: SCHEDULE_WEEKS }, (_, week) => this.get(week, column));
  }
}
/** Loader 0x45734..0x4576a copies 0x5be0 little-endian words immediately before the map. */
export function readFieldSchedule(bytes: Uint8Array): FieldSchedule {
  return new FieldSchedule(Uint8Array.from(new Binary(bytes).slice(FIELD_SCHEDULE_OFFSET, FIELD_SCHEDULE_SIZE)));
}
