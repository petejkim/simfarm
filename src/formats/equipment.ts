import { Binary } from './binary';

export const EQUIPMENT_RECORDS_OFFSET = 0x29f3;
export const EQUIPMENT_RECORD_SIZE = 56;
export const EQUIPMENT_SLOT_COUNT = 127;
export const EQUIPMENT_DEFINITIONS_OFFSET = 0x20994;
export const EQUIPMENT_FLAGS = { reserved: 1, moving: 2, stored: 4, fieldWork: 8, active: 0x20, rented: 0x40, drawn: 0x80 } as const;

/** Runtime 3d9f:a6ba; unknown bytes remain available to subsequent reconstruction. */
export class EquipmentRecord {
  private readonly data: Binary;
  constructor(readonly slot: number, readonly bytes: Uint8Array) {
    if (bytes.length !== EQUIPMENT_RECORD_SIZE) throw new Error('Invalid equipment record size');
    this.data = new Binary(bytes);
  }
  get type(): number { return this.data.u16(0); }
  get flags(): number { return this.data.u16(2); }
  set flags(value: number) { this.data.view.setUint16(2, value, true); }
  get active(): boolean { return Boolean(this.flags & EQUIPMENT_FLAGS.active); }
  get x(): number { return this.bytes[5]; }
  get y(): number { return this.bytes[6]; }
  get targetX(): number { return this.bytes[7]; }
  get targetY(): number { return this.bytes[8]; }
  get direction(): number { return this.bytes[15]; }
  get condition(): number { return this.bytes[17]; }
  get timestamp(): number { return this.data.u16(30); }
  set timestamp(value: number) { this.data.view.setUint16(30, value, true); }
  get parent(): number { return this.data.u16(44); }
  set parent(value: number) { this.data.view.setUint16(44, value, true); }
  get attachment(): number { return this.data.u16(46); }
  set attachment(value: number) { this.data.view.setUint16(46, value, true); }
  get fieldSlot(): number { return this.bytes[48]; }
}

/** Runtime 6190:6db8. Count and price are saved values, not inferred shop economics. */
export class EquipmentDefinition {
  private readonly data: Binary;
  constructor(readonly slot: number, readonly bytes: Uint8Array) {
    if (bytes.length !== 18) throw new Error('Invalid equipment definition size');
    this.data = new Binary(bytes);
  }
  get graphic(): number { return this.data.u16(0); }
  get type(): number { return this.data.u16(2); }
  get ownedCount(): number { return this.data.u16(4); }
  set ownedCount(value: number) { this.data.view.setUint16(4, value, true); }
  get price(): number { return this.data.u16(6); }
  get width(): number { return this.bytes[8]; }
  get height(): number { return this.bytes[9]; }
}

/** Loader 0x455bf–0x45600, definitions 0x45864–0x45888. */
export function readEquipment(bytes: Uint8Array, nativeRuntime = false): EquipmentRecord[] {
  const data = new Binary(bytes);
  const records = Array.from({ length: EQUIPMENT_SLOT_COUNT }, (_, slot) => new EquipmentRecord(slot,
    Uint8Array.from(data.slice(EQUIPMENT_RECORDS_OFFSET + slot * EQUIPMENT_RECORD_SIZE, EQUIPMENT_RECORD_SIZE))));
  if (records[0].active || records.filter(e => e.active).length !== data.u16(EQUIPMENT_RECORDS_OFFSET - 2)) throw new Error('Invalid equipment count');
  for (const e of records.filter(e => e.active)) {
    if (e.type >= 9 || (!nativeRuntime && [e.x, e.y, e.targetX, e.targetY].some(v => v >= 96)) || e.fieldSlot >= 98) throw new Error('Invalid equipment type, coordinates or field');
    // Native harvest trucks overload +44 with a storage-building index (0x15f9a..0x1602f).
    // Validate that reference against buildings after the complete scenario is decoded.
    const links = nativeRuntime && e.type === 7 ? [e.attachment] : [e.parent, e.attachment];
    for (const link of links) {
      if (link && (link >= records.length || link === e.slot || !records[link].active)) throw new Error('Invalid equipment attachment');
    }
    const visited = new Set<number>([e.slot]);
    let link = e.attachment;
    while (link) {
      if (link >= records.length || visited.has(link)) throw new Error('Invalid equipment attachment cycle');
      visited.add(link); link = records[link].attachment;
    }
  }
  return records;
}

export function readEquipmentDefinitions(bytes: Uint8Array): EquipmentDefinition[] {
  const data = new Binary(bytes);
  return Array.from({ length: 12 }, (_, slot) => new EquipmentDefinition(slot,
    Uint8Array.from(data.slice(EQUIPMENT_DEFINITIONS_OFFSET + slot * 18, 18))));
}
