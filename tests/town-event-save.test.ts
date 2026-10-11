import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { decodeTownEventCheckpoint as decode, encodeTownEventCheckpoint as encode, type TownEventCheckpoint } from '../src/formats/town-event-save';
import { beginTownCalendarEvent, resolveTownEventDialog, advanceTownEventWeek } from '../src/simulation/town-events';
import { animateTownEventMap } from '../src/simulation/town-event-map';
import { FarmRandom } from '../src/simulation/random';
const initial = (): TownEventCheckpoint => ({ mode: 0, artworkMode: 1, rodeoFrame: 2, lastTick: 65532,
  rodeoX: 1, rodeoY: 0, animalType: 0, participation: 0, weeksRemaining: 0, pending: null });

test('event checkpoint preserves every dialog and differing mode/artwork without aliasing', () => {
  const samples: TownEventCheckpoint[] = [initial(),
    { ...initial(), mode: 2, artworkMode: 2, animalType: 255, pending: { kind: 'fair-announcement' } },
    { ...initial(), mode: 2, artworkMode: 2, pending: { kind: 'fair-entry' } },
    { ...initial(), mode: 1, pending: { kind: 'rodeo-entry' } },
    { ...initial(), mode: 2, artworkMode: 2, participation: 1, pending: { kind: 'fair-result', won: false, animalType: 0 } },
    { ...initial(), mode: 1, participation: 1000, pending: { kind: 'rodeo-result', won: true, animalType: 0 } }];
  for (const sample of samples) {
    const encoded = encode(sample), restored = decode(JSON.parse(JSON.stringify(encoded)));
    assert.deepEqual(restored, sample); assert.notEqual(encoded, sample); assert.notEqual(restored, encoded);
    if (sample.pending) assert.notEqual(encoded.pending, sample.pending);
  }
});

test('checkpoint at entry, active animation and result resumes without charging or drawing twice', () => {
  const bytes = readFileSync(new URL('../../simfarm-dos/SCEN4.SSM', import.meta.url));
  let state = initial(), rng = new FarmRandom({ visual: 123, simulation: 1234, bounded: 456 });
  const world = readScenario(bytes); world.farm.cash = 2000;
  const recreation = { recreationCount: 1, recreationCoordinates: new Uint8Array([8, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) };
  const accounts = { otherExpenses: 0 };
  const effects = beginTownCalendarEvent(world, recreation, state, 5, 4, true, rng);
  state.artworkMode = effects.artworkMode!;
  state = decode(JSON.parse(JSON.stringify(encode(state))));
  assert.equal(world.farm.cash, 2000);
  resolveTownEventDialog(world, recreation, state, accounts, true);
  animateTownEventMap(world, recreation, state, 4, rng);
  const saved = JSON.parse(JSON.stringify(encode(state))), randomState = rng.snapshot();
  const expectedWorld = readScenario(bytes); expectedWorld.cells = structuredClone(world.cells); expectedWorld.farm = structuredClone(world.farm);
  const expectedState = structuredClone(state), expectedRandom = new FarmRandom(randomState);
  state = decode(saved); rng = new FarmRandom(randomState);
  for (const tick of [12, 20, 28]) {
    animateTownEventMap(world, recreation, state, tick, rng);
    animateTownEventMap(expectedWorld, recreation, expectedState, tick, expectedRandom);
  }
  assert.deepEqual(world.cells, expectedWorld.cells); assert.deepEqual(state, expectedState); assert.deepEqual(rng.snapshot(), expectedRandom.snapshot());
  advanceTownEventWeek(world, recreation, state, rng);
  advanceTownEventWeek(world, recreation, state, { nextSimulation: () => 2 });
  state = decode(JSON.parse(JSON.stringify(encode(state))));
  assert.equal(world.farm.cash, 1500);
  resolveTownEventDialog(world, recreation, state, accounts, true);
  assert.equal(world.farm.cash, 2500); assert.equal(accounts.otherExpenses, 500);
  resolveTownEventDialog(world, recreation, state, accounts, true);
  assert.equal(world.farm.cash, 2500);
});

test('malformed event checkpoints reject missing fields, invalid ranges and incompatible pending decisions', () => {
  for (const key of Object.keys(initial())) { const o: Record<string, unknown> = { ...initial() }; delete o[key]; assert.throws(() => decode(o)); }
  for (const [key, value] of [['mode', 3], ['artworkMode', -1], ['rodeoFrame', 4], ['lastTick', 65536], ['rodeoX', 2], ['rodeoY', NaN], ['animalType', 4], ['participation', -1], ['weeksRemaining', 256], ['pending', {}]])
    assert.throws(() => decode({ ...initial(), [key as string]: value }));
  for (const pending of [{ kind: 'fair-entry' }, { kind: 'unknown' }, { kind: 'rodeo-result', won: 1, animalType: 0 }])
    assert.throws(() => decode({ ...initial(), pending }));
  assert.throws(() => decode({ ...initial(), mode: 1, participation: 1000, weeksRemaining: 1, pending: { kind: 'rodeo-result', won: true, animalType: 0 } }));
});
