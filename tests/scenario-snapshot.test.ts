import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { copyScenario } from '../src/simulation/scenario-snapshot';
import { GameSimulation } from './support/game';
import { browserCrops } from './support/crop-catalog';

const farm = () => copyScenario(readScenario(readFileSync(new URL('../../simfarm-dos/SCEN4.SSM', import.meta.url))));
const recordTables = ['fields', 'equipment', 'equipmentDefinitions', 'animals', 'buildings', 'buildingDefinitions',
  'inventory', 'chemicals', 'chemicalDefinitions', 'seedDefinitions', 'cropDefinitions', 'harvestDefinitions'] as const;

test('unchanged scenario views reuse detached sections; one changed cell never changes the historical view', () => {
  const owner = farm(), before = copyScenario(owner);
  expect(copyScenario(owner, before)).toBe(before);
  for (const key of ['sourceBytes', 'schedule', 'cells', 'cropFiles', 'regionalConditions', 'climate', 'irrigation', ...recordTables] as const)
    expect(before[key]).not.toBe(owner[key]);
  const terrain = before.cells[0].terrain;
  owner.cells[0].terrain ^= 1;
  const after = copyScenario(owner, before);
  expect(after.cells).not.toBe(before.cells);
  expect(after.cells[0].terrain).toBe(terrain ^ 1); expect(before.cells[0].terrain).toBe(terrain);
  expect(after.cells[1]).toBe(before.cells[1]);
  expect(after.fields).toBe(before.fields); expect(after.sourceBytes).toBe(before.sourceBytes);
  expect(after.schedule).toBe(before.schedule); expect(after.climate).toBe(before.climate);
});

test('every record byte, including unknown first/last bytes, invalidates only its detached record', () => {
  const owner = farm(); let previous = copyScenario(owner);
  for (const key of recordTables) for (const index of [0, owner[key].length - 1]) {
    const record = owner[key][index];
    for (const at of [0, record.bytes.length - 1]) {
      const old = previous[key][index].bytes[at]; record.bytes[at] ^= 1;
      const next = copyScenario(owner, previous);
      expect(next[key][index].bytes[at]).toBe(old ^ 1);
      expect(previous[key][index].bytes[at]).toBe(old);
      expect(next[key][index]).not.toBe(previous[key][index]);
      expect(next[key][index].constructor).toBe(record.constructor);
      expect(next[key][1]).toBe(previous[key][1]);
      previous = next;
    }
  }
});

test('source, schedule, regional, climate and irrigation boundaries retain exact unknown values and historical copies', () => {
  const owner = farm(); let previous = copyScenario(owner);
  for (const bytes of [owner.sourceBytes!, owner.schedule.bytes, owner.regionalConditions, owner.irrigation.sources]) {
    for (const at of [0, bytes.length - 1]) {
      bytes[at] ^= 1;
      const next = copyScenario(owner, previous);
      expect(next).toEqual(copyScenario(owner)); expect(next).not.toBe(previous);
      previous = next;
    }
  }
  owner.irrigation.flow = [{ x: 1, y: 2, strength: 3 }]; owner.irrigation.active = true;
  let next = copyScenario(owner, previous); expect(next.irrigation.flow[0]).not.toBe(owner.irrigation.flow[0]);
  previous = next; owner.irrigation.flow[0].strength = 4; next = copyScenario(owner, previous);
  expect(previous.irrigation.flow[0].strength).toBe(3); expect(next.irrigation.flow[0].strength).toBe(4);
  previous = next; owner.irrigation.flow = []; owner.irrigation.active = false;
  owner.climate.temperature[owner.climate.temperature.length - 1] ^= 1;
  next = copyScenario(owner, previous); expect(next).toEqual(copyScenario(owner));
  expect(previous.irrigation.flow).toHaveLength(1); expect(next.irrigation.flow).toHaveLength(0);
  owner.sourceBytes = null; expect(copyScenario(owner, next).sourceBytes).toBeNull();
});

test('edited detached snapshots cannot affect saves and are repaired on the next publish', () => {
  const scenario = readScenario(readFileSync(new URL('../../simfarm-dos/SCEN4.SSM', import.meta.url)));
  const game = new GameSimulation(scenario, browserCrops), control = new GameSimulation(scenario, browserCrops);
  game.dispatch({ type: 'set-option', option: 'messages', enabled: false });
  control.dispatch({ type: 'set-option', option: 'messages', enabled: false });
  const view = game.getSnapshot().scenario;
  view.cells[0].attribute ^= 1; view.sourceBytes![view.sourceBytes!.length - 1] ^= 1;
  view.schedule.bytes[view.schedule.bytes.length - 1] ^= 1;
  view.regionalConditions[view.regionalConditions.length - 1] ^= 1;
  view.climate.temperature[0] ^= 1; view.irrigation.sources[191] ^= 1;
  view.farm.calendar.year = 1234;
  for (const key of recordTables) view[key][0].bytes[view[key][0].bytes.length - 1] ^= 1;
  expect(game.save(4)).toBe(control.save(4));
  game.dispatch({ type: 'set-speed', speed: 2 }); control.dispatch({ type: 'set-speed', speed: 2 });
  expect(game.getSnapshot().scenario).toEqual(control.getSnapshot().scenario);
  game.dispatch({ type: 'advance-day' }); control.dispatch({ type: 'advance-day' });
  expect(game.save(4)).toBe(control.save(4));
});
