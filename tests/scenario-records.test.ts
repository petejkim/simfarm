import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { SCENARIO_TABLES, decodeScenarioRecords, type ScenarioTableBytes } from '../src/formats/scenario-records';
import { readNewFarmRecordDefaults, createSetupRecords } from '../src/formats/new-farm-records';

const source = (name: string) => new Uint8Array(readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url)));
const keys = Object.keys(SCENARIO_TABLES) as (keyof ScenarioTableBytes)[];
const defaults = createSetupRecords(readNewFarmRecordDefaults(source('SIMFARM.EXE')));
function cold(): ScenarioTableBytes {
  const result = {} as ScenarioTableBytes;
  for (const key of keys) result[key] = Uint8Array.from(defaults[key].flatMap(r => [...r.bytes]));
  return result;
}
function word(raw: Uint8Array, offset: number, value: number) { new DataView(raw.buffer, raw.byteOffset, raw.byteLength).setUint16(offset, value, true); }
function active(raw: ScenarioTableBytes, key: 'fields' | 'equipment' | 'animals' | 'buildings' | 'inventory' | 'chemicals', slot = 1) {
  const [, , stride] = SCENARIO_TABLES[key], offset = slot * stride;
  raw[key][offset + (key === 'fields' ? 7 : key === 'inventory' ? 10 : 2)] |= key === 'fields' ? 1 : 32;
  return offset;
}

test('direct native tables retain every original byte across all eight farms and detached cold EXE records', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), original = readScenario(bytes), raw = {} as ScenarioTableBytes;
    for (const key of keys) { const [offset, count, stride] = SCENARIO_TABLES[key]; raw[key] = bytes.slice(offset, offset + count * stride); }
    const decoded = decodeScenarioRecords(raw);
    for (const key of keys) {
      assert.deepEqual(decoded[key].map(r => r.bytes), original[key].map(r => r.bytes));
      raw[key].fill(0); assert.deepEqual(decoded[key].map(r => r.bytes), original[key].map(r => r.bytes));
    }
    if (id === 6) { // SF-017 remains accepted without rewriting the preserved source count.
      assert.equal(new DataView(bytes.buffer).getUint16(0x8281, true), 65);
      assert.equal(decoded.inventory.filter(r => r.active).length, 64);
    }
  }
  // Only SIMFARM.EXE data, no source scenario, for this path.
  const raw = cold(), decoded = decodeScenarioRecords(raw);
  for (const key of keys) assert.deepEqual(decoded[key].map(r => r.bytes), defaults[key].map(r => r.bytes));
  decoded.fields[97].bytes[67] = 173; assert.equal(raw.fields.at(-1), 0);
});

test('every direct table enforces its binary boundary and retains inactive unknown bytes', () => {
  for (const key of keys) for (const delta of [-1, 1]) {
    const raw = cold(); raw[key] = new Uint8Array(raw[key].length + delta);
    assert.throws(() => decodeScenarioRecords(raw), new RegExp(key));
  }
  const raw = cold();
  for (const key of ['fields', 'equipment', 'animals', 'buildings', 'inventory', 'chemicals'] as const) raw[key].fill(255, raw[key].length - SCENARIO_TABLES[key][2]);
  // Disable the deliberately arbitrary last record, retaining all other bits.
  raw.fields[97 * 68 + 7] &= ~1; raw.equipment[126 * 56 + 2] &= ~32;
  raw.animals[255 * 32 + 2] &= ~32; raw.buildings[126 * 70 + 2] &= ~32;
  raw.inventory[511 * 12 + 10] &= ~32; raw.chemicals[126 * 20 + 2] &= ~32;
  raw.cropDefinitions.fill(255, 16 * 18); // Eight unused crop definitions also remain unnamed.
  const decoded = decodeScenarioRecords(raw);
  for (const key of keys) assert.deepEqual(Uint8Array.from(decoded[key].flatMap(r => [...r.bytes])), raw[key]);
});

test('reserved slots, active field geometry/crops and every definition restriction reject invalid tables', () => {
  for (const key of ['fields', 'equipment', 'animals', 'buildings', 'inventory', 'chemicals'] as const) {
    const raw = cold(); active(raw, key, 0); assert.throws(() => decodeScenarioRecords(raw), /count/);
  }
  const field = cold(), f = active(field, 'fields'); field.fields.set([95, 95, 1, 1, 15], f + 10);
  decodeScenarioRecords(field);
  for (const [offset, value] of [[10, 96], [11, 96], [12, 0], [13, 0], [12, 2], [13, 2], [14, 16], [2, 10], [3, 17]]) {
    const raw = structuredClone(field); raw.fields[f + offset] = value; assert.throws(() => decodeScenarioRecords(raw));
  }
  for (const [key, offset, value] of [
    ['equipmentDefinitions', 2, 9], ['equipmentDefinitions', 0, 255], ['equipmentDefinitions', 8, 0], ['equipmentDefinitions', 9, 5], ['equipmentDefinitions', 10, 0],
    ['buildingDefinitions', 2, 63], ['buildingDefinitions', 8, 5], ['buildingDefinitions', 9, 4],
    ['seedDefinitions', 2, 191], ['seedDefinitions', 8, 0], ['cropDefinitions', 2, 127],
    ['harvestDefinitions', 2, 167], ['harvestDefinitions', 0, 108], ['harvestDefinitions', 9, 2],
    ['chemicalDefinitions', 2, 219], ['chemicalDefinitions', 8, 2],
  ] as [keyof ScenarioTableBytes, number, number][]) {
    const raw = cold(); raw[key][offset] = value; assert.throws(() => decodeScenarioRecords(raw), /definition|graphic/);
  }
});

test('animal, building, inventory and chemical positions retain source bounds and type checks', () => {
  for (const key of ['animals', 'buildings', 'inventory', 'chemicals'] as const) {
    const raw = cold(), offset = active(raw, key), x = key === 'animals' ? 0 : key === 'buildings' ? 4 : key === 'inventory' ? 8 : 5;
    if (key === 'buildings') word(raw[key], offset, 64);
    if (key === 'chemicals') word(raw[key], offset, 220);
    decodeScenarioRecords(raw);
    for (const axis of [x, x + 1]) { const bad = structuredClone(raw); bad[key][offset + axis] = 96; assert.throws(() => decodeScenarioRecords(bad)); }
    if (key === 'buildings' || key === 'chemicals') {
      for (const type of key === 'buildings' ? [63, 73, 65535] : [219, 224, 65535]) {
        const bad = structuredClone(raw); word(bad[key], offset, type); assert.throws(() => decodeScenarioRecords(bad), /type/);
      }
    }
  }
});

test('equipment references distinguish attachment cycles, field work borders and harvest-truck storage', () => {
  const raw = cold(), e = active(raw, 'equipment'), f = active(raw, 'fields'), b = active(raw, 'buildings', 12);
  raw.fields.set([0, 0, 1, 1, 0], f + 10); word(raw.buildings, b, 64);
  word(raw.equipment, e, 7); word(raw.equipment, e + 44, 12); // No equipment12, but building12 exists.
  raw.equipment[e + 48] = 1; word(raw.fields, f + 42, 1); word(raw.fields, f + 44, 1);
  decodeScenarioRecords(raw);
  for (const [key, offset, value] of [
    ['equipment', e, 9], ['equipment', e + 15, 8], ['equipment', e + 7, 96], ['equipment', e + 8, 96], ['equipment', e + 5, 96],
    ['equipment', e + 44, 127], ['equipment', e + 48, 98], ['equipment', e + 48, 97],
    ['fields', f + 42, 126], ['fields', f + 44, 126],
  ] as [keyof ScenarioTableBytes, number, number][]) {
    const bad = structuredClone(raw); bad[key][offset] = value; assert.throws(() => decodeScenarioRecords(bad));
  }
  const pass = structuredClone(raw); pass.equipment[e + 2] |= 8; pass.equipment[e + 5] = pass.equipment[e + 6] = 255;
  decodeScenarioRecords(pass); // Original field traversal wraps at the map border.
  const chain = cold(); active(chain, 'equipment'); active(chain, 'equipment', 2);
  word(chain.equipment, 56 + 46, 2); word(chain.equipment, 112 + 44, 1);
  chain.equipment[112 + 5] = 255; decodeScenarioRecords(chain); // Attached implement may also wrap.
  for (const link of [1, 3, 127, 65535]) {
    const bad = structuredClone(chain); word(bad.equipment, 56 + 46, link); assert.throws(() => decodeScenarioRecords(bad), /attachment/);
  }
  word(chain.equipment, 112 + 46, 1); assert.throws(() => decodeScenarioRecords(chain), /cycle/);
});
