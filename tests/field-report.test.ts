import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FieldRecord } from '../src/formats/field';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { summarizeFieldStatus } from '../src/simulation/field-report';
import { GameSimulation } from './support/game';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const fields = () => Array.from({ length: 98 }, (_, slot) => new FieldRecord(slot, new Uint8Array(68)));
function set(field: FieldRecord, mask: number, active = true) {
  field.bytes[7] = active ? 1 : 0; field.bytes[54] = mask & 255; field.bytes[55] = mask >>> 8;
}

test('field aggregation source pins slot stride, active/status offsets, counters, cash thresholds and MIDI filenames', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x1f047, 'c746f80100'); exact(0x1f06c, '6b5ef844'); exact(0x1f070, '26f687392401'); exact(0x1f078, '268b876824');
  exact(0x1f08b, '26ff061efa'); exact(0x1f09a, '26ff061cfa'); exact(0x1f0ac, '2639063e3e');
  exact(0x1f127, '803e604504'); exact(0x1f13a, '26813e483e8813'); exact(0x1f152, '803e604501');
  exact(0x1f167, '26813e483e20a1'); exact(0x1f16e, '7609');
  assert.equal(e.subarray(0x846f0 + 0x454c, 0x846f0 + 0x4556).toString('ascii'), 'dfarm.xmi\0');
  assert.equal(e.subarray(0x846f0 + 0x4556, 0x846f0 + 0x4560).toString('ascii'), 'ffarm.xmi\0');
});

test('field reports bound all 97 usable slots, ignore inactive and sentinel records, retain high bits and do not change raw records', () => {
  const table = fields(); set(table[0], 0xffff); set(table[1], 0x8004); set(table[97], 0x8080); set(table[50], 0xffff, false);
  const before = table.map(f => Uint8Array.from(f.bytes));
  assert.deepEqual(summarizeFieldStatus(table, 50000), { activeFields: 2, statusMask: 0x8084,
    presence: [0, 0, 1, 0, 0, 0, 0, 1], distinctStatuses: 2, nutrientDeficientFields: 1,
    chemicallyStressedFields: 1, musicRequest: null });
  assert.deepEqual(table.map(f => f.bytes), before);
  for (const field of table.slice(1)) set(field, 0xffff);
  const full = summarizeFieldStatus(table, 0);
  assert.equal(full.activeFields, 97); assert.equal(full.nutrientDeficientFields, 97); assert.equal(full.chemicallyStressedFields, 97);
  assert.equal(full.distinctStatuses, 8); assert.equal(full.statusMask, 65535);
  assert.throws(() => summarizeFieldStatus(table.slice(1), 0), /field table/);
  const wrong = [...table]; wrong[97] = table[1]; assert.throws(() => summarizeFieldStatus(wrong, 0), /field table/);
});

test('MIDI requests use distinct low status bits and strict unsigned cash thresholds, not the number of affected fields', () => {
  const table = fields(); set(table[1], 0x0f);
  for (const cash of [0, 4999]) assert.equal(summarizeFieldStatus(table, cash).musicRequest, 'dfarm');
  for (const cash of [5000, 500000, 500001, 0xffffffff]) assert.equal(summarizeFieldStatus(table, cash).musicRequest, null);
  for (const field of table.slice(1)) set(field, 0xff01);
  assert.equal(summarizeFieldStatus(table, 4999).musicRequest, null);
  assert.equal(summarizeFieldStatus(table, 500000).musicRequest, null);
  for (const cash of [500001, 0xffffffff]) assert.equal(summarizeFieldStatus(table, cash).musicRequest, 'ffarm');
  set(table[97], 2); assert.equal(summarizeFieldStatus(table, 500001).musicRequest, null);
  for (const cash of [-1, 0x100000000, 0.5, NaN]) assert.throws(() => summarizeFieldStatus(table, cash), /cash/);
});

test('current farm reports use original sums and source field flags without rewriting saved report caches or owning UI state', () => {
  for (let id = 0; id < 8; id++) {
    const scenario = readScenario(source(`SCEN${id}.SSM`));
    const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
    const game = new GameSimulation(scenario, crops), before = game.save(id), report = game.getSnapshot().farmReport;
    assert.equal(report.fields.activeFields, scenario.fields.slice(1).filter(f => f.active).length);
    assert.equal(game.save(id), before);
    report.fields.presence.fill(99); report.fields.activeFields = 999; report.net = 1;
    const restored = GameSimulation.load(before, crops).simulation;
    assert.notEqual(restored.getSnapshot().farmReport.fields.activeFields, 999);
    assert.deepEqual(JSON.parse(restored.save(id)), JSON.parse(before));
  }
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const save = JSON.parse(new GameSimulation(scenario, crops).save(4)), f = save.runtime.finances, farm = save.scenario.farm;
  Object.assign(farm, { cropIncome: 1000, contractGains: 20, seedExpenses: 10, rentalExpenses: 20, landExpenses: 30,
    contractLosses: 40, workerExpenses: 4000, chemicalExpenses: 5000 });
  Object.assign(f.accounts, { landIncome: 50, equipmentExpenses: 50, taxExpenses: 60, balancePayments: 6000 });
  Object.assign(f.accounts.assets, { equipmentIncome: 30, livestockIncome: 40 });
  Object.assign(f.annual, { ds3e70: 60, priorTaxExpenses: 70, otherExpenses: 80, livestockExpenses: 90,
    ds3e8c: 100, ds3e90: 110, ds3e94: 120, ds3e9c: 130, reportIncome: 987, reportExpenses: 654, reportNet: 333 });
  const game = GameSimulation.load(JSON.stringify(save), crops).simulation;
  assert.deepEqual(Object.fromEntries(Object.entries(game.getSnapshot().farmReport).filter(([k]) => k !== 'fields')),
    { income: 1200, expenses: 9910, net: (-8710) >>> 0 });
  assert.equal(game.getSnapshot().finances.annual.reportNet, 333);
  assert.deepEqual(JSON.parse(game.save(4)).runtime.finances.annual, f.annual);
  game.dispatch({ type: 'borrow', amount: 1000 }); game.dispatch({ type: 'repay-loan' });
  assert.equal(game.getSnapshot().farmReport.net, (-8710) >>> 0); assert.equal(game.getSnapshot().finances.accounts.balancePayments, 7000);
});
