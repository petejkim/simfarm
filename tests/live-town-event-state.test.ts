import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { readTownEvent } from '../src/formats/town-event';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { GameSimulation } from './support/game';
import { coldTownEvent, importTownEvent, resetTownEvent } from '../src/simulation/town-event-lifecycle';
import { transferOriginalFarm } from '../src/simulation/original-load';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
function fixture(id = 5) {
  const raw = source(`SCEN${id}.SSM`), world = readScenario(raw);
  const crops = world.cropFiles.map(name => readCrop(name.slice(0, -4), source(`CROPS/${name.toUpperCase()}`)));
  return { raw, crops, game: new GameSimulation(world, crops) };
}

test('all original farms expose and checkpoint their event bytes with detached snapshots', () => {
  for (let id = 0; id < 8; id++) {
    const { raw, game, crops } = fixture(id), expected = { ...coldTownEvent(), ...readTownEvent(raw) };
    assert.deepEqual(game.getSnapshot().townEvent, expected);
    const text = game.save(id), saved = JSON.parse(text);
    assert.equal(saved.version, 27); assert.deepEqual(saved.runtime.townEvent, expected);
    const copy = GameSimulation.load(text, crops).simulation;
    copy.getSnapshot().townEvent.rodeoFrame = 3;
    assert.deepEqual(JSON.parse(copy.save(id)), JSON.parse(text));
  }
});

test('ordinary SSM transfer restores saved fields while retaining position bits and uploaded artwork', () => {
  const { game, crops, raw } = fixture();
  const prior = readNativeSave(game.save(5)).state;
  prior.townEvent = { ...coldTownEvent(), rodeoX: 1, rodeoY: 1, artworkMode: 2, mode: 2,
    participation: 1, weeksRemaining: 3, animalType: 2 };
  const next = transferOriginalFarm(prior, raw, crops);
  assert.deepEqual(next.townEvent, { ...prior.townEvent, ...readTownEvent(raw), pending: null });
  assert.equal(prior.townEvent.weeksRemaining, 3);
  assert.deepEqual(importTownEvent(raw, prior.townEvent), next.townEvent);
});

test('source restart clears only mapped event globals and migration does not resurrect stale original events', () => {
  const prior = { ...coldTownEvent(), mode: 2 as const, artworkMode: 2 as const, participation: 1, weeksRemaining: 3,
    lastTick: 123, rodeoFrame: 3, rodeoX: 1, rodeoY: 1, animalType: 2 };
  assert.deepEqual(resetTownEvent(prior), { ...coldTownEvent(), artworkMode: 2, weeksRemaining: 3, rodeoX: 1, rodeoY: 1 });
  const { game } = fixture(), legacy = JSON.parse(game.save(5)); legacy.version = 25; delete legacy.runtime.townEvent;
  assert.deepEqual(readNativeSave(JSON.stringify(legacy)).state.townEvent, coldTownEvent());
  const current = JSON.parse(game.save(5)); delete current.runtime.townEvent;
  assert.throws(() => readNativeSave(JSON.stringify(current)));
});


test('top-level writer and reader reject event dialogs without their calendar continuation', () => {
  const { game } = fixture(), text = game.save(5), state = readNativeSave(text).state;
  state.townEvent.mode = 1; state.townEvent.pending = { kind: 'rodeo-entry' };
  assert.throws(() => writeNativeSave(state, 5), /town event continuation/);
  const invalid = JSON.parse(text); invalid.runtime.townEvent = state.townEvent;
  assert.throws(() => readNativeSave(JSON.stringify(invalid)), /town event continuation/);
  assert.deepEqual(JSON.parse(game.save(5)), JSON.parse(text));
});
