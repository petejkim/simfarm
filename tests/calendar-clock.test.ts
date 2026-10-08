import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { transferCalendarPhase } from '../src/simulation/calendar-clock';
import { GameSimulation } from '../src/simulation/game';
import { readScenario } from '../src/formats/scenario';
import { newFarmAssets } from './support/new-farm';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));

test('calendar gate and timestamp stores use the animation counter rather than the machinery counter', () => {
  const exe = source('SIMFARM.EXE');
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0xc8a9, '26a1a0132b068e1f3b068c1f7703'); exact(0xd175, '26a1a013a38e1f');
  exact(0x14a4c, '26a19e13'); // Equipment dispatcher uses the other word.
  exact(0x45fe3, '68a013'); exact(0x45ffb, '689e13'); // Separate loader destinations.
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`);
    // These equal source values explain why supplied-file-only fixtures hid the error.
    assert.equal(bytes.readUInt16LE(0x216f7), bytes.readUInt16LE(0x216f9));
  }
});

test('calendar phase transfers preserve the old timestamp through zero reset, rewind and unsigned word boundaries', () => {
  const cases = [
    [1000, 17, 2000, 1017], [60000, 17, 0, 5553], [5, 17, 0, 12],
    [65535, 0, 0, 1], [0, 65535, 0, 65535], [0, 0, 65535, 65535], [65535, 65535, 65535, 65535],
  ];
  for (const [old, phase, next, expected] of cases) assert.equal(transferCalendarPhase(old, phase, next), expected);
  for (const old of [0, 1, 32767, 32768, 65534, 65535]) for (const phase of [0, 1, 255, 256, 65535]) {
    assert.equal(transferCalendarPhase(old, phase, old), phase);
    const moved = transferCalendarPhase(old, phase, 1234);
    assert.equal(transferCalendarPhase(1234, moved, old), phase);
  }
  for (const invalid of [-1, 65536, 0.5, NaN, Infinity]) for (let slot = 0; slot < 3; slot++) {
    const args: [number, number, number] = [0, 0, 0]; args[slot] = invalid;
    assert.throws(() => transferCalendarPhase(...args), /clock/);
  }
});

test('SSM loads with unequal clocks retain animation phase, advance at its boundary and restore exactly', () => {
  const crops = newFarmAssets.crops, layouts = newFarmAssets.townLayouts;
  const seed = new GameSimulation(readScenario(source('SCEN4.SSM')), crops, layouts);
  const prior = JSON.parse(seed.save(4));
  prior.scenario.farm.animationTicks = 1000; prior.scenario.farm.timerTicks = 40000;
  prior.runtime.dayTicks = 17;
  const game = GameSimulation.load(JSON.stringify(prior), crops, layouts).simulation;
  const file = Buffer.from(source('SCEN4.SSM'));
  file.writeUInt16LE(1010, 0x216f7); file.writeUInt16LE(7, 0x216f9);
  const before = game.save(4), imported = game.importOriginal(file, crops).simulation;
  const saved = JSON.parse(imported.save(null));
  assert.equal(saved.runtime.dayTicks, 27);
  assert.equal(saved.scenario.farm.animationTicks, 1010); assert.equal(saved.scenario.farm.timerTicks, 7);
  const restored = GameSimulation.load(imported.save(null), crops, layouts).simulation;
  for (const sim of [imported, restored]) sim.dispatch({ type: 'advance-day' });
  const expectedSteps = saved.scenario.farm.dayDelayTicks - 27;
  const next = JSON.parse(imported.save(null));
  assert.equal(next.runtime.daysAdvanced, saved.runtime.daysAdvanced + 1);
  assert.equal(next.runtime.dayTicks, 0);
  assert.equal(next.scenario.farm.animationTicks, (1010 + expectedSteps) & 65535);
  assert.equal(next.scenario.farm.timerTicks, (7 + expectedSteps) & 65535);
  assert.deepEqual(next, JSON.parse(restored.save(null))); assert.equal(game.save(4), before);
  // Changing only the machinery counter must not change the transferred phase.
  file.writeUInt16LE(65535, 0x216f9);
  assert.equal(JSON.parse(game.importOriginal(file, crops).simulation.save(null)).runtime.dayTicks, 27);
});
