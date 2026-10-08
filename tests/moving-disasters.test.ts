import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { createMovingDisasters, validateMovingDisasters, beginMovingDisaster, stopMovingDisaster, advanceMovingDisasters } from '../src/simulation/moving-disasters';
import { FarmRandom } from '../src/simulation/random';
import { shopFixture } from './support/livestock';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const random = (visual = 1234, bounded = 99) => new FarmRandom({ visual, bounded, simulation: 7 });
function farm() {
  const f = shopFixture(), w = f.state.scenario, a = f.state.finances, d = createMovingDisasters(), r = random();
  const field = w.fields[1]; field.bytes[7] |= 1;
  field.bytes[10] = field.bytes[11] = 20; field.bytes[12] = field.bytes[13] = 8; field.bytes[2] = 4;
  new DataView(field.bytes.buffer, field.bytes.byteOffset).setUint16(18, 0, true);
  for (let x = 20; x < 28; x++) for (let y = 20; y < 28; y++) w.cells[worldIndex(x, y)].terrain = 688;
  return { w, a, d, r, field };
}

test('moving disaster modes, initial globals, strict clocks, start RNG, biased field selection and stop gates match original bytes', () => {
  const exe = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x36cf8, 'c4030e056206fc06f000e4017c028603'); exact(0x3708e, 'ec085809880abc0b8808a2089a08');
  exact(0x368ee, '9a7d00fd05253f00051000a39c699a7d00fd05253f00051000a39e699a7d00fd052401a2a0699a7d00fd052401a2a1699a7d00fd05a8017404f61ea0699a7d00fd05a8017404f61ea1698e06b0cb26a1a013a3a269');
  exact(0x1b818, 'ff363e3e9aa300fd0583c4028946fc0bc07505c746fc0100');
  exact(0x37179, '26a1a0132b06a8693b06b2697703e98502');
  exact(0x373f6, '26a1a013a3a8692b06b0693d000276096a040ee80af983c402');
  exact(0x36d9c, '8e06b0cb26a1a0132b06a2693d800773052bc0c9cb90');
  exact(0x37457, 'a0a0699801069c69a0a1699801069e691e689e691e689c699af41c360683c408');
  exact(0x374a4, '9a7d00fd05240f3c06752e9a7d00fd052401a2a0699a7d00fd052401a2a1699a7d00fd05a8017404f61ea0699a7d00fd05a8017404f61ea169');
  exact(0x36c60, '8e06b0cb26a1a013a3b069a3a869');
  const d = createMovingDisasters(), base = 0x846f0;
  assert.equal(d.enabled, Boolean(exe[base + 0x6995])); assert.equal(d.flags, exe[base + 0x6996]);
  assert.equal(d.frameDelay, exe.readUInt16LE(base + 0x69b2)); assert.equal(d.lastStartTick, exe.readUInt16LE(base + 0x69b4));
  for (const [kind, offset] of [['tornado', 0x6998], ['swarm', 0x69a6]] as const) {
    const e = d[kind]; assert.equal(e.frame, exe[base + offset]);
    for (const [key, delta] of [['lastTick', 2], ['x', 4], ['y', 6], ['startedTick', 10]] as const)
      assert.equal(e[key], exe.readUInt16LE(base + offset + delta));
    assert.equal(e.dx, exe.readInt8(base + offset + 8)); assert.equal(e.dy, exe.readInt8(base + offset + 9));
  }
  assert.equal(d.swarm.fieldSlot, exe.readUInt16LE(base + 0x69a4)); validateMovingDisasters(d);
});

test('every original farm starts a tornado with six visual calls, cancels a swarm and retains animation phase/clock', () => {
  for (let id = 0; id < 8; id++) {
    const w = readScenario(source(`SCEN${id}.SSM`)), d = createMovingDisasters(), r = random(1234 + id), expected = random(1234 + id);
    d.flags = 0x28; d.swarm.fieldSlot = 1; d.tornado.frame = 3; d.tornado.lastTick = 73;
    const x = (expected.nextVisual() & 63) + 16, y = (expected.nextVisual() & 63) + 16;
    let dx = expected.nextVisual() & 1, dy = expected.nextVisual() & 1;
    if (expected.nextVisual() & 1) dx = -dx; if (expected.nextVisual() & 1) dy = -dy;
    const before = JSON.stringify(w);
    assert.deepEqual(beginMovingDisaster(w, d, 'tornado', 65530, r), { ok: true, kind: 'tornado', cancelledSwarm: true });
    assert.deepEqual(d.tornado, { x, y, dx: dx || 0, dy: dy || 0, frame: 3, lastTick: 73, startedTick: 65530 });
    assert.equal(d.flags, 9); assert.equal(d.lastStartTick, 65530); assert.deepEqual(r.snapshot(), expected.snapshot());
    assert.equal(JSON.stringify(w), before);
  }
});

test('swarm selector traverses sparse records and retains the source first-field bias without selecting the last ordinal', () => {
  const { w } = farm();
  for (const slot of [5, 97]) { w.fields[slot].bytes.set(w.fields[1].bytes); w.fields[slot].bytes[10] = 30 + slot % 20; }
  const selected = new Set<number>();
  for (let seed = 0; seed < 256; seed++) {
    const d = createMovingDisasters(), r = random(777, seed), expected = random(777, seed);
    const slot = [1, 5, 97][Math.max(1, expected.below(3)) - 1];
    d.swarm.frame = 2; d.swarm.dx = -1;
    assert.ok(beginMovingDisaster(w, d, 'swarm', 65000, r).ok);
    assert.equal(d.swarm.fieldSlot, slot); selected.add(slot);
    assert.equal(d.swarm.x, w.fields[slot].x); assert.equal(d.swarm.frame, 2); assert.equal(d.swarm.dx, -1);
    assert.equal(d.swarm.lastTick, 65000); assert.equal(d.swarm.startedTick, 65000);
    assert.deepEqual(r.snapshot(), expected.snapshot());
  }
  assert.deepEqual([...selected].sort(), [1, 5]);
  for (const f of w.fields) f.bytes[7] &= ~1;
  const d = createMovingDisasters(), r = random(), before = r.snapshot();
  assert.deepEqual(beginMovingDisaster(w, d, 'swarm', 2, r), { ok: false, reason: 'no-fields' });
  assert.deepEqual(r.snapshot(), before); assert.deepEqual(d, createMovingDisasters());
});

test('swarm damages four original offsets before movement, adds real crop loss, retains removed-field bounds and expires only on an eligible frame', () => {
  const { w, a, d, r, field } = farm(); assert.ok(beginMovingDisaster(w, d, 'swarm', 0, r).ok);
  const beforeRng = r.snapshot();
  for (const tick of [4, 5, 10, 15]) assert.equal(advanceMovingDisasters(w, a, d, tick, 0, r).hits.length, 0);
  assert.deepEqual(r.snapshot(), beforeRng);
  const step = advanceMovingDisasters(w, a, d, 20, 0, r);
  assert.deepEqual(step.hits.map(h => [h.x, h.y]), [[21, 22], [22, 22], [21, 21], [20, 21]]);
  for (const h of step.hits) assert.equal(w.cells[worldIndex(h.x, h.y)].terrain, 36);
  assert.equal(new DataView(field.bytes.buffer, field.bytes.byteOffset).getUint16(18, true), 1024);
  assert.equal(field.state, 4); assert.equal(a.clearing.count, 0); assert.equal(d.swarm.frame, 0);
  field.bytes[7] &= ~1; d.enabled = false; // Does not cancel an active swarm or clear its record coordinates.
  for (let tick = 25; tick <= 510; tick += 5) {
    const step = advanceMovingDisasters(w, a, d, tick, 0, r); assert.equal(step.swarmEnded, false);
    assert.ok(d.swarm.x >= 20 && d.swarm.x <= 25 && d.swarm.y >= 20 && d.swarm.y <= 25);
  }
  assert.equal(advanceMovingDisasters(w, a, d, 513, 0, r).swarmEnded, false); // Only3 since last frame.
  assert.equal(advanceMovingDisasters(w, a, d, 515, 0, r).swarmEnded, true); assert.equal(d.flags & 32, 0);
  d.flags |= 32; d.swarm.lastTick = 507; d.swarm.startedTick = 0;
  assert.equal(advanceMovingDisasters(w, a, d, 512, 0, r).swarmEnded, false); // Age equality is not expiration.
  d.frameDelay = 0;
  assert.equal(advanceMovingDisasters(w, a, d, 513, 0, r).swarmEnded, true);
});

test('tornado moves before its hit, uses wrapping strict frame gates and bounds the origin without corrupting out-of-map damage', () => {
  const { w, a, d, field } = farm(), r = random(0); d.flags = 1;
  Object.assign(d.tornado, { frame: 3, lastTick: 65530, x: 20, y: 20, dx: 1, dy: 1 });
  assert.equal(advanceMovingDisasters(w, a, d, 65534, 0, r).hits.length, 0);
  let step = advanceMovingDisasters(w, a, d, 65535, 0, r);
  assert.deepEqual(step.hits.map(h => [h.x, h.y]), [[22, 23]]); assert.equal(w.cells[worldIndex(22, 23)].terrain, 36);
  assert.equal(new DataView(field.bytes.buffer, field.bytes.byteOffset).getUint16(18, true), 256);
  assert.deepEqual([d.tornado.x, d.tornado.y, d.tornado.frame], [21, 21, 0]);
  assert.equal(advanceMovingDisasters(w, a, d, 3, 0, r).advanced.length, 0);
  assert.deepEqual(advanceMovingDisasters(w, a, d, 4, 0, r).advanced, ['tornado']);
  Object.assign(d.tornado, { frame: 3, x: 95, y: 95, dx: 1, dy: 1 });
  const worldBefore = JSON.stringify(w);
  step = advanceMovingDisasters(w, a, d, 9, 0, r);
  assert.deepEqual(step.hits, [{ x: 96, y: 97, result: { ok: false, reason: 'outside-map' } }]);
  assert.equal(JSON.stringify(w), worldBefore); assert.deepEqual([d.tornado.x, d.tornado.y, d.tornado.dy], [95, 95, -1]);
  assert.equal(r.snapshot().simulation, 7); assert.equal(r.snapshot().bounded, 99);
});

test('tornado random direction can override the edge correction and consumes four extra visual calls only on low-nibble6', () => {
  const { w, a, d } = farm(); d.flags = 1;
  for (const seed of [1536, 1234, 4000, 65535]) {
    const r = random(seed), expected = random(seed);
    Object.assign(d.tornado, { frame: 3, lastTick: 0, x: 20, y: 87, dx: 1, dy: 1 });
    let dx = 1, dy = -1;
    if ((expected.nextVisual() & 15) === 6) {
      dx = expected.nextVisual() & 1; dy = expected.nextVisual() & 1;
      if (expected.nextVisual() & 1) dx = -dx; if (expected.nextVisual() & 1) dy = -dy;
    }
    advanceMovingDisasters(w, a, d, 5, 0, r);
    assert.equal(d.tornado.dx, dx || 0); assert.equal(d.tornado.dy, dy || 0); assert.deepEqual(r.snapshot(), expected.snapshot());
  }
  // Seed1536 yields low-nibble6 on the first source visual call.
  assert.equal(random(1536).nextVisual() & 15, 6);
});

test('disabled/conflicting starts are read-only, tornado stops require age1920, and a large elapsed gap runs one iteration', () => {
  const { w, a, d, r } = farm(); d.enabled = false;
  const rng = r.snapshot();
  assert.deepEqual(beginMovingDisaster(w, d, 'tornado', 0, r), { ok: false, reason: 'disabled' });
  d.enabled = true; assert.ok(beginMovingDisaster(w, d, 'tornado', 65530, r).ok);
  const started = structuredClone(d), afterStartRng = r.snapshot();
  assert.deepEqual(beginMovingDisaster(w, d, 'tornado', 0, r), { ok: false, reason: 'already-active' });
  assert.deepEqual(beginMovingDisaster(w, d, 'swarm', 0, r), { ok: false, reason: 'tornado-active' });
  assert.deepEqual(d, started); assert.deepEqual(r.snapshot(), afterStartRng); assert.notDeepEqual(rng, afterStartRng);
  assert.equal(stopMovingDisaster(d, 'tornado', 1913), false); assert.deepEqual(d, started);
  const step = advanceMovingDisasters(w, a, d, 1914, 0, r);
  assert.equal(step.advanced.length, 1); assert.equal(d.tornado.frame, 1); assert.equal(d.flags & 1, 1);
  assert.equal(stopMovingDisaster(d, 'tornado', 1914), true); assert.equal(d.flags & 1, 0);
  const retained = structuredClone(d.tornado); assert.ok(beginMovingDisaster(w, d, 'tornado', 1915, r).ok);
  assert.equal(d.tornado.frame, retained.frame); assert.equal(d.tornado.lastTick, retained.lastTick);
  for (const value of [-1, 65536, NaN, 0.5]) assert.throws(() => advanceMovingDisasters(w, a, d, value, 0, r), /tick/);
  for (const mutate of [(s: typeof d) => { s.flags = 33; }, (s: typeof d) => { s.swarm.frame = 4; },
    (s: typeof d) => { s.frameDelay = -1; }, (s: typeof d) => { s.tornado.x = 96; }]) {
    const bad = structuredClone(d); mutate(bad); assert.throws(() => validateMovingDisasters(bad));
  }
});
