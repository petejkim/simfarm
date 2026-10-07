import { Binary } from './binary';

/** 512 twelve-byte records at 2d9f:d5be, loaded by 0x45688..0x456d2. */
export class InventoryRecord {
  private readonly data: Binary;
  constructor(readonly slot: number, readonly bytes: Uint8Array) {
    if (bytes.length !== 12) throw new Error('Invalid inventory record size');
    this.data = new Binary(bytes);
  }
  get type(): number { return this.data.u16(0); }
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
  // SCEN6 declares 65 but contains 64 active items (SF-017). Iterate bounded records, not that count.
  if (items[0].active || data.u16(0x8281) > 511) throw new Error('Invalid inventory count');
  for (const item of items) if (item.active && (item.x >= 96 || item.y >= 96)) throw new Error('Invalid inventory position');
  return items;
}

export function readGoodsDefinitions(bytes: Uint8Array, seeds: boolean): GoodsDefinition[] {
  const data = new Binary(bytes), offset = seeds ? 0x20e38 : 0x20b0e, startType = seeds ? 192 : 128;
  return Array.from({ length: seeds ? 16 : 24 }, (_, i) => {
    const def = new GoodsDefinition(Uint8Array.from(data.slice(offset + i * 18, 18)));
    // Only sixteen of the twenty-four crop entries are populated.
    if (i < 16 && (def.type !== startType + i || (seeds && (def.width !== 1 || def.height !== 1)))) throw new Error('Invalid goods definition');
    return def;
  });
}
