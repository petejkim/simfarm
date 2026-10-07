import { Binary } from './binary';

export const BUILDING_RECORDS_OFFSET = 0x5fc7;
export const BUILDING_DEFINITIONS_OFFSET = 0x20a6c;

/** Runtime 3d9f:8400; 4×3 storage cells use a fixed column stride of three. */
export class BuildingRecord {
  private readonly data: Binary;
  constructor(readonly slot: number, readonly bytes: Uint8Array) {
    if (bytes.length !== 70) throw new Error('Invalid building record size');
    this.data = new Binary(bytes);
  }
  get type(): number { return this.data.u16(0); }
  get flags(): number { return this.data.u16(2); }
  set flags(value: number) { this.data.view.setUint16(2, value, true); }
  get active(): boolean { return Boolean(this.flags & 0x20); }
  get x(): number { return this.bytes[4]; }
  get y(): number { return this.bytes[5]; }
  content(index: number): { graphic: number; type: number; slot: number } {
    if (!Number.isInteger(index) || index < 0 || index >= 12) throw new Error('Invalid building storage cell');
    return { graphic: this.data.u16(10 + index * 2), type: this.data.view.getInt16(34 + index * 2, true), slot: this.bytes[58 + index] };
  }
  clearContent(index: number): void {
    this.setContent(index, 217, -1, 0);
  }
  setContent(index: number, graphic: number, type: number, slot: number): void {
    this.content(index);
    this.data.view.setUint16(10 + index * 2, graphic, true);
    this.data.view.setInt16(34 + index * 2, type, true);
    this.bytes[58 + index] = slot;
  }
}

/** Saved definitions for item types 64..72 at runtime 6190:6e90. */
export class BuildingDefinition {
  private readonly data: Binary;
  constructor(readonly bytes: Uint8Array) {
    if (bytes.length !== 18) throw new Error('Invalid building definition size');
    this.data = new Binary(bytes);
  }
  get graphic(): number { return this.data.u16(0); }
  get type(): number { return this.data.u16(2); }
  get width(): number { return this.bytes[8]; }
  get height(): number { return this.bytes[9]; }
}

/** Loader 0x45645..0x45686 and 0x4588a..0x458b3. */
export function readBuildings(bytes: Uint8Array): BuildingRecord[] {
  const data = new Binary(bytes), definitions = readBuildingDefinitions(bytes);
  const buildings = Array.from({ length: 127 }, (_, slot) => new BuildingRecord(slot, Uint8Array.from(data.slice(BUILDING_RECORDS_OFFSET + slot * 70, 70))));
  if (buildings[0].active || buildings.filter(b => b.active).length !== data.u16(BUILDING_RECORDS_OFFSET - 2)) throw new Error('Invalid building count');
  for (const b of buildings.filter(b => b.active)) {
    const def = definitions[b.type - 64];
    if (!def || b.x + def.width > 96 || b.y + def.height > 96) throw new Error('Invalid building type or bounds');
  }
  return buildings;
}

export function readBuildingDefinitions(bytes: Uint8Array): BuildingDefinition[] {
  const data = new Binary(bytes);
  return Array.from({ length: 9 }, (_, i) => {
    const def = new BuildingDefinition(Uint8Array.from(data.slice(BUILDING_DEFINITIONS_OFFSET + i * 18, 18)));
    if (def.type !== 64 + i || def.width < 1 || def.width > 4 || def.height < 1 || def.height > 3) throw new Error('Invalid building definition');
    return def;
  });
}
