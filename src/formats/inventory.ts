import { Binary } from './binary';

/** 512 twelve-byte records at 2d9f:d5be, loaded by 0x45688..0x456d2. */
export class InventoryRecord {
  private readonly data: Binary;
  constructor(readonly slot: number, readonly bytes: Uint8Array) {
    if (bytes.length !== 12) throw new Error('Invalid inventory record size');
    this.data = new Binary(bytes);
  }
  get type(): number { return this.data.u16(0); }
  get quantity(): number { return this.data.u16(2); }
  get loss(): number { return this.data.u16(4); }
  get x(): number { return this.bytes[8]; }
  get y(): number { return this.bytes[9]; }
  get active(): boolean { return Boolean(this.bytes[10] & 0x20); }
}

/** Shared 18-byte goods definitions; preserve unnamed members, including DOS pointers. */
export class GoodsDefinition {
  private readonly data: Binary;
  constructor(readonly bytes: Uint8Array) {
    if (bytes.length !== 18) throw new Error('Invalid goods definition size');
    this.data = new Binary(bytes);
  }
  get type(): number { return this.data.u16(2); }
  get graphic(): number { return this.data.u16(0); }
  get count(): number { return this.data.u16(4); }
  set count(n: number) { this.data.view.setUint16(4, n, true); }
  get price(): number { return this.data.u16(6); }
  set price(n: number) { this.data.view.setUint16(6, n, true); }
  get width(): number { return this.bytes[8]; }
  get height(): number { return this.bytes[9]; }
}

export function readInventory(bytes: Uint8Array): InventoryRecord[] {
  const data = new Binary(bytes);
  const items = Array.from({ length: 512 }, (_, slot) => new InventoryRecord(slot, Uint8Array.from(data.slice(0x8283 + slot * 12, 12))));
  validateInventory(items, data.u16(0x8281));
  return items;
}

export function readGoodsDefinitions(bytes: Uint8Array, kind: boolean | 'harvest'): GoodsDefinition[] {
  const data = new Binary(bytes), offset = kind === 'harvest' ? 0x20d18 : kind ? 0x20e38 : 0x20b0e;
  const definitions = Array.from({ length: kind ? 16 : 24 }, (_, i) => new GoodsDefinition(Uint8Array.from(data.slice(offset + i * 18, 18))));
  validateGoodsDefinitions(definitions, kind);
  return definitions;
}

export function validateGoodsDefinitions(definitions: GoodsDefinition[], kind: boolean | 'harvest'): void {
  const startType = kind === 'harvest' ? 168 : kind ? 192 : 128;
  definitions.forEach((def, i) => {
    // Only sixteen of the twenty-four crop entries are populated.
    if (i < 16 && (def.type !== startType + i || (kind && (def.width !== 1 || def.height !== 1)))) throw new Error('Invalid goods definition');
    if (kind === 'harvest' && def.graphic !== 109 + i) throw new Error('Invalid harvested crop graphic');
  });
}

/** Loader 0x4598c..0x459b5: 17 records -> 6190:73c4. Types 299/300
 * have inventory records; retain the other types without naming their uses. */
export function readOtherGoodsDefinitions(bytes: Uint8Array): GoodsDefinition[] {
  const data = new Binary(bytes);
  return Array.from({ length: 17 }, (_, i) => {
    const d = new GoodsDefinition(Uint8Array.from(data.slice(0x20fa0 + i * 18, 18)));
    if (d.type !== 288 + i) throw new Error('Invalid additional goods definition');
    return d;
  });
}

export function validateInventory(items: InventoryRecord[], count = items.filter(i => i.active).length): void {
  // SCEN6 declares 65 but contains 64 active items (SF-017). Iterate bounded records, not that count.
  if (items[0].active || count > 511) throw new Error('Invalid inventory count');
  for (const item of items) if (item.active && (item.x >= 96 || item.y >= 96)) throw new Error('Invalid inventory position');
}
