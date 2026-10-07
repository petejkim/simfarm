import { Binary } from './binary';

/** Runtime 3d9f:6400. Only members needed by equipment collision are named so far. */
export class AnimalRecord {
  private readonly data: Binary;
  constructor(readonly slot: number, readonly bytes: Uint8Array) {
    if (bytes.length !== 32) throw new Error('Invalid animal record size');
    this.data = new Binary(bytes);
  }
  get x(): number { return this.bytes[0]; }
  get y(): number { return this.bytes[1]; }
  get flags(): number { return this.data.u16(2); }
  set flags(value: number) { this.data.view.setUint16(2, value, true); }
  get active(): boolean { return Boolean(this.flags & 0x20); }
  set deathTick(value: number) { this.data.view.setUint16(30, value, true); }
}

/** Loader 0x45536: count at SSM +1, 256 records at +3; slot zero is reserved. */
export function readAnimals(bytes: Uint8Array): AnimalRecord[] {
  const data = new Binary(bytes);
  const animals = Array.from({ length: 256 }, (_, slot) => new AnimalRecord(slot, Uint8Array.from(data.slice(3 + slot * 32, 32))));
  if (animals[0].active || animals.filter(a => a.active).length !== data.u16(1)) throw new Error('Invalid animal count');
  if (animals.some(a => a.active && (a.x >= 96 || a.y >= 96))) throw new Error('Invalid animal position');
  return animals;
}
