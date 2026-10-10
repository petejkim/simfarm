import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { readHomestead } from '../src/formats/homestead';
import { GameSimulation } from './support/game';
import type { GameEvent } from '../src/simulation/events';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function fixture(edit: (save: any) => void = () => {}) {
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  scenario.schedule.bytes.fill(0); Object.assign(scenario.farm.calendar, { day: 6, week: 3, month: 11 });
  const save = JSON.parse(new GameSimulation(scenario, crops).save(4));
  save.runtime.finances.homestead.rank = 0; save.runtime.finances.town.townRevenue = 50000;
  save.scenario.farm.cash = 800000; save.scenario.farm.salesAccumulator = 1000;
  edit(save);
  return { save, crops, game: GameSimulation.load(JSON.stringify(save), crops).simulation };
}

test('house repaint waits for town construction, uses post-tax pre-installment cash and emits upgrade feedback once', () => {
  const { game, crops } = fixture(s => {
    s.runtime.finances.homestead.x = 92; s.runtime.finances.homestead.y = 92;
    Object.assign(s.runtime.finances.loan, { principal: 100000, scheduledPayment: 100000 });
  });
  const events: GameEvent[] = []; game.subscribeEvents(e => events.push(e));
  const before = game.getSnapshot(), origin = before.finances.homestead;
  game.dispatch({ type: 'advance-day' }); assert.ok(game.getSnapshot().pendingTown);
  assert.equal(game.getSnapshot().finances.homestead.rank, 0); assert.equal(game.getSnapshot().lastHomesteadChange, null);
  assert.equal(game.getSnapshot().scenario.cells[worldIndex(95, 95)].terrain, before.scenario.cells[worldIndex(95, 95)].terrain);
  const restored = GameSimulation.load(game.save(4), crops).simulation, restoredEvents: GameEvent[] = [];
  restored.subscribeEvents(e => restoredEvents.push(e)); events.length = 0;
  for (const sim of [game, restored]) sim.dispatch({ type: 'choose-town', choice: 'airport' });
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4))); assert.deepEqual(events, restoredEvents);
  const after = game.getSnapshot(); assert.ok(after.scenario.farm.cash < 750000); assert.equal(after.finances.homestead.rank, 5);
  assert.equal(after.scenario.cells[worldIndex(origin.x + 3, origin.y + 3)].terrain, 524);
  assert.deepEqual(events.slice(-2), [{ type: 'sound', sound: 'cheers' }, { type: 'music', track: 'cowman' }]);
  assert.equal(after.lastHomesteadChange?.notice, 'improved');
  after.finances.homestead.rank = 0; after.finances.homestead.x = 0; after.lastHomesteadChange!.rank = 0;
  const text = game.save(4), copy = GameSimulation.load(text, crops).simulation;
  assert.equal(copy.getSnapshot().lastHomesteadChange, null); assert.equal(copy.getSnapshot().finances.homestead.rank, 5);
  assert.deepEqual(JSON.parse(copy.save(4)), JSON.parse(text));
  events.length = 0; game.dispatch({ type: 'choose-town', choice: 'commercial' }); game.dispatch({ type: 'set-speed', speed: 16 });
  assert.deepEqual(events, []);
});

test('initial assignment is silent; downgrade requests boos only; highest cash skips repaint and feedback', () => {
  for (const [rank, balance, expectedRank, sound] of [[255, 40000, 0, null], [5, 40000, 0, 'boos'], [2, 1100000, 2, null]] as const) {
    const { game } = fixture(s => { s.scenario.farm.cash = balance; s.runtime.finances.homestead.rank = rank; s.runtime.finances.town.expansionFunds = 0; });
    const events: GameEvent[] = [], unsubscribe = game.subscribeEvents(e => events.push(e));
    game.dispatch({ type: 'advance-day' });
    assert.equal(game.getSnapshot().finances.homestead.rank, expectedRank);
    assert.deepEqual(events.filter(e => e.type === 'sound'), sound ? [{ type: 'sound', sound }] : []);
    assert.ok(!events.some(e => e.type === 'music' && e.track === 'cowman'));
    unsubscribe(); events.length = 0; for (let i = 0; i < 7; i++) game.dispatch({ type: 'advance-day' }); assert.deepEqual(events, []);
  }
});

test('weekly music requests follow original thresholds, preserve RNG/state and do not replay on load or snapshot access', () => {
  for (const [balance, mask, track] of [[4999, 0x8f, 'dfarm'], [500001, 0, 'ffarm'], [5000, 0x8f, null], [500000, 0, null]] as const) {
    const { game, crops, save } = fixture(s => {
      s.scenario.farm.cash = balance; Object.assign(s.scenario.farm.calendar, { day: 6, week: 0, month: 0 });
      s.runtime.dayTicks = s.scenario.farm.dayDelayTicks;
      const fields = Buffer.from(s.scenario.records.fields, 'hex');
      for (let slot = 1; slot < 98; slot++) if (fields[slot * 68 + 7] & 1) {
        const offset = slot * 68;
        // Growing crops accumulate distinct nutrient, water, toxicity and pest warnings;
        // Waiting crops clear their flags. These survive the real odd-day refresh.
        fields[offset + 2] = mask ? 4 : 0;
        for (const index of [20, 21, 22, 32]) fields[offset + index] = mask ? 200 : 0;
        fields[offset + 29] = 0; fields.writeUInt16LE(65535, offset + 24);
      }
      s.scenario.records.fields = fields.toString('hex');
    });
    const events: GameEvent[] = []; game.subscribeEvents(e => events.push(e));
    const silent = GameSimulation.load(JSON.stringify(save), crops).simulation;
    game.dispatch({ type: 'advance-day' }); silent.dispatch({ type: 'advance-day' });
    assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(silent.save(4)));
    assert.deepEqual(events, track ? [{ type: 'music', track }] : []);
    const copy = GameSimulation.load(game.save(4), crops).simulation, loadedEvents: GameEvent[] = [];
    copy.subscribeEvents(e => loadedEvents.push(e)); copy.getSnapshot(); copy.save(4); assert.deepEqual(loadedEvents, []);
  }
});

test('v8 house state is mandatory, bounded and detached; older saves migrate source coordinates without repaint', () => {
  const { game, crops, save } = fixture();
  for (const version of [1, 2, 3, 4, 5, 6, 7]) {
    const old = structuredClone(save); old.version = version; delete old.runtime.finances.homestead;
    const loaded = GameSimulation.load(JSON.stringify(old), crops).simulation;
    assert.deepEqual(loaded.getSnapshot().finances.homestead, readHomestead(source('SCEN4.SSM')));
    assert.deepEqual(loaded.getSnapshot().scenario.cells, game.getSnapshot().scenario.cells);
  }
  const before = game.save(4);
  for (const mutate of [(s: any) => { delete s.homestead; }, (s: any) => { delete s.homestead.rank; },
    (s: any) => { s.homestead.rank = 6; }, (s: any) => { s.homestead.rank = 254; },
    (s: any) => { s.homestead.x = 93; }, (s: any) => { s.homestead.y = -1; }, (s: any) => { s.homestead.y = '0'; }]) {
    const bad = structuredClone(save); mutate(bad.runtime.finances);
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), crops), /financial state/); assert.equal(game.save(4), before);
  }
});
