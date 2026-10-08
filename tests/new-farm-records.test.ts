import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readNewFarmRecordDefaults, createSetupRecords } from '../src/formats/new-farm-records';
import { createSetupSchedule, loadStartingCrops, resetSetupRecords } from '../src/simulation/new-farm-records';
import { readCrop } from '../src/formats/crop';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const exe = source('SIMFARM.EXE'), defaults = readNewFarmRecordDefaults(exe);
const catalog = defaults.cropFiles.map(file => readCrop(file.slice(0, -4), source(`CROPS/${file.toUpperCase()}`)));

test('cold data and reset/planner/crop operations are pinned to source bytes', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x403d3, '26c78780730000ff46fe837efe047cec'); exact(0x40450, '26c78702640000ff46fe817efe00017ce9');
  exact(0x40544, '26c78738240000ff46fe837efe627ce8'); exact(0x40574, '26c687c8d500ff46fe817efe00027ce0');
  exact(0x4093b, '26c7870000d100ff46fe817efe00067ce6');
  exact(0x48cd7, '6898046a02688b2c6800009adc08840083c40cfe46fe807efe147cde');
  exact(0x466f6, '2689874a712689b74c718e06face2689876a722689b76c728e06f2ce268b85d2c5c1e8028e06face26898762723d0500730726c78762720500');
});

test('cold records match every initialized source byte without importing an SSM', () => {
  const layout = [
    ['animals', 0x66be0, 256, 32], ['chemicals', 0x5f59e, 127, 20], ['equipment', 0x6ae9a, 127, 56],
    ['fields', 0x86b22, 98, 68], ['buildings', 0x68be0, 127, 70], ['inventory', 0x5dd9e, 512, 12],
  ] as const;
  const state = createSetupRecords(defaults);
  for (const [key, offset, count, stride] of layout) {
    assert.equal(state[key].length, count);
    for (const record of state[key]) {
      assert.equal(record.active, false);
      assert.deepEqual(record.bytes, Uint8Array.from(exe.subarray(offset + record.slot * stride, offset + (record.slot + 1) * stride)));
    }
  }
  const defLayout = [['equipment', 0x6db8, 12], ['buildings', 0x6e90, 9], ['crops', 0x6f32, 24], ['animals', 0x70e2, 5],
    ['harvest', 0x713c, 16], ['seeds', 0x725c, 16], ['chemicals', 0x737c, 4], ['other', 0x73c4, 17]] as const;
  for (const [key, offset, count] of defLayout) {
    assert.equal(defaults.definitions[key].length, count);
    defaults.definitions[key].forEach((raw, i) => assert.deepEqual(raw, Array.from(exe.subarray(0x846f0 + offset + i * 18, 0x846f0 + offset + (i + 1) * 18))));
  }
  assert.ok(state.plannerBuffer.every(n => n === 0));
  state.animals[1].bytes.fill(199); assert.ok(defaults.records.animals[1].every(n => n === 0));
});

test('startup crop list preserves original slot order and every referenced CRP is present', () => {
  assert.deepEqual(defaults.cropFiles, ['corn.crp', 'wheat.crp', 'barley.crp', 'potatoes.crp', 'oats.crp', 'rice.crp', 'sorghum.crp', 'soybeans.crp',
    'cotton.crp', 'onions.crp', 'tomatoes.crp', 'lettuce.crp', 'carrots.crp', 'strawber.crp', 'sugar.crp', 'peanuts.crp']);
  assert.equal(catalog.length, 16); assert.ok(catalog.every(c => c.rawDefinition.length === 128));
  assert.throws(() => readNewFarmRecordDefaults(exe.subarray(0, -1)), /executable/);
  const bad = Buffer.from(exe); bad[0] = 0; assert.throws(() => readNewFarmRecordDefaults(bad), /executable/);
  bad.set(exe); bad[0x84770] = 47; assert.throws(() => readNewFarmRecordDefaults(bad), /filename/);
  const malformed = structuredClone(defaults); malformed.records.inventory.pop();
  assert.throws(() => createSetupRecords(malformed), /count/);
  malformed.records.inventory = defaults.records.inventory; malformed.records.animals[0][0] = 256;
  assert.throws(() => createSetupRecords(malformed), /bytes/);
});

test('warm record reset clears only source activity/count bytes while retaining unknown fields and unused slots', () => {
  const input = structuredClone(defaults);
  for (const table of Object.values(input.records)) for (const raw of table) raw.fill(0xab);
  for (const table of Object.values(input.definitions)) for (const raw of table) raw.fill(0xcd);
  const state = createSetupRecords(input); resetSetupRecords(state);
  for (const key of ['animals', 'chemicals', 'equipment', 'buildings', 'fields', 'inventory'] as const) {
    for (const record of state[key]) {
      const cleared = key === 'fields' ? [6, 7] : key === 'inventory' ? [10] : [2, 3];
      for (let i = 0; i < record.bytes.length; i++) assert.equal(record.bytes[i], cleared.includes(i) ? 0 : 0xab);
      assert.equal(record.active, false);
    }
  }
  for (const table of [state.equipmentDefinitions, state.buildingDefinitions, state.cropDefinitions, state.animalDefinitions,
    state.harvestDefinitions, state.seedDefinitions, state.chemicalDefinitions, state.otherDefinitions]) {
    for (const d of table) for (let i = 0; i < 18; i++) assert.equal(d.bytes[i], i === 4 || i === 5 ? 0 : 0xcd);
  }
  assert.ok(input.records.inventory[511].every(n => n === 0xab));
});

test('planner creation repeats exactly1176 words twenty times and respects retained versus reset scratch data', () => {
  const state = createSetupRecords(defaults), raw = state.plannerBuffer;
  for (let i = 0; i < 1536; i++) new DataView(raw.buffer).setUint16(i * 2, i + 1000, true);
  const schedule = createSetupSchedule(raw);
  for (let week = 0; week < 240; week++) for (let column = 0; column < 98; column++) assert.equal(schedule.get(week, column), 1000 + (week % 12) * 98 + column);
  raw.fill(0); assert.equal(schedule.get(239, 97), 2175);
  resetSetupRecords(state); const reset = createSetupSchedule(state.plannerBuffer);
  for (let week = 0; week < 240; week++) assert.ok(reset.column(week % 98).every(code => code === 209));
  const cold = createSetupSchedule(createSetupRecords(defaults).plannerBuffer); assert.ok(cold.bytes.every(n => n === 0));
  assert.throws(() => createSetupSchedule(raw.subarray(0, -1)), /buffer/);
});

test('starting crop loading preserves all other bytes and sets original prices, minimum seed prices and definition references', () => {
  const state = createSetupRecords(defaults), original = createSetupRecords(defaults), crops = loadStartingCrops(state, defaults.cropFiles, catalog);
  for (let i = 0; i < 16; i++) {
    assert.deepEqual(crops[i], catalog[i].rawDefinition);
    const definition = crops[i], price = definition[34] | definition[35] << 8;
    assert.equal(state.cropDefinitions[i].price, price);
    assert.equal(state.seedDefinitions[i].price, Math.max(5, (definition[38] | definition[39] << 8) >>> 2));
    for (const name of ['cropDefinitions', 'harvestDefinitions', 'seedDefinitions'] as const) {
      const raw = state[name][i].bytes, old = original[name][i].bytes;
      assert.equal(new DataView(raw.buffer).getUint16(14, true), 0xc5ac + i * 128);
      assert.equal(new DataView(raw.buffer).getUint16(16, true), 0x2d9f);
      for (let byte = 0; byte < 14; byte++) if (name === 'harvestDefinitions' || (byte !== 6 && byte !== 7)) assert.equal(raw[byte], old[byte]);
    }
  }
  for (let i = 16; i < 24; i++) assert.deepEqual(state.cropDefinitions[i].bytes, original.cropDefinitions[i].bytes);
  crops[0][0] ^= 255; assert.notEqual(crops[0][0], catalog[0].rawDefinition[0]);
  const low = structuredClone(catalog); low[0].rawDefinition[38] = 0; low[0].rawDefinition[39] = 0;
  loadStartingCrops(state, defaults.cropFiles, low); assert.equal(state.seedDefinitions[0].price, 5);
  const before = state.cropDefinitions.map(d => [...d.bytes]);
  assert.throws(() => loadStartingCrops(state, defaults.cropFiles, catalog.slice(0, -1)), /Missing/);
  assert.deepEqual(state.cropDefinitions.map(d => [...d.bytes]), before);
});
