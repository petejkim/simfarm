import { Binary } from './binary';
import { GoodsDefinition } from './inventory';

/** Runtime 3d9f:6400. Members recovered for collision and sale; retain other bytes. */
export class AnimalRecord {
  private readonly data: Binary;
  constructor(readonly slot: number, readonly bytes: Uint8Array) {
    if (bytes.length !== 32) throw new Error('Invalid animal record size');
    this.data = new Binary(bytes);
  }
  get x(): number { return this.bytes[0]; }
  get y(): number { return this.bytes[1]; }
  get type(): number { return this.data.u16(6); }
  get conditionByte(): number { return this.bytes[8]; }
  /** Word +10 contributes to valuation; its full lifecycle is not yet recovered. */
  get valuationWord(): number { return this.data.u16(10); }
  get buildingSlot(): number { return this.data.u16(16); }
  get flags(): number { return this.data.u16(2); }
  set flags(value: number) { this.data.view.setUint16(2, value, true); }
  get active(): boolean { return Boolean(this.flags & 0x20); }
  set deathTick(value: number) { this.data.view.setUint16(30, value, true); }
}

/** Loader 0x458e0..0x45909: five 18-byte records -> 6190:70e2.
 * The fifth source definition repeats type 163; preserve it verbatim. */
export function readAnimalDefinitions(bytes: Uint8Array): GoodsDefinition[] {
  const data = new Binary(bytes);
  return Array.from({ length: 5 }, (_, i) => new GoodsDefinition(Uint8Array.from(data.slice(0x20cbe + i * 18, 18))));
}

/** Loader 0x45536: count at SSM +1, 256 records at +3; slot zero is reserved. */
export function readAnimals(bytes: Uint8Array): AnimalRecord[] {
  const data = new Binary(bytes);
  const animals = Array.from({ length: 256 }, (_, slot) => new AnimalRecord(slot, Uint8Array.from(data.slice(3 + slot * 32, 32))));
  if (animals[0].active || animals.filter(a => a.active).length !== data.u16(1)) throw new Error('Invalid animal count');
  if (animals.some(a => a.active && (a.x >= 96 || a.y >= 96))) throw new Error('Invalid animal position');
  return animals;
}
