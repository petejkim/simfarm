import { Binary } from './binary';
import { GoodsDefinition } from './inventory';

export const CHEMICAL_RECORDS_OFFSET = 0x2005;
export const CHEMICAL_DEFINITIONS_OFFSET = 0x20f58;

/** 127 twenty-byte records at 2d9f:edbe; loader 0x4557c..0x455bd. */
export class ChemicalRecord {
  private readonly data: Binary;
  constructor(readonly slot: number, readonly bytes: Uint8Array) {
    if (bytes.length !== 20) throw new Error('Invalid chemical record size');
    this.data = new Binary(bytes);
  }
  get type(): number { return this.data.u16(0); }
  get active(): boolean { return Boolean(this.bytes[2] & 32); }
  get x(): number { return this.bytes[5]; }
  get y(): number { return this.bytes[6]; }
}

export function readChemicals(bytes: Uint8Array): ChemicalRecord[] {
  const b = new Binary(bytes);
  const records = Array.from({ length: 127 }, (_, slot) => new ChemicalRecord(slot,
    Uint8Array.from(b.slice(CHEMICAL_RECORDS_OFFSET + slot * 20, 20))));
  validateChemicals(records, b.u16(CHEMICAL_RECORDS_OFFSET - 2));
  return records;
}

/** Four eighteen-byte definitions at 6190:737c; loader 0x45966..0x4598a. */
export function readChemicalDefinitions(bytes: Uint8Array): GoodsDefinition[] {
  const b = new Binary(bytes);
  const definitions = Array.from({ length: 4 }, (_, i) => new GoodsDefinition(Uint8Array.from(b.slice(CHEMICAL_DEFINITIONS_OFFSET + i * 18, 18))));
  validateChemicalDefinitions(definitions);
  return definitions;
}

export function validateChemicals(records: ChemicalRecord[], count = records.filter(r => r.active).length): void {
  if (records[0].active || records.filter(r => r.active).length !== count) throw new Error('Invalid chemical count');
  for (const r of records) if (r.active && (r.type < 220 || r.type > 223 || r.x >= 96 || r.y >= 96)) throw new Error('Invalid chemical type or position');
}

export function validateChemicalDefinitions(definitions: GoodsDefinition[]): void {
  definitions.forEach((d, i) => {
    if (d.type !== 220 + i || d.width !== 1 || d.height !== 1) throw new Error('Invalid chemical definition');
  });
}
