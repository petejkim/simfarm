import type { SetupRecords } from '../formats/new-farm-records';
import { FieldSchedule } from '../formats/field-schedule';
import type { CropDefinition } from '../formats/crop';

/** Record/count reset0x403c6..0x40582 and planner scratch fill0x4092c..0x4094a.
 * Full gameplay/financial reset and town initialization are separate phases. */
export function resetSetupRecords(records: SetupRecords): void {
  for (const table of [records.animals, records.chemicals, records.equipment, records.buildings]) {
    for (const record of table) { record.bytes[2] = 0; record.bytes[3] = 0; }
  }
  for (const record of records.fields) { record.bytes[6] = 0; record.bytes[7] = 0; }
  for (const record of records.inventory) record.bytes[10] = 0;
  for (const table of [records.equipmentDefinitions, records.buildingDefinitions, records.cropDefinitions, records.animalDefinitions,
    records.harvestDefinitions, records.seedDefinitions, records.chemicalDefinitions, records.otherDefinitions]) {
    for (const definition of table) { definition.bytes[4] = 0; definition.bytes[5] = 0; }
  }
  for (let i = 0; i < records.plannerBuffer.length; i += 2) { records.plannerBuffer[i] = 209; records.plannerBuffer[i + 1] = 0; }
}

/** 0x48c9e writes the first1176 words of the scratch buffer twenty times. */
export function createSetupSchedule(plannerBuffer: Uint8Array): FieldSchedule {
  if (plannerBuffer.length !== 0xc00) throw new Error('Invalid setup planner buffer');
  const schedule = new Uint8Array(47040);
  for (let i = 0; i < 20; i++) schedule.set(plannerBuffer.subarray(0, 2352), i * 2352);
  return new FieldSchedule(schedule);
}

/** Crop loading0x466a4..0x4672f assigns prices and raw definition pointers.
 * Pointer words are preserved data references, never browser addresses. */
export function loadStartingCrops(records: SetupRecords, cropFiles: readonly string[], catalog: readonly CropDefinition[]): number[][] {
  if (cropFiles.length !== 16) throw new Error('Invalid starting crop count');
  const crops = cropFiles.map(file => {
    const crop = catalog.find(c => `${c.id}.crp` === file);
    if (!crop || crop.rawDefinition.length !== 128) throw new Error(`Missing starting crop ${file}`);
    return [...crop.rawDefinition];
  });
  crops.forEach((crop, slot) => {
    records.cropDefinitions[slot].price = crop[34] | crop[35] << 8;
    records.seedDefinitions[slot].price = Math.max(5, (crop[38] | crop[39] << 8) >>> 2);
    for (const table of [records.cropDefinitions, records.harvestDefinitions, records.seedDefinitions]) {
      const b = new DataView(table[slot].bytes.buffer, table[slot].bytes.byteOffset);
      b.setUint16(14, 0xc5ac + slot * 128, true); b.setUint16(16, 0x2d9f, true);
    }
  });
  return crops;
}
