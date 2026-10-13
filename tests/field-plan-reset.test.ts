import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { FIXED_CROP_FILES } from '../src/formats/crop-slots';
import { SCHEDULE_WEEKS } from '../src/formats/field-schedule';
import { buildPlantingPlan, continuePlantingPlan } from '../src/simulation/field-plan-pattern';
import { GameSimulation } from './support/game';
import { declineTownEvents } from './support/town-events';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const crop = (file: string) => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`));
function setup(id: number) {
  const scenario = readScenario(source(`SCEN${id}.SSM`));
  return new GameSimulation(scenario, scenario.cropFiles.map(crop));
}
const now = (game: GameSimulation) => { const c = game.getSnapshot().scenario.farm.calendar; return c.month * 4 + c.week; };
const column = (game: GameSimulation) => game.getSnapshot().scenario.schedule.column(0);
function advanceWeek(game: GameSimulation) {
  const week = now(game);
  while (now(game) === week) {
    game.dispatch({ type: 'advance-day' });
    if (game.getSnapshot().pendingTown) game.dispatch({ type: 'choose-town', choice: 'residential' });
    declineTownEvents(game);
  }
}

test('a continued plan equals the planting generator for every shipped crop, start and first row', () => {
  const crops = FIXED_CROP_FILES.map(file => crop(file).rawDefinition);
  for (let slot = 0; slot < crops.length; slot++) for (const start of [0, 1, 7, 30, 47, 100, 238]) {
    const plan = buildPlantingPlan(crops, slot, start);
    for (const from of [start + 1, start + 2, start + 15, start + 49, SCHEDULE_WEEKS - 1].filter(f => f > start && f < SCHEDULE_WEEKS))
      expect(continuePlantingPlan(crops, slot, start, from)).toEqual(plan.slice(from));
  }
  // A crop planted before row 0 (an earlier plan year) continues the same cycle: corn repeats every 14 weeks.
  const corn = FIXED_CROP_FILES.indexOf('corn.crp');
  expect(continuePlantingPlan(crops, corn, -28, 1)).toEqual(buildPlantingPlan(crops, corn, 0).slice(1));
  const late = continuePlantingPlan(crops, corn, -5, 3); // rows 3..8 are cycle weeks 8..13, then a replant at row 9
  expect(late.slice(0, 6)).toEqual(buildPlantingPlan(crops, corn, 0).slice(8, 14));expect(late.slice(6)).toEqual(buildPlantingPlan(crops, corn, 9).slice(9));
});

for (const [id, slot, name, seen] of [[4, 0, 'annual corn', [3, 4, 5]], [4, 1, 'annual wheat', [3, 4]], [0, 0, 'fixed-harvest almonds', [4]]] as const)
  test(`RESET restores an unedited ${name} plan through planting, growth and harvest weeks`, () => {
    const game = setup(id);
    game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: now(game) + 1, action: { kind: 'plant', cropSlot: slot } });
    const plan = column(game), states = new Set<number>();
    while (now(game) < 46) {
      advanceWeek(game);
      const week = now(game), field = game.getSnapshot().scenario.fields[1];
      if (field.cropSlot !== slot) break;
      states.add(field.state);
      // Scramble the future: CUT, another crop, an extra harvest and a spray; then RESET.
      game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: week + 3, action: { kind: 'clear' } });
      game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: week + 5, action: { kind: 'plant', cropSlot: slot ? 0 : 2 } });
      game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: week + 1, action: { kind: 'harvest' } });
      game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: week + 2, action: { kind: 'fertilizer' } });
      game.dispatch({ type: 'reset-field-plan', fieldSlot: 1 });
      expect(game.getSnapshot().lastPlanEditResult).toEqual({ ok: true, fieldSlot: 1, week: week + 1 });
      expect(column(game).slice(week + 1), `week ${week}`).toEqual(plan.slice(week + 1));
      expect(column(game).slice(0, week + 1)).toEqual(plan.slice(0, week + 1)); // the past and current week untouched
    }
    for (const state of seen) expect(states.has(state)).toBe(true);
  });

test('a treatment week keeps RESET aligned with the crop, and a contract this week is never reset', () => {
  const game = setup(4);
  game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: now(game) + 1, action: { kind: 'plant', cropSlot: 0 } });
  for (let i = 0; i < 3; i++) advanceWeek(game);
  game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: now(game) + 1, action: { kind: 'fertilizer' } });
  advanceWeek(game);
  expect(game.getSnapshot().scenario.fields[1].state).toBe(6);
  game.dispatch({ type: 'reset-field-plan', fieldSlot: 1 });
  const during = column(game), week = now(game);
  advanceWeek(game);
  expect(game.getSnapshot().scenario.fields[1].state).toBe(4);
  game.dispatch({ type: 'reset-field-plan', fieldSlot: 1 });
  expect(column(game).slice(week + 2)).toEqual(during.slice(week + 2));
  // Contract: placed in the current week, it survives RESET in the plan and the field.
  game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: now(game), action: { kind: 'contract' } });
  const contracted = game.getSnapshot();
  expect(contracted.scenario.schedule.get(now(game), 0)).toBe(198);
  game.dispatch({ type: 'reset-field-plan', fieldSlot: 1 });
  const after = game.getSnapshot();
  expect(after.scenario.schedule.get(now(game), 0)).toBe(198);
  expect(after.scenario.fields[1].bytes).toEqual(contracted.scenario.fields[1].bytes);
  expect(after.scenario.cropDefinitions).toEqual(contracted.scenario.cropDefinitions);
});

test('a field without a crop is reset to nothing planned, and RESET changes only the plan', () => {
  const game = setup(4);
  game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: now(game) + 1, action: { kind: 'clear' } });
  advanceWeek(game);
  expect(game.getSnapshot().scenario.fields[1].state).toBe(0);
  game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: now(game) + 4, action: { kind: 'plant', cropSlot: 3 } });
  const before = JSON.parse(game.save(4));
  game.dispatch({ type: 'reset-field-plan', fieldSlot: 1 });
  expect(column(game).slice(now(game) + 1).every(code => code === 209)).toBe(true);
  const after = JSON.parse(game.save(4));
  // Only the schedule differs.
  const withoutSchedule = (value: unknown): unknown => Array.isArray(value) ? value.map(withoutSchedule)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'schedule').map(([key, v]) => [key, withoutSchedule(v)])) : value;
  expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
  expect(withoutSchedule(after)).toEqual(withoutSchedule(before));
  const invalid = game.save(4);
  game.dispatch({ type: 'reset-field-plan', fieldSlot: 97 });
  expect(game.getSnapshot().lastPlanEditResult).toMatchObject({ ok: false, reason: 'invalid-field' });
  expect(game.save(4)).toBe(invalid);
});
