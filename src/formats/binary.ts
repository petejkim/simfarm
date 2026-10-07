/** Bounds-checked binary reader shared by import tools and browser loaders. */
export class Binary {
  readonly view: DataView;
  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  slice(offset: number, length: number): Uint8Array {
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > this.bytes.length) {
      throw new Error(`Binary range ${offset}+${length} exceeds ${this.bytes.length}`);
    }
    return this.bytes.subarray(offset, offset + length);
  }
  u16(offset: number): number { this.slice(offset, 2); return this.view.getUint16(offset, true); }
  u32(offset: number): number { this.slice(offset, 4); return this.view.getUint32(offset, true); }
  be32(offset: number): number { this.slice(offset, 4); return this.view.getUint32(offset); }
  text(offset: number, length: number): string {
    return String.fromCharCode(...this.slice(offset, length)).split('\0')[0];
  }
}
