import { FieldRecord, validateFields } from './field';
import { EquipmentRecord, EquipmentDefinition, validateEquipment } from './equipment';
import { AnimalRecord, validateAnimals } from './animal';
import { BuildingRecord, BuildingDefinition, validateBuildings, validateBuildingDefinitions } from './building';
import { InventoryRecord, GoodsDefinition, validateInventory, validateGoodsDefinitions } from './inventory';
import { ChemicalRecord, validateChemicals, validateChemicalDefinitions } from './chemical';

/** Original loader offsets, counts and strides. Offsets document the source;
 * direct native decoding only reads the individually bounded tables. */
export const SCENARIO_TABLES = {
  fields: [0x45bd, 98, 68], equipment: [0x29f3, 127, 56], animals: [3, 256, 32],
  buildings: [0x5fc7, 127, 70], inventory: [0x8283, 512, 12], chemicals: [0x2005, 127, 20],
  equipmentDefinitions: [0x20994, 12, 18], buildingDefinitions: [0x20a6c, 9, 18],
  seedDefinitions: [0x20e38, 16, 18], cropDefinitions: [0x20b0e, 24, 18],
  harvestDefinitions: [0x20d18, 16, 18], chemicalDefinitions: [0x20f58, 4, 18],
} as const;
export type ScenarioTableBytes = { -readonly [K in keyof typeof SCENARIO_TABLES]: Uint8Array };

/** No SSM template, startup side effects or rewriting of unknown bytes. */
export function decodeScenarioRecords(raw: ScenarioTableBytes, cropCount = 16, equipmentCount: number = SCENARIO_TABLES.equipment[1]) {
  function table<T>(key: keyof ScenarioTableBytes, create: (bytes: Uint8Array, slot: number) => T): T[] {
    const [, originalCount, stride] = SCENARIO_TABLES[key], bytes = raw[key];
    const count = key === 'cropDefinitions' ? cropCount + 8 : key === 'seedDefinitions' || key === 'harvestDefinitions' ? cropCount : key === 'equipment' ? equipmentCount : originalCount;
    if (!(bytes instanceof Uint8Array) || bytes.length !== count * stride) throw new Error(`Invalid native ${key} table`);
    return Array.from({ length: count }, (_, slot) => create(bytes.slice(slot * stride, (slot + 1) * stride), slot));
  }
  const records = {
    fields: table('fields', (b, s) => new FieldRecord(s, b)),
    equipment: table('equipment', (b, s) => new EquipmentRecord(s, b)),
    animals: table('animals', (b, s) => new AnimalRecord(s, b)),
    buildings: table('buildings', (b, s) => new BuildingRecord(s, b)),
    inventory: table('inventory', (b, s) => new InventoryRecord(s, b)),
    chemicals: table('chemicals', (b, s) => new ChemicalRecord(s, b)),
    equipmentDefinitions: table('equipmentDefinitions', (b, s) => new EquipmentDefinition(s, b)),
    buildingDefinitions: table('buildingDefinitions', b => new BuildingDefinition(b)),
    seedDefinitions: table('seedDefinitions', b => new GoodsDefinition(b)),
    cropDefinitions: table('cropDefinitions', b => new GoodsDefinition(b)),
    harvestDefinitions: table('harvestDefinitions', b => new GoodsDefinition(b)),
    chemicalDefinitions: table('chemicalDefinitions', b => new GoodsDefinition(b)),
  };
  validateFields(records.fields, undefined, cropCount);
  validateEquipment(records.equipment, true);
  validateAnimals(records.animals);
  validateBuildingDefinitions(records.buildingDefinitions);
  validateBuildings(records.buildings, records.buildingDefinitions);
  validateInventory(records.inventory);
  validateGoodsDefinitions(records.seedDefinitions, true, cropCount);
  validateGoodsDefinitions(records.cropDefinitions, false, cropCount);
  validateGoodsDefinitions(records.harvestDefinitions, 'harvest', cropCount);
  validateChemicals(records.chemicals);
  validateChemicalDefinitions(records.chemicalDefinitions);
  for (const f of records.fields.filter(f => f.active)) {
    if (f.state > 9 || f.step > 16) throw new Error('Invalid native save: field work state');
    for (const slot of [f.equipment, f.pendingEquipment]) if (slot && !records.equipment[slot]?.active) throw new Error('Invalid native save: field equipment reference');
  }
  for (const def of records.equipmentDefinitions.slice(0, 9)) {
    if (def.type !== def.slot || ![40, 42, 44, 50, 52, 54, 71, 72, 82].includes(def.graphic) ||
      def.width < 1 || def.width > 4 || def.height < 1 || def.height > 4 || def.bytes[10] < 1 || def.bytes[10] > 4) throw new Error('Invalid native save: equipment definition');
  }
  // Field passes/attached implements may occupy byte-wrapped coordinates.
  // Harvest-truck +44 is a building, not another equipment slot.
  for (const e of records.equipment.filter(e => e.active)) {
    if (e.type === 7 && e.parent && !records.buildings[e.parent]?.active) throw new Error('Invalid native save: harvest truck storage reference');
    if (e.direction > 7 || e.targetX >= 96 || e.targetY >= 96) throw new Error('Invalid native save: equipment direction or destination');
    const attached = e.type !== 7 && e.parent !== 0;
    if (!attached && !(e.flags & 8) && (e.x >= 96 || e.y >= 96)) throw new Error('Invalid native save: equipment position');
    if (e.fieldSlot && !records.fields[e.fieldSlot]?.active) throw new Error('Invalid native save: equipment field reference');
  }
  return records;
}
