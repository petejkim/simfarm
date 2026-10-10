import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { GameSimulation } from './support/game';
import { MAX_SAVE_BYTES, readNativeSave } from '../src/formats/native-save';
import { TREATMENTS } from '../src/simulation/field-treatment';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function farm(id = 4) {
  const scenario = readScenario(source(`SCEN${id}.SSM`));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  return { scenario, crops };
}
function same(a: GameSimulation, b: GameSimulation, id: number) {
  assert.deepEqual(JSON.parse(a.save(id)), JSON.parse(b.save(id)));
}

test('native saves retain unknown source/record bytes, all eight farms and detached runtime state', () => {
  for (let id = 0; id < 8; id++) {
    const { scenario, crops } = farm(id);
    scenario.fields[97].bytes[67] = 173; // Unknown inactive byte must survive, including after startup.
    const game = new GameSimulation(scenario, crops);
    game.dispatch({ type: 'set-speed', speed: 0.5 });
    game.dispatch({ type: 'set-paused', paused: false }); game.tick(1092.5);
    const text = game.save(id), restored = GameSimulation.load(text, crops);
    assert.equal(restored.scenarioId, id); same(game, restored.simulation, id);
    assert.deepEqual(restored.simulation.getSnapshot().scenario.sourceBytes, Uint8Array.from(source(`SCEN${id}.SSM`)));
    const view = restored.simulation.getSnapshot();
    view.scenario.sourceBytes!.fill(0); view.scenario.fields[97].bytes.fill(0); view.weather.forecast.fill(4);
    same(game, restored.simulation, id);
    game.tick(72000.5); restored.simulation.tick(72000.5); same(game, restored.simulation, id);
    assert.equal(restored.simulation.getSnapshot().scenario.fields[97].bytes[67], 173);
  }
}, 15000);

test('save midway through new-field work and treatments continues through valuable harvest and sale', () => {
  const { scenario, crops } = farm();
  const original = new GameSimulation(scenario, crops);
  original.dispatch({ type: 'set-disasters-enabled', enabled: false }); // Isolate saved farming from damage; weekly markets still run.
  original.dispatch({ type: 'buy-land', regionX: 0, regionY: 2 });
  original.dispatch({ type: 'set-auto-clear', enabled: true });
  original.dispatch({ type: 'create-field', x: 0, y: 16, cropSlot: 0 });
  const result = original.getSnapshot().lastNewFieldResult; assert.ok(result?.ok);
  original.dispatch({ type: 'set-paused', paused: false }); original.tick(49.38);
  let restored = GameSimulation.load(original.save(4), crops).simulation;
  // Sample every stage, including wrapped border coordinates on the new edge field.
  for (let n = 0; n < 20; n++) {
    original.tick(400); restored.tick(400); same(original, restored, 4);
    restored = GameSimulation.load(restored.save(4), crops).simulation;
  }
  for (const game of [original, restored]) game.dispatch({ type: 'treat-field', fieldSlot: result.slot, treatment: 'fertilizer' });
  for (let n = 0; n < 12; n++) {
    original.tick(1000); restored.tick(1000); same(original, restored, 4);
    restored = GameSimulation.load(restored.save(4), crops).simulation;
  }
  for (const game of [original, restored]) {
    game.dispatch({ type: 'set-paused', paused: true });
    while (game.getSnapshot().daysAdvanced < 84) game.dispatch({ type: 'advance-day' });
    game.dispatch({ type: 'harvest-field', fieldSlot: result.slot });
  }
  restored = GameSimulation.load(restored.save(4), crops).simulation;
  const priorItems = new Set(original.getSnapshot().scenario.inventory.filter(i => i.active).map(i => i.slot));
  for (const game of [original, restored]) game.dispatch({ type: 'advance-day' });
  same(original, restored, 4);
  restored = GameSimulation.load(restored.save(4), crops).simulation;
  const inventory = original.getSnapshot().scenario.inventory.find(i => i.active && i.type === 168 && !priorItems.has(i.slot))!;
  assert.ok(inventory); assert.equal(original.getSnapshot().storedHarvestValues[inventory.slot], 1831);
  for (const game of [original, restored]) game.dispatch({ type: 'sell-harvest', inventorySlot: inventory.slot });
  same(original, restored, 4); assert.equal(restored.getSnapshot().scenario.farm.cash, 23220);
}, 15000);

test('all four treatments, tick rollover and fifth-year weather retain exact continuation', () => {
  for (const treatment of TREATMENTS) {
    const { scenario, crops } = farm(0);
    scenario.farm.timerTicks = 65530; scenario.farm.animationTicks = 65530;
    const game = new GameSimulation(scenario, crops);
    game.dispatch({ type: 'treat-field', fieldSlot: 1, treatment });
    game.dispatch({ type: 'set-paused', paused: false }); game.tick(1000.5);
    const restored = GameSimulation.load(game.save(0), crops).simulation;
    game.tick(48000); restored.tick(48000); same(game, restored, 0);
  }
  const { scenario, crops } = farm(4), game = new GameSimulation(scenario, crops);
  // Native checkpoint at the otherwise slow-to-reach fifth-year boundary, with a partial day.
  const save = JSON.parse(game.save(4));
  Object.assign(save.scenario.farm.calendar, { day: 6, week: 3, month: 11, year: 1997 });
  Object.assign(save.runtime.weather, { temperatureYear: 4, precipitationYear: 4, windYear: 4 });
  save.runtime.dayTicks = 3; save.runtime.elapsed = 0.75; save.runtime.paused = false;
  const a = GameSimulation.load(JSON.stringify(save), crops).simulation;
  const b = GameSimulation.load(a.save(4), crops).simulation;
  a.tick(32000.5); b.tick(32000.5); same(a, b, 4);
  assert.ok(a.getSnapshot().pendingTown);
  for (const sim of [a, b]) sim.dispatch({ type: 'choose-town', choice: 'residential' });
  same(a, b, 4);
  assert.equal(b.getSnapshot().weather.temperatureYear, 0);
  assert.equal(b.getSnapshot().scenario.farm.calendar.year, 1998);
}, 15000);

test('native save validation rejects malformed boundaries and incompatible assets before restoration', () => {
  const { scenario, crops } = farm(), game = new GameSimulation(scenario, crops), text = game.save(4);
  const mutate = (fn: (s: any) => void) => { const s = JSON.parse(text); fn(s); return JSON.stringify(s); };
  for (const bad of ['', '{}', 'null', '[]', 'x'.repeat(MAX_SAVE_BYTES + 1),
    mutate(s => s.version = 99), mutate(s => s.scenarioId = 8), mutate(s => s.scenario.source = '00'),
    mutate(s => s.scenario.world = s.scenario.world.slice(2)), mutate(s => s.scenario.records.fields += '00'),
    mutate(s => s.scenario.farm.cash = -1), mutate(s => s.scenario.farm.workerExpenses = 0x100000000),
    mutate(s => s.scenario.farm.calendar.day = 7), mutate(s => s.runtime.random.visual = 65536),
    mutate(s => s.runtime.elapsed = 1), mutate(s => s.runtime.dayTicks = 65536),
    mutate(s => s.runtime.weather.forecast[0] = 5), mutate(s => s.runtime.weather.windYear = 5),
    mutate(s => s.scenario.climate.precipitation[0] = 8), mutate(s => s.runtime.cropMarketPrices[0]++),
    mutate(s => s.runtime.speed = 3), mutate(s => s.runtime.paused = 'false'),
    mutate(s => s.runtime.crops[0][34] ^= 1)]) {
    assert.throws(() => GameSimulation.load(bad, crops));
    assert.equal(game.save(4), text);
  }
  assert.throws(() => GameSimulation.load(text, []), /Missing simulation crop/);
  const parsed = readNativeSave(text); parsed.state.scenario.sourceBytes!.fill(0);
  assert.equal(game.save(4), text);
});


test('native checkpoints resume both original harvest methods on every farm without losing worker ledgers', () => {
  for (let id = 0; id < 8; id++) {
    const { scenario, crops } = farm(id), game = new GameSimulation(scenario, crops);
    game.dispatch({ type: 'harvest-field', fieldSlot: 1 });
    assert.equal(game.getSnapshot().lastHarvestResult?.ok, true);
    let restored = GameSimulation.load(game.save(id), crops).simulation;
    for (let day = 0; day < 12; day++) {
      game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' });
      same(game, restored, id);
      if (day % 3 === 0) restored = GameSimulation.load(restored.save(id), crops).simulation;
    }
    assert.equal(restored.getSnapshot().scenario.farm.workerExpenses, game.getSnapshot().scenario.farm.workerExpenses);
  }
}, 15000);

test('native loader rejects broken record references, attachment cycles and malformed dimensions', () => {
  const { scenario, crops } = farm(0), game = new GameSimulation(scenario, crops), text = game.save(0);
  const damage = (key: string, offset: number, value: number) => {
    const save = JSON.parse(text), raw: string = save.scenario.records[key];
    save.scenario.records[key] = raw.slice(0, offset * 2) + value.toString(16).padStart(2, '0') + raw.slice(offset * 2 + 2);
    return JSON.stringify(save);
  };
  for (const bad of [damage('fields', 68 + 42, 255), damage('fields', 68 + 12, 255),
    damage('equipment', 56 + 46, 1), damage('equipment', 56 + 7, 96),
    damage('equipmentDefinitions', 8, 0), damage('equipmentDefinitions', 0, 255)]) {
    assert.throws(() => GameSimulation.load(bad, crops));
  }
});


test('harvest truck storage indices survive checkpoints during delivery and the return journey', () => {
  const { scenario, crops } = farm(1), game = new GameSimulation(scenario, crops);
  game.dispatch({ type: 'harvest-field', fieldSlot: 1 });
  game.dispatch({ type: 'set-paused', paused: false });
  let delivering = false;
  for (let tick = 0; tick < 2048; tick++) {
    game.tick(4000 / (scenario.farm.dayDelayTicks + 1));
    const field = game.getSnapshot().scenario.fields[1];
    if (field.state === 5 && field.step === 15) { delivering = true; break; }
  }
  assert.ok(delivering);
  const view = game.getSnapshot(), truck = view.scenario.equipment[view.scenario.fields[1].pendingEquipment];
  assert.equal(truck.parent, 12); assert.equal(view.scenario.equipment[12].active, false);
  const restored = GameSimulation.load(game.save(1), crops).simulation;
  same(game, restored, 1);
  let returned = false;
  for (let tick = 0; tick < 2048; tick++) {
    game.tick(4000 / (scenario.farm.dayDelayTicks + 1)); restored.tick(4000 / (scenario.farm.dayDelayTicks + 1));
    const next = restored.getSnapshot().scenario.equipment[truck.slot];
    if (next.flags & 0x200) {
      same(game, restored, 1);
      const returning = GameSimulation.load(restored.save(1), crops).simulation;
      restored.tick(32000); returning.tick(32000); same(restored, returning, 1); returned = true; break;
    }
  }
  assert.ok(returned);
  const corrupt = JSON.parse(game.save(1));
  const raw: string = corrupt.scenario.records.equipment, pos = (truck.slot * 56 + 44) * 2;
  corrupt.scenario.records.equipment = raw.slice(0, pos) + 'ff00' + raw.slice(pos + 4);
  assert.throws(() => GameSimulation.load(JSON.stringify(corrupt), crops), /storage reference/);
  const outside = JSON.parse(game.save(1)), x = (truck.slot * 56 + 5) * 2;
  outside.scenario.records.equipment = raw.slice(0, x) + 'ff' + raw.slice(x + 2);
  assert.throws(() => GameSimulation.load(JSON.stringify(outside), crops), /equipment position/);
});
