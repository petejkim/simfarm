import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { livestockFixture } from './support/livestock';
import { GameSimulation } from './support/game';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { animateTownEventMap } from '../src/simulation/town-event-map';
import { FarmRandom } from '../src/simulation/random';
function fixture(mode: 1 | 2) {
  const f = livestockFixture();
  f.state.townEvent.mode = f.state.townEvent.artworkMode = mode;
  f.state.finances.town.recreationCount = 2;
  f.state.finances.town.recreationCoordinates.set([72, 72, 80, 80]);
  f.state.disasters.enabled = false;
  return f;
}

test('live recreation frames run after represented tick systems with identical source primitive RNG ordering', () => {
  for (const mode of [1, 2] as const) {
    const f = fixture(mode), game = f.load();
    f.state.townEvent.mode = 0;
    const control = f.load();
    game.dispatch({ type: 'set-paused', paused: false }); control.dispatch({ type: 'set-paused', paused: false });
    game.tick(32); control.tick(32); // Eight logical ticks at the fixture's4ms/tick.
    const expected = readNativeSave(control.save(4)).state;
    expected.townEvent.mode = mode;
    const rng = new FarmRandom(expected.random);
    assert.equal(animateTownEventMap(expected.scenario, expected.finances.town, expected.townEvent, 8, rng), true);
    expected.random = rng.snapshot();
    assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(writeNativeSave(expected, 4)));
  }
});

test('pause and exact load preserve animation/RNG and continuation over many frames', () => {
  for (const mode of [1, 2] as const) {
    const f = fixture(mode), game = f.load();
    const start = JSON.parse(game.save(4)); game.tick(1000); assert.deepEqual(JSON.parse(game.save(4)), start);
    game.dispatch({ type: 'set-paused', paused: false }); game.tick(60);
    const copy = GameSimulation.load(game.save(4), f.crops).simulation;
    for (const milliseconds of [4, 32, 64, 128]) {
      game.tick(milliseconds); copy.tick(milliseconds);
      assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(copy.save(4)));
    }
    game.dispatch({ type: 'set-paused', paused: true });
    const stopped = JSON.parse(game.save(4)); game.tick(1000); assert.deepEqual(JSON.parse(game.save(4)), stopped);
    assert.notDeepEqual(stopped.runtime.random, start.runtime.random);
  }
});

test('active malformed recreation footprints reject before native save/load or live ticking', () => {
  const f = fixture(1), good = f.load().save(4), bad = JSON.parse(good);
  bad.runtime.finances.town.recreationCoordinates[2] = 255;
  assert.throws(() => readNativeSave(JSON.stringify(bad)), /recreation footprint/);
  f.state.finances.town.recreationCoordinates[2] = 255;
  assert.throws(() => writeNativeSave(f.state, 4), /recreation footprint/);
  assert.deepEqual(JSON.parse(GameSimulation.load(good, f.crops).simulation.save(4)), JSON.parse(good));
});
