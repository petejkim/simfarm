import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { worldIndex } from '../src/formats/scenario';
import { changeTownEventMap, animateTownEventMap, type TownEventAnimation } from '../src/simulation/town-event-map';
import { FarmRandom } from '../src/simulation/random';
function setup(count = 1) {
  return {
    world: { cells: Array.from({ length: 9216 }, () => ({ terrain: 0xfaaa, overlay: 0xd555, attribute: 19 })) },
    recreation: { recreationCount: count, recreationCoordinates: new Uint8Array([8, 16, 32, 40, 64, 72, 80, 80, 0, 0, 0, 0, 0, 0, 255, 255]) },
    state: { mode: 0, lastTick: 0, rodeoFrame: 0, rodeoX: 0, rodeoY: 0 } as TownEventAnimation,
  };
}
const random = () => new FarmRandom({ visual: 123, simulation: 1234, bounded: 456 });
const positions = [[3, 2], [2, 1], [1, 3], [1, 5], [3, 3], [5, 2]];

test('recreation map instructions pin eight-tick cadence, random stream, overlay and full-word terrain writes', () => {
  const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
  const pin = (a: number, h: string) => assert.equal(exe.subarray(a, a + h.length / 2).toString('hex'), h);
  assert.equal(createHash('sha256').update(exe.subarray(0xdd3e, 0xdf47)).digest('hex'), '263afb0abaa09ebb65cf89d843b39ec13d5507b834122e06d91fb8c26751957b');
  pin(0xdd70, '3d0800'); pin(0xde66, '3d0800');
  pin(0xddc2, 'fe06d61e8026d61e03'); pin(0xdde1, '9a7d00fd0525070005a903');
  pin(0xde0c, '2500f80bc1'); pin(0xde2f, '26808f250408');
  pin(0xdf0f, '26c787a6050e02'); pin(0xdf16, '26c787e4040f02');
  pin(0xdf42, 'a3d41e');
});

test('all event transitions restore exact source cells, retain overlays and do not reset animation globals', () => {
  for (const old of [0, 1, 2] as const) for (const next of [0, 1, 2] as const) {
    const { world, recreation, state } = setup(2); state.mode = old; state.lastTick = 123; state.rodeoFrame = 3;
    const expected = structuredClone(world);
    for (const [x, y] of [[8, 16], [32, 40]]) {
      if (old === 1) for (let dx = 2; dx < 4; dx++) for (let dy = 3; dy < 5; dy++)
        expected.cells[worldIndex(x + dx, y + dy)].terrain &= 0xf7ff;
      if (old === 2 || next === 0) positions.forEach(([dx, dy], i) => {
        expected.cells[worldIndex(x + dx, y + dy)].terrain = [492, 484, 497, 511, 499, 494][i];
      });
    }
    assert.equal(changeTownEventMap(world, recreation, state, next), true);
    assert.deepEqual(world, expected);
    assert.deepEqual(state, { mode: next, lastTick: 123, rodeoFrame: 3, rodeoX: 0, rodeoY: 0 });
  }
});

test('fair animation uses one simulation draw per district and retains the source cleanup/frame difference', () => {
  const { world, recreation, state } = setup(2); state.mode = 2;
  const rng = random(), reference = random(), before = structuredClone(world);
  for (const tick of [8, 16, 24, 32]) {
    const expected = structuredClone(world);
    for (const [x, y] of [[8, 16], [32, 40]]) {
      const tiles = reference.nextSimulation() & 1 ? [526, 527, 528, 528, 529, 529] : [492, 484, 497, 511, 494, 499];
      positions.forEach(([dx, dy], i) => { expected.cells[worldIndex(x + dx, y + dy)].terrain = tiles[i]; });
    }
    assert.equal(animateTownEventMap(world, recreation, state, tick, rng), true);
    assert.deepEqual(world, expected); assert.deepEqual(rng.snapshot(), reference.snapshot());
  }
  assert.equal(state.lastTick, 32);
  assert.deepEqual(world.cells.map(c => [c.overlay, c.attribute]), before.cells.map(c => [c.overlay, c.attribute]));
});

test('rodeo phase is shared across districts, draws position only on wrap and clears old overlay visibility', () => {
  const { world, recreation, state } = setup(2); state.mode = 1; state.rodeoFrame = 2;
  const draws = [7, 1, 0, 2]; let index = 0;
  assert.equal(animateTownEventMap(world, recreation, state, 8, { nextSimulation: () => draws[index++] }), true);
  assert.equal(index, 4); assert.equal(state.rodeoFrame, 0);
  assert.equal(state.rodeoX, 1); assert.equal(state.rodeoY, 0);
  for (const [x, y, px, py, tile] of [[8, 16, 0, 0, 944], [32, 40, 1, 0, 939]]) {
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
      const cell = world.cells[worldIndex(x + 2 + dx, y + 3 + dy)], active = dx === px && dy === py;
      assert.equal(cell.terrain, active ? 0xfaaa : 0xf2aa);
      assert.equal(cell.overlay, active ? 0xd000 | tile : 0xd555);
      assert.equal(cell.attribute, 19);
    }
  }
});

test('tick wrapping, inactive gates and malformed later districts do not consume RNG or partially mutate maps', () => {
  const { world, recreation, state } = setup(2), rng = random();
  state.mode = 2; state.lastTick = 65532;
  const before = structuredClone(world), randomBefore = rng.snapshot();
  assert.equal(animateTownEventMap(world, recreation, state, 3, rng), false);
  assert.deepEqual(world, before); assert.deepEqual(rng.snapshot(), randomBefore);
  assert.equal(animateTownEventMap(world, recreation, state, 4, rng), true);
  state.mode = 0;
  const unchanged = structuredClone({ world, state }), unchangedRandom = rng.snapshot();
  assert.equal(animateTownEventMap(world, recreation, state, 100, rng), false);
  recreation.recreationCount = 0;
  assert.equal(changeTownEventMap(world, recreation, state, 1), false);
  assert.equal(animateTownEventMap(world, recreation, state, 100, rng), false);
  recreation.recreationCount = 2; recreation.recreationCoordinates[2] = 255;
  assert.throws(() => changeTownEventMap(world, recreation, state, 2));
  assert.throws(() => animateTownEventMap(world, recreation, state, 100, rng));
  assert.deepEqual({ world, state }, unchanged); assert.deepEqual(rng.snapshot(), unchangedRandom);
  recreation.recreationCoordinates[2] = 32;
  for (const count of [-1, 8, 255, NaN]) {
    recreation.recreationCount = count;
    assert.throws(() => changeTownEventMap(world, recreation, state, 0));
  }
});
