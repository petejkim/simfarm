import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calendarDayDue, calendarDayPeriod, ticksUntilCalendarDay } from '../src/simulation/calendar-clock';
import { GameSimulation } from './support/game';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
function farm(id = 4) {
  const world = readScenario(source(`SCEN${id}.SSM`));
  const crops = world.cropFiles.map(file => readCrop(file.slice(0, -4), source('CROPS/' + file.toUpperCase())));
  const game = new GameSimulation(world, crops);
  const load = (value: unknown) => GameSimulation.load(JSON.stringify(value), crops).simulation;
  return { game, load };
}
const saved = (game: GameSimulation) => JSON.parse(game.save(null));

test('source timer and calendar use wrapping word increments and strict unsigned greater-than, including the unreachable maximum delay', () => {
  const exe = source('SIMFARM.EXE');
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0x625d, 'ff069e13ff06a013'); exact(0xc8a9, '26a1a0132b068e1f3b068c1f7703e9c208');
  exact(0xd175, '26a1a013a38e1f'); exact(0x62de, 'b8ff3fe640eb008ac4e640');
  for (const delay of [0, 1, 63, 64, 128, 256, 640, 32767, 32768, 65534, 65535]) {
    assert.equal(calendarDayPeriod(delay), delay === 65535 ? null : delay + 1);
    for (const phase of new Set([0, 1, delay, Math.max(0, delay - 1), (delay + 1) & 65535, 32768, 65534, 65535])) {
      // An independent word register walks the source INC/subtract/JA boundary;
      // the native Next day helper instead computes a bounded distance directly.
      const word = Uint16Array.of(phase); let first: number | null = null;
      for (let count = 1; count <= 65536; count++) {
        word[0]++;
        assert.equal(calendarDayDue(word[0], delay), word[0] > delay);
        if (word[0] > delay) { first = count; break; }
      }
      assert.equal(ticksUntilCalendarDay(phase, delay), first, `phase${phase}, delay${delay}`);
    }
  }
  for (const invalid of [-1, 65536, 0.5, NaN, Infinity]) {
    assert.throws(() => calendarDayPeriod(invalid)); assert.throws(() => ticksUntilCalendarDay(invalid, 256));
    assert.throws(() => ticksUntilCalendarDay(0, invalid));
  }
});

test('equality does not advance the live day; partial ticks, unequal clocks and the equality checkpoint continue exactly', () => {
  const { game, load } = farm(), document = saved(game);
  document.scenario.farm.dayDelayTicks = 64; document.scenario.farm.timerTicks = 65533; document.scenario.farm.animationTicks = 32767;
  document.runtime.dayTicks = 63; document.runtime.elapsed = 0.5; document.runtime.paused = false;
  const live = load(document), days = live.getSnapshot().daysAdvanced;
  live.tick(0.5 * 4000 / 65);
  const equal = saved(live); assert.equal(equal.runtime.dayTicks, 64); assert.equal(equal.runtime.daysAdvanced, days);
  assert.equal(equal.scenario.farm.timerTicks, 65534); assert.equal(equal.scenario.farm.animationTicks, 32768);
  assert.equal(equal.runtime.elapsed, 0);
  const resumed = load(equal); assert.deepEqual(saved(resumed), equal);
  live.tick(4000 / 65); resumed.tick(4000 / 65);
  assert.deepEqual(saved(live), saved(resumed)); assert.equal(saved(live).runtime.dayTicks, 0);
  assert.equal(live.getSnapshot().daysAdvanced, days + 1);
  assert.equal(live.getSnapshot().scenario.farm.timerTicks, 65535); assert.equal(live.getSnapshot().scenario.farm.animationTicks, 32769);
});

test('all original farms and zero/word-wrap phases use the corrected Next day distance while native1x takes four seconds per day', () => {
  for (let id = 0; id < 8; id++) {
    const { game, load } = farm(id), document = saved(game), period = document.scenario.farm.dayDelayTicks + 1;
    const timed = load({ ...document, runtime: { ...document.runtime, paused: false } });
    game.dispatch({ type: 'advance-day' }); timed.tick(1000);
    assert.equal(timed.getSnapshot().daysAdvanced, document.runtime.daysAdvanced);
    timed.tick(3000);
    const manual = saved(game), automatic = saved(timed);
    assert.equal(manual.runtime.daysAdvanced, document.runtime.daysAdvanced + 1);
    assert.equal((manual.scenario.farm.timerTicks - document.scenario.farm.timerTicks) & 65535, period);
    automatic.runtime.paused = manual.runtime.paused; assert.deepEqual(automatic, manual);
  }
  const { game, load } = farm(), base = saved(game);
  for (const delay of [0, 1, 64, 256]) for (const phase of [0, delay, delay + 1, 65535]) {
    const document = structuredClone(base); document.scenario.farm.dayDelayTicks = delay; document.runtime.dayTicks = phase;
    const live = load(document); live.dispatch({ type: 'advance-day' }); const after = saved(live);
    const ticks = ticksUntilCalendarDay(phase, delay)!;
    assert.equal((after.scenario.farm.timerTicks - document.scenario.farm.timerTicks) & 65535, ticks);
    assert.equal(after.runtime.daysAdvanced, document.runtime.daysAdvanced + 1); assert.equal(after.runtime.dayTicks, 0);
  }
});

test('maximum source delay makes manual day advance an atomic no-op while running ticks wrap without fabricating a calendar update', () => {
  const { game, load } = farm(), document = saved(game);
  document.scenario.farm.dayDelayTicks = 65535; document.runtime.dayTicks = 65535;
  document.scenario.farm.timerTicks = document.scenario.farm.animationTicks = 65535;
  const live = load(document), before = live.save(null), snapshot = live.getSnapshot();
  live.dispatch({ type: 'advance-day' }); assert.equal(live.save(null), before); assert.equal(live.getSnapshot(), snapshot);
  live.dispatch({ type: 'set-paused', paused: false }); live.tick(4000 / 65536);
  const wrapped = saved(live); assert.equal(wrapped.runtime.dayTicks, 0);
  assert.equal(wrapped.scenario.farm.timerTicks, 0); assert.equal(wrapped.scenario.farm.animationTicks, 0);
  assert.equal(wrapped.runtime.daysAdvanced, document.runtime.daysAdvanced);
  const restored = load(wrapped); live.tick(64 * 4000 / 65536); restored.tick(64 * 4000 / 65536);
  assert.deepEqual(saved(live), saved(restored)); assert.equal(saved(live).runtime.dayTicks, 64);
  assert.deepEqual(live.getSnapshot().scenario.farm.calendar, document.scenario.farm.calendar);
});
