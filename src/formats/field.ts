import { Binary } from './binary';
export const FIELD_RECORD_SIZE = 68;
export const FIELD_RECORDS_OFFSET = 0x45bd;
export const FIELD_SLOT_COUNT = 98;
export const FIELD_STATES = ['Waiting', 'Clearing', 'Plowing', 'Planting', 'Growing', 'Harvest', 'Fertilize', 'Pesticide', 'Herbicide', 'Fungicide'] as const;

/** Original 6190:2432 record. Unknown bytes are retained for subsequent reconstruction. */
export class FieldRecord {
  private readonly data: Binary;
  constructor(readonly slot: number, readonly bytes: Uint8Array) {
    if (bytes.length !== FIELD_RECORD_SIZE) throw new Error('Invalid field record size');
    this.data = new Binary(bytes);
  }
  get number(): number { return this.data.u16(0); }
  get state(): number { return this.bytes[2]; }
  get step(): number { return this.bytes[3]; }
  get active(): boolean { return Boolean(this.bytes[7] & 1); }
  get x(): number { return this.bytes[10]; }
  get y(): number { return this.bytes[11]; }
  get width(): number { return this.bytes[12]; }
  get height(): number { return this.bytes[13]; }
  get cropSlot(): number { return this.bytes[14]; }
  get status(): string { return FIELD_STATES[this.state] ?? `State ${this.state}`; }
  contains(x: number, y: number): boolean {
    // Original point query file 0x1b928: inclusive origin, exclusive far edge.
    return this.active && x >= this.x && x < this.x + this.width && y >= this.y && y < this.y + this.height;
  }
}
export function readFields(bytes: Uint8Array): FieldRecord[] {
  const data = new Binary(bytes), count = data.u16(FIELD_RECORDS_OFFSET - 2);
  const fields = Array.from({ length: FIELD_SLOT_COUNT }, (_, slot) => new FieldRecord(slot, Uint8Array.from(data.slice(FIELD_RECORDS_OFFSET + slot * FIELD_RECORD_SIZE, FIELD_RECORD_SIZE))));
  if (fields[0].active || fields.filter(f => f.active).length !== count) throw new Error('Invalid field count');
  for (const f of fields.filter(f => f.active)) {
    if (!f.width || !f.height || f.x + f.width > 96 || f.y + f.height > 96 || f.cropSlot >= 16) throw new Error('Invalid field bounds or crop slot');
  }
  return fields;
}
