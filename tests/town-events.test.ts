import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readTownConstructionState } from '../src/formats/town';
import { readTownEvent } from '../src/formats/town-event';
import { FarmRandom } from '../src/simulation/random';
import { beginTownCalendarEvent as begin, advanceTownEventWeek as week, resolveTownEventDialog as resolve, type TownEventState } from '../src/simulation/town-events';
const source = readFileSync(new URL('../../simfarm-dos/SCEN4.SSM', import.meta.url));
function setup(cash = 2000) {
  const world = readScenario(source); world.farm.cash = cash;
  for (const a of world.animals) a.flags = 0;
  const recreation = readTownConstructionState(source);
  recreation.recreationCount = 1; recreation.recreationCoordinates.set([8, 16]);
  const state: TownEventState = { ...readTownEvent(source), mode: 0, rodeoX: 0, rodeoY: 0, pending: null };
  const rng = new FarmRandom({ visual: 123, simulation: 1234, bounded: 456 });
  return { world, recreation, state, rng, accounts: { otherExpenses: 0 } };
}
function animal(f: ReturnType<typeof setup>, slot: number, type: number) {
  const a = f.world.animals[slot]; a.flags = 0x20;
  new DataView(a.bytes.buffer, a.bytes.byteOffset).setUint16(6, type, true);
}

test('fair uses the September rollover, random active livestock and charges only an accepted decision', () => {
  const f = setup(); animal(f, 4, 161); animal(f, 200, 163);
  const before = f.world.farm.cash;
  assert.deepEqual(begin(f.world, f.recreation, f.state, 8, 4, true, { below: n => { assert.equal(n, 2); return 1; } }), { artworkMode: 2, music: 'carnival' });
  assert.equal(f.state.animalType, 3); assert.deepEqual(f.state.pending, { kind: 'fair-entry' });
  assert.equal(f.state.weeksRemaining, 0); assert.equal(f.world.farm.cash, before);
  assert.deepEqual(week(f.world, f.recreation, f.state, f.rng), {});
  resolve(f.world, f.recreation, f.state, f.accounts, true);
  assert.equal(f.world.farm.cash, 1800); assert.equal(f.accounts.otherExpenses, 200);
  assert.equal(f.state.participation, 1); assert.equal(f.state.weeksRemaining, 3);
  for (let i = 0; i < 2; i++) week(f.world, f.recreation, f.state, f.rng);
  assert.equal(f.state.pending, null);
  week(f.world, f.recreation, f.state, { nextSimulation: () => 1 });
  assert.deepEqual(f.state.pending, { kind: 'fair-result', won: true, animalType: 3 });
  assert.equal(f.world.farm.cash, 1800);
  const farm = { ...f.world.farm };
  assert.deepEqual(resolve(f.world, f.recreation, f.state, f.accounts, true), { artworkMode: 0 });
  assert.deepEqual(f.world.farm, { ...farm, cash: 2800 });
  assert.equal(f.state.animalType, 255); assert.equal(f.state.participation, 1);
});

test('rodeo retains the source1000 eligibility threshold,500 stake and two-week outcomes', () => {
  for (const draw of [0, 1, 2, 3, 6]) {
    const f = setup(1000);
    assert.deepEqual(begin(f.world, f.recreation, f.state, 5, 4, true, f.rng), { artworkMode: 1, music: 'rodeo' });
    resolve(f.world, f.recreation, f.state, f.accounts, true);
    assert.equal(f.world.farm.cash, 500); assert.equal(f.state.participation, 1000);
    assert.equal(f.state.weeksRemaining, 2);
    week(f.world, f.recreation, f.state, f.rng); assert.equal(f.state.pending, null);
    week(f.world, f.recreation, f.state, { nextSimulation: () => draw });
    assert.deepEqual(f.state.pending, { kind: 'rodeo-result', won: (draw & 3) === 2, animalType: 0 });
    resolve(f.world, f.recreation, f.state, f.accounts, true);
    assert.equal(f.world.farm.cash, (draw & 3) === 2 ? 1500 : 500);
    assert.equal(f.accounts.otherExpenses, 500); assert.equal(f.state.mode, 0);
  }
  for (const cash of [0, 499, 500, 999]) {
    const f = setup(cash); const rng = f.rng.snapshot();
    assert.deepEqual(begin(f.world, f.recreation, f.state, 5, 4, true, f.rng), { artworkMode: 1 });
    assert.equal(f.state.mode, 0); assert.equal(f.state.pending, null);
    assert.equal(f.state.weeksRemaining, 0); assert.equal(f.world.farm.cash, cash);
    assert.deepEqual(f.rng.snapshot(), rng);
  }
});

test('Messages, calendar and recreation gates do not consume random state or open events', () => {
  for (const [month, w, messages, count] of [[8, 4, false, 1], [5, 4, false, 1], [9, 1, true, 1], [6, 1, true, 1], [8, 4, true, 0], [5, 4, true, 0]] as const) {
    const f = setup(); f.recreation.recreationCount = count;
    const before = structuredClone({ world: f.world.cells, state: f.state, rng: f.rng.snapshot() });
    assert.deepEqual(begin(f.world, f.recreation, f.state, month, w, messages, f.rng), {});
    assert.deepEqual({ world: f.world.cells, state: f.state, rng: f.rng.snapshot() }, before);
  }
});

test('announcement, decline and failed debit retain the distinct source participation writes', () => {
  for (const cash of [0, 199, 200]) {
    const f = setup(cash); if (cash < 200) animal(f, 1, 160);
    f.state.participation = 1000;
    assert.equal(begin(f.world, f.recreation, f.state, 8, 4, true, f.rng).music, 'carnival');
    assert.equal(f.state.pending?.kind, 'fair-announcement');
    resolve(f.world, f.recreation, f.state, f.accounts, true);
    assert.equal(f.state.animalType, 255); assert.equal(f.state.participation, 1000);
    for (let i = 0; i < 3; i++) week(f.world, f.recreation, f.state, { nextSimulation: () => { throw Error('Unexpected draw'); } });
    assert.equal(f.state.mode, 0); assert.equal(f.state.pending, null);
  }
  for (const accept of [true, false]) {
    const f = setup(); f.state.participation = 12;
    begin(f.world, f.recreation, f.state, 5, 4, true, f.rng);
    f.world.farm.cash = 0;
    resolve(f.world, f.recreation, f.state, f.accounts, accept);
    assert.equal(f.state.participation, accept ? 12 : 0);
    assert.equal(f.accounts.otherExpenses, 0); assert.equal(f.state.weeksRemaining, 2);
  }
});

test('fees wrap the original ledger and prizes obey cash cap without affecting sales', () => {
  const f = setup(); f.accounts.otherExpenses = 0xffffff00;
  begin(f.world, f.recreation, f.state, 5, 4, true, f.rng);
  resolve(f.world, f.recreation, f.state, f.accounts, true);
  assert.equal(f.accounts.otherExpenses, 244);
  f.state.weeksRemaining = 1;
  week(f.world, f.recreation, f.state, { nextSimulation: () => 2 });
  f.world.farm.cash = 9_999_500; const sales = f.world.farm.salesAccumulator;
  resolve(f.world, f.recreation, f.state, f.accounts, true);
  assert.equal(f.world.farm.cash, 9_999_999); assert.equal(f.world.farm.salesAccumulator, sales);
  assert.deepEqual(resolve(f.world, f.recreation, f.state, f.accounts, true), {});
});

test('fair loss consumes one result draw, pays nothing and clears selected species after acknowledgement', () => {
  const f = setup(); animal(f, 7, 160);
  begin(f.world, f.recreation, f.state, 8, 4, true, f.rng);
  resolve(f.world, f.recreation, f.state, f.accounts, true);
  f.state.weeksRemaining = 1; let draws = 0;
  week(f.world, f.recreation, f.state, { nextSimulation: () => { draws++; return 2; } });
  assert.deepEqual(f.state.pending, { kind: 'fair-result', won: false, animalType: 0 });
  week(f.world, f.recreation, f.state, { nextSimulation: () => { throw Error('Repeated result draw'); } });
  assert.deepEqual(begin(f.world, f.recreation, f.state, 5, 4, true, f.rng), {});
  assert.equal(draws, 1);
  resolve(f.world, f.recreation, f.state, f.accounts, true);
  assert.equal(f.world.farm.cash, 1800); assert.equal(f.state.animalType, 255);
});
