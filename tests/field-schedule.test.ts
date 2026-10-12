import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readScenario, WORLD_OFFSET } from '../src/formats/scenario';
import { Binary } from '../src/formats/binary';
import { FieldSchedule, readFieldSchedule, describeScheduleEntry, FIELD_SCHEDULE_OFFSET,
  FIELD_SCHEDULE_SIZE, SCHEDULE_WEEKS, SCHEDULE_COLUMNS } from '../src/formats/field-schedule';
import { readCrop } from '../src/formats/crop';
import { GameSimulation } from './support/game';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));

test('schedule layout agrees with loader count, overlay access strides and tile tables in the original EXE', () => {
  const exe = source('SIMFARM.EXE');
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  assert.equal(exe.subarray(0x45765, 0x4576a).toString('hex'), '817ef0e05b'); // 23,520 words copied.
  assert.equal(exe.subarray(0x48b2d, 0x48b32).toString('hex'), '694e08c400'); // Week stride 196.
  assert.equal(exe.subarray(0x48b37, 0x48b3c).toString('hex'), '694e061003'); // Month stride 784.
  assert.equal(exe.subarray(0x48af0, 0x48af5).toString('hex'), '817efaf000'); // 240 rows.
  assert.equal(FIELD_SCHEDULE_OFFSET + FIELD_SCHEDULE_SIZE, WORLD_OFFSET);
  for (let slot = 0; slot < 16; slot++) assert.equal(exe.readUInt16LE(0x4ec60 + 0x882 + slot * 2), 688 + slot * 8);
  const alternate = [0x2f6eb, 0x2f6f0, 0x2f6f5].reduce((sum, offset) => {
    assert.equal(exe[offset], 0x2d); // SUB AX, imm16, applied cumulatively.
    return sum + exe.readUInt16LE(offset + 1);
  }, 0);
  assert.equal(alternate, exe.readUInt16LE(0x2e59b + 5));
  assert.deepEqual(describeScheduleEntry(alternate), { kind: 'alternate-harvest' });
});

test('all eight schedules preserve every original word, extra column and original planted/harvest weeks', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), schedule = readScenario(bytes).schedule;
    assert.deepEqual(schedule.bytes, Uint8Array.from(bytes.subarray(FIELD_SCHEDULE_OFFSET, WORLD_OFFSET)));
    for (let week = 0; week < SCHEDULE_WEEKS; week++) for (let column = 0; column < SCHEDULE_COLUMNS; column++) {
      assert.equal(schedule.get(week, column), bytes.readUInt16LE(FIELD_SCHEDULE_OFFSET + (week * 98 + column) * 2));
    }
    assert.equal(schedule.column(97).length, 240);
  }
  const s = readFieldSchedule(source('SCEN4.SSM'));
  assert.deepEqual([s.get(14, 0), s.get(15, 0), s.get(27, 0), s.get(28, 0)], [832, 688, 440, 832]);
  const grapes = readFieldSchedule(source('SCEN0.SSM'));
  assert.deepEqual([grapes.get(28, 0), grapes.get(36, 0), grapes.get(37, 0)], [833, 440, 696]);
});

test('schedule access is bounded and preserves unknown codes without conflating field slot with column', () => {
  assert.throws(() => new FieldSchedule(new Uint8Array(FIELD_SCHEDULE_SIZE - 1)));
  assert.throws(() => readFieldSchedule(new Uint8Array(WORLD_OFFSET - 1)));
  const sourceBytes = source('SCEN4.SSM'), s = readFieldSchedule(sourceBytes), before = Uint8Array.from(s.bytes);
  s.set(0, 0, 65535); s.set(239, 97, 54321);
  assert.equal(new Binary(s.bytes).u16(0), 65535);
  assert.equal(new Binary(s.bytes).u16(FIELD_SCHEDULE_SIZE - 2), 54321);
  assert.deepEqual(s.bytes.subarray(2, -2), before.subarray(2, -2));
  assert.deepEqual(sourceBytes, source('SCEN4.SSM'));
  for (const [week, col] of [[-1, 0], [240, 0], [0, -1], [0, 98], [NaN, 0], [0, 0.5]]) {
    assert.throws(() => s.get(week, col)); assert.throws(() => s.set(week, col, 209));
  }
  for (const value of [-1, 65536, NaN, 0.5]) assert.throws(() => s.set(0, 0, value));
  for (const value of [0, 1, 2, 3, 231, 65535]) assert.deepEqual(describeScheduleEntry(value), { kind: 'unknown', code: value });
  for (let slot = 0; slot < 16; slot++) {
    assert.deepEqual(describeScheduleEntry(832 + slot), { kind: 'plant', cropSlot: slot });
    for (let stage = 0; stage < 8; stage++) assert.deepEqual(describeScheduleEntry(688 + slot * 8 + stage), { kind: 'crop-stage', cropSlot: slot, stage });
  }
  for (const [code, kind] of [[198, 'contract'], [209, 'fallow'], [239, 'alternate-harvest'], [440, 'harvest'],
    [852, 'plow'], [912, 'fungicide'], [913, 'herbicide'], [914, 'pesticide'], [915, 'fertilizer']] as const) {
    assert.deepEqual(describeScheduleEntry(code), { kind });
  }
});

test('mutable schedules survive native checkpoints, detach from snapshots and migrate version-one saves', () => {
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  scenario.schedule.set(239, 97, 54321); scenario.schedule.set(16, 0, 915);
  const game = new GameSimulation(scenario, crops), text = game.save(4), data = JSON.parse(text);
  assert.equal(data.version, 28);
  scenario.schedule.bytes.fill(0); game.getSnapshot().scenario.schedule.bytes.fill(0);
  const loaded = GameSimulation.load(text, crops).simulation;
  assert.equal(loaded.getSnapshot().scenario.schedule.get(239, 97), 54321);
  assert.equal(loaded.getSnapshot().scenario.schedule.get(16, 0), 915);
  assert.deepEqual(JSON.parse(loaded.save(4)), JSON.parse(game.save(4)));
  const old = JSON.parse(text); old.version = 1; delete old.scenario.schedule;
  const migrated = GameSimulation.load(JSON.stringify(old), crops).simulation;
  assert.deepEqual(migrated.getSnapshot().scenario.schedule.bytes, readFieldSchedule(source('SCEN4.SSM')).bytes);
  delete data.scenario.schedule;
  assert.throws(() => GameSimulation.load(JSON.stringify(data), crops), /field schedule/);
  data.scenario.schedule = '00'; assert.throws(() => GameSimulation.load(JSON.stringify(data), crops), /field schedule/);
  // The order dispatcher is deliberately not connected until its forced-completion path is recovered.
  game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.schedule.get(16, 0), 915);
});
