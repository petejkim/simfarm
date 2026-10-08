import { Binary } from './binary';
import { AnimalRecord } from './animal';
import { BuildingRecord, BuildingDefinition } from './building';
import { ChemicalRecord } from './chemical';
import { EquipmentRecord, EquipmentDefinition } from './equipment';
import { FieldRecord } from './field';
import { GoodsDefinition, InventoryRecord } from './inventory';

// Initialized data overlay29, load segment2be7. These are data slices, never executed.
const imageOffset = (segment: number, offset: number) => 0x4ec60 + (segment - 0x2be7) * 16 + offset;
const recordLayout = {
  animals: [0x3d9f, 0x6400, 256, 32], chemicals: [0x2d9f, 0xedbe, 127, 20],
  equipment: [0x3d9f, 0xa6ba, 127, 56], fields: [0x6190, 0x2432, 98, 68],
  buildings: [0x3d9f, 0x8400, 127, 70], inventory: [0x2d9f, 0xd5be, 512, 12],
} as const;
const definitionLayout = {
  equipment: [0x6db8, 12], buildings: [0x6e90, 9], crops: [0x6f32, 24], animals: [0x70e2, 5],
  harvest: [0x713c, 16], seeds: [0x725c, 16], chemicals: [0x737c, 4], other: [0x73c4, 17],
} as const;
export interface NewFarmRecordDefaults {
  cropFiles: string[];
  records: Record<keyof typeof recordLayout, number[][]>;
  definitions: Record<keyof typeof definitionLayout, number[][]>;
  plannerBuffer: number[];
  marketMood: number;
}

/** Exact cold data image, distinct from the partial in-process reset0x402a8. */
export function readNewFarmRecordDefaults(executable: Uint8Array): NewFarmRecordDefaults {
  const b = new Binary(executable);
  if (executable.length !== 0x917b9 || b.u16(0) !== 0x5a4d) throw new Error('Unsupported new-farm executable');
  const records = {} as NewFarmRecordDefaults['records'], definitions = {} as NewFarmRecordDefaults['definitions'];
  for (const key of Object.keys(recordLayout) as (keyof typeof recordLayout)[]) {
    const [segment, offset, count, stride] = recordLayout[key];
    records[key] = Array.from({ length: count }, (_, slot) => Array.from(b.slice(imageOffset(segment, offset + slot * stride), stride)));
  }
  for (const key of Object.keys(definitionLayout) as (keyof typeof definitionLayout)[]) {
    const [offset, count] = definitionLayout[key];
    definitions[key] = Array.from({ length: count }, (_, slot) => Array.from(b.slice(imageOffset(0x6190, offset + slot * 18), 18)));
  }
  // Main0x23a2..0x249f loads these sixteen literal filenames in this exact order.
  const offsets = [0x80, 0x89, 0x93, 0x9e, 0xab, 0xb4, 0xbd, 0xc9, 0xd6, 0xe1, 0xec, 0xf9, 0x105, 0x111, 0x11e, 0x128];
  const cropFiles = offsets.map(offset => b.text(imageOffset(0x6190, offset), 14));
  if (cropFiles.some(name => !/^[a-z0-9_]{1,8}\.crp$/.test(name))) throw new Error('Invalid starting crop filename');
  return { records, definitions, cropFiles, plannerBuffer: Array.from(b.slice(imageOffset(0x2c8b, 0), 0xc00)),
    marketMood: b.slice(imageOffset(0x6190, 0xbc66), 1)[0] };
}

function bytes(raw: number[], size: number): Uint8Array {
  if (!Array.isArray(raw) || raw.length !== size || raw.some(n => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error('Invalid starting record bytes');
  return Uint8Array.from(raw);
}

/** Detached native views; unused fields and original pointer words remain intact. */
export function createSetupRecords(defaults: NewFarmRecordDefaults) {
  const records = <T>(key: keyof typeof recordLayout, make: (slot: number, b: Uint8Array) => T) => {
    const [, , count, stride] = recordLayout[key], table = defaults.records[key];
    if (table.length !== count) throw new Error('Invalid starting record count');
    return table.map((raw, slot) => make(slot, bytes(raw, stride)));
  };
  const definitions = <T>(key: keyof typeof definitionLayout, make: (slot: number, b: Uint8Array) => T) => {
    const table = defaults.definitions[key];
    if (table.length !== definitionLayout[key][1]) throw new Error('Invalid starting definition count');
    return table.map((raw, slot) => make(slot, bytes(raw, 18)));
  };
  const goods = (_slot: number, raw: Uint8Array) => new GoodsDefinition(raw);
  return {
    animals: records('animals', (i, b) => new AnimalRecord(i, b)), chemicals: records('chemicals', (i, b) => new ChemicalRecord(i, b)),
    equipment: records('equipment', (i, b) => new EquipmentRecord(i, b)), fields: records('fields', (i, b) => new FieldRecord(i, b)),
    buildings: records('buildings', (i, b) => new BuildingRecord(i, b)), inventory: records('inventory', (i, b) => new InventoryRecord(i, b)),
    equipmentDefinitions: definitions('equipment', (i, b) => new EquipmentDefinition(i, b)),
    buildingDefinitions: definitions('buildings', (_i, b) => new BuildingDefinition(b)),
    cropDefinitions: definitions('crops', goods), animalDefinitions: definitions('animals', goods),
    harvestDefinitions: definitions('harvest', goods), seedDefinitions: definitions('seeds', goods),
    chemicalDefinitions: definitions('chemicals', goods), otherDefinitions: definitions('other', goods),
    plannerBuffer: bytes(defaults.plannerBuffer, 0xc00),
    marketMood: bytes([defaults.marketMood], 1)[0],
  };
}
export type SetupRecords = ReturnType<typeof createSetupRecords>;
