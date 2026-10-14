import { FieldRecord } from '../formats/field';
import { FieldSchedule } from '../formats/field-schedule';
import { EquipmentRecord, EquipmentDefinition, padEquipment, NATIVE_EQUIPMENT_SLOT_COUNT } from '../formats/equipment';
import { AnimalRecord } from '../formats/animal';
import { BuildingRecord, BuildingDefinition } from '../formats/building';
import { InventoryRecord, GoodsDefinition } from '../formats/inventory';
import { ChemicalRecord } from '../formats/chemical';
import type { Scenario } from '../formats/scenario';
import type { IrrigationState } from '../formats/irrigation';

function sameValues<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key]);
}
function sameBytes(a: Uint8Array, b?: Uint8Array): boolean {
  if (!b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function copyBytes(bytes: Uint8Array, previous?: Uint8Array): Uint8Array {
  return sameBytes(bytes, previous) ? previous! : Uint8Array.from(bytes);
}
/** Allocate an array only when a member or its length changes. Members returned by copy must be detached. */
function copyItems<T>(items: readonly T[], previous: T[] | undefined, copy: (item: T, prior?: T) => T): T[] {
  let result = previous?.length === items.length ? previous : undefined;
  for (let i = 0; i < items.length; i++) {
    const value = copy(items[i], previous?.[i]);
    if (!result) result = new Array<T>(items.length);
    else if (result === previous && value !== previous[i]) result = previous.slice();
    result[i] = value;
  }
  return result ?? [];
}
function copyRecords<T extends { bytes: Uint8Array; slot?: number }>(records: readonly T[], previous: T[] | undefined,
  create: (record: T, bytes: Uint8Array) => T): T[] {
  return copyItems(records, previous, (record, prior) => prior && record.constructor === prior.constructor &&
    record.slot === prior.slot && sameBytes(record.bytes, prior.bytes) ? prior : create(record, Uint8Array.from(record.bytes)));
}
function copyIrrigation(s: IrrigationState, previous?: IrrigationState): IrrigationState {
  const copy = { ...s, sources: copyBytes(s.sources, previous?.sources),
    flow: copyItems(s.flow, previous?.flow, (p, prior) => prior && sameValues(p, prior) ? prior : { ...p }) };
  return previous && sameValues(copy, previous) ? previous : copy;
}

/** Simulation keeps its mutable owner separate. UI views are read-only by convention: unchanged detached
 * members can be shared between snapshots, never with the owner. Compare actual bytes/values, including
 * unknown tails, so an accidentally edited view is repaired on publication without changing the game.
 * With no previous snapshot this makes a fully detached copy for a new simulation owner. */
export function copyScenario(s: Scenario, previous?: Scenario): Scenario {
  const equipment = copyRecords(s.equipment, previous?.equipment, (r, bytes) => new EquipmentRecord(r.slot, bytes));
  const calendar = previous && sameValues(s.farm.calendar, previous.farm.calendar) ? previous.farm.calendar : { ...s.farm.calendar };
  const farm = { ...s.farm, calendar };
  const climate = {
    wind: copyItems(s.climate.wind, previous?.climate.wind, (n, prior) => n === prior ? prior : n),
    precipitation: copyItems(s.climate.precipitation, previous?.climate.precipitation, (n, prior) => n === prior ? prior : n),
    temperature: copyItems(s.climate.temperature, previous?.climate.temperature, (n, prior) => n === prior ? prior : n),
  };
  const copy: Scenario = { ...s,
    irrigation: copyIrrigation(s.irrigation, previous?.irrigation),
    schedule: previous && sameBytes(s.schedule.bytes, previous.schedule.bytes) ? previous.schedule : new FieldSchedule(Uint8Array.from(s.schedule.bytes)),
    sourceBytes: s.sourceBytes === null ? null : copyBytes(s.sourceBytes, previous?.sourceBytes ?? undefined),
    cells: copyItems(s.cells, previous?.cells, (c, prior) => prior && c.terrain === prior.terrain && c.overlay === prior.overlay && c.attribute === prior.attribute ? prior : { ...c }),
    cropFiles: copyItems(s.cropFiles, previous?.cropFiles, (file, prior) => file === prior ? prior : file),
    fields: copyRecords(s.fields, previous?.fields, (r, bytes) => new FieldRecord(r.slot, bytes)),
    equipment: equipment.length === NATIVE_EQUIPMENT_SLOT_COUNT ? equipment : padEquipment(equipment),
    equipmentDefinitions: copyRecords(s.equipmentDefinitions, previous?.equipmentDefinitions, (r, bytes) => new EquipmentDefinition(r.slot, bytes)),
    animals: copyRecords(s.animals, previous?.animals, (r, bytes) => new AnimalRecord(r.slot, bytes)),
    buildings: copyRecords(s.buildings, previous?.buildings, (r, bytes) => new BuildingRecord(r.slot, bytes)),
    buildingDefinitions: copyRecords(s.buildingDefinitions, previous?.buildingDefinitions, (_, bytes) => new BuildingDefinition(bytes)),
    inventory: copyRecords(s.inventory, previous?.inventory, (r, bytes) => new InventoryRecord(r.slot, bytes)),
    chemicals: copyRecords(s.chemicals, previous?.chemicals, (r, bytes) => new ChemicalRecord(r.slot, bytes)),
    chemicalDefinitions: copyRecords(s.chemicalDefinitions, previous?.chemicalDefinitions, (_, bytes) => new GoodsDefinition(bytes)),
    seedDefinitions: copyRecords(s.seedDefinitions, previous?.seedDefinitions, (_, bytes) => new GoodsDefinition(bytes)),
    cropDefinitions: copyRecords(s.cropDefinitions, previous?.cropDefinitions, (_, bytes) => new GoodsDefinition(bytes)),
    harvestDefinitions: copyRecords(s.harvestDefinitions, previous?.harvestDefinitions, (_, bytes) => new GoodsDefinition(bytes)),
    farm: previous && sameValues(farm, previous.farm) ? previous.farm : farm,
    regionalConditions: copyBytes(s.regionalConditions, previous?.regionalConditions),
    climate: previous && sameValues(climate, previous.climate) ? previous.climate : climate,
  };
  return previous && sameValues(copy, previous) ? previous : copy;
}
