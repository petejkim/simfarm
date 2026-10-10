import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { Binary } from '../src/formats/binary';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { worldIndex } from '../src/formats/scenario';
import { storedWater } from '../src/simulation/water-storage';
import { GameSimulation } from './support/game';
import { waterStorageFixture } from './support/water-storage';

test('purchased water storage collects from a real pumped ditch, refills a distant trough weekly and resumes exact saved state', () => {
  const f = waterStorageFixture(), game = f.load();
  game.dispatch({ type: 'build', buildingType: 72, x: 13, y: 11 }); assert.ok(game.getSnapshot().lastBuildingResult?.ok);
  assert.equal(storedWater(game.getSnapshot().scenario.buildings[2]), 217);
  const paused = game.save(4); game.tick(20000); assert.equal(game.save(4), paused);
  game.dispatch({ type: 'advance-day' }); let s = game.getSnapshot();
  assert.equal(s.scenario.cells[worldIndex(13, 10)].terrain & 2047, 99);
  assert.equal(storedWater(s.scenario.buildings[2]), 255); assert.equal(s.scenario.inventory[1].quantity, 0);
  const saved = game.save(4), copy = GameSimulation.load(saved, f.crops).simulation;
  s.scenario.buildings[2].bytes.fill(0); assert.equal(game.save(4), saved);
  for (let d = 1; d < 7; d++) { game.dispatch({ type: 'advance-day' }); copy.dispatch({ type: 'advance-day' }); }
  s = game.getSnapshot(); assert.equal(s.scenario.inventory[1].quantity, 128);
  assert.equal(storedWater(s.scenario.buildings[2]), 191); assert.equal(s.scenario.cells[worldIndex(30, 30)].terrain, 176);
  assert.equal(new Binary(s.scenario.inventory[1].bytes).u16(6), 1);
  assert.equal(new Binary(s.scenario.buildings[2].bytes).u16(8), 1);
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(copy.save(4)));
  for (let d = 0; d < 14; d++) { game.dispatch({ type: 'advance-day' }); copy.dispatch({ type: 'advance-day' }); }
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(copy.save(4)));
  assert.equal(game.getSnapshot().scenario.inventory[1].quantity, 128); // Nonempty troughs are not topped up.
  assert.equal(storedWater(game.getSnapshot().scenario.buildings[2]), 255);
});

test('day-seven collection precedes weekly wear and refill; decisions suspend construction and water lifecycle', () => {
  for (const wornOut of [false, true]) {
    const f = waterStorageFixture(), initial = f.load();
    initial.dispatch({ type: 'build', buildingType: 72, x: 13, y: 11 });
    const { state } = readNativeSave(initial.save(4)), store = state.scenario.buildings[2], v = new Binary(store.bytes).view;
    v.setUint16(10, 0, true); v.setUint16(8, wornOut ? 480 : 0, true);
    state.scenario.cells[worldIndex(13, 10)].terrain = 99;
    state.scenario.farm.calendar.day = 6; state.dayTicks = 15; state.random.visual = 10; // Weekly traffic draws1792, then wear draws7.
    const game = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation;
    game.dispatch({ type: 'advance-day' }); const s = game.getSnapshot();
    assert.equal(s.scenario.inventory[1].quantity, wornOut ? 0 : 100);
    assert.equal(storedWater(s.scenario.buildings[2]), 0);
    assert.equal(s.scenario.buildings[2].flags, wornOut ? 34 : 32);
    assert.equal(s.scenario.cells[worldIndex(13, 11)].terrain & 2047, wornOut ? 149 : 481);
    for (const decision of ['town', 'default']) {
      if (decision === 'town') {
        state.pendingTown = { phase: 'annual-reset', site: { ...state.finances.town.activeSite }, resumeRunning: false };
        state.dayTicks = 0; Object.assign(state.scenario.farm.calendar, { day: 0, week: 0, month: 0 });
        state.scenario.farm.salesAccumulator = 0;
        const { regionX, regionY } = state.finances.town.activeSite;
        state.scenario.regionalConditions[(regionX * 12 + regionY) * 7 + 1] = 2;
      }
      else { state.pendingTown = null; state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 }; }
      const blocked = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation, saved = blocked.save(4);
      blocked.dispatch({ type: 'advance-day' }); blocked.dispatch({ type: 'build', buildingType: 72, x: 20, y: 20 });
      blocked.tick(20000); assert.equal(blocked.save(4), saved);
    }
  }
});
