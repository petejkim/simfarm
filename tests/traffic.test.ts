import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createTrafficState, readTrafficDefaults } from '../src/formats/traffic';
import { worldIndex } from '../src/formats/scenario';
import { planTrafficStep, advanceTrafficVehicle, advanceTraffic, removeTraffic } from '../src/simulation/traffic';
import { allocateTraffic } from '../src/simulation/starting-traffic';
import { FarmRandom } from '../src/simulation/random';
import { shopFixture } from './support/livestock';
import type { EquipmentRuntime } from '../src/simulation/equipment-world';
const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
const fresh = () => createTrafficState(readTrafficDefaults(exe));
const runtime = (tick = 16): EquipmentRuntime => ({ animationTick: tick, grassTravelCount: 0, notices: [] });
const random = () => new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const frame = (s: ReturnType<typeof fresh>) => ({ ...s, records: s.records.map(r => [...r.bytes]) });
function fixture() {
  const world = shopFixture().state.scenario;
  for (const c of world.cells) { c.terrain = 15; c.overlay = 0; c.attribute = 173; }
  return world;
}

test('traffic direction tables, retry count, road gates, occupancy and clocks are pinned to source bytes', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x865ca, '00010102010202030102020302030304'); exact(0x865da, '01020408'); exact(0x865e2, '04080102');
  exact(0x86964, '00ff01ff010001010001ff01ff00ffff'); exact(0x89d86, '04000b008000220005000b00ffffffff');
  exact(0xd67a, '9a7d00fd05a8017446807efc017c40');
  exact(0xd7d4, '8346f6028366f607fe46fe8b46f63946067409807efe047f03e947fe2bc0');
  exact(0xd803, '26833e862201741b8e06a4c626a1a0132b0690208e06e6c6263b06862273042bc0c9cb');
  exact(0xd2ac, 'f687fc1e01740980a7fc1efefe0efa1e');
  exact(0xd7a4, '8e06e0c626f687254c087524');
  exact(0xd3c1, '8e0670c62680a72504f78e06e0c62681a7244c00f8');
  exact(0x13572, '26808f026408'); // OR8: collision must preserve breeding bit2.
});

test('every tile and overlay ownership flag follows paved/bridge/dirt destination gates', () => {
  const w = fixture(), target = w.cells[worldIndex(21, 20)];
  for (let tile = 0; tile < 2048; tile++) for (const overlay of [0x7000, 0xf800]) {
    target.terrain = 0xf800 | tile; target.overlay = overlay;
    let calls = 0;
    const route = planTrafficStep(w, 20, 20, 2, { nextVisual: () => { calls++; return 0; } });
    const accepted = tile >= 150 && tile < 161 || tile >= 172 && tile < 174 || tile >= 161 && tile < 172 && !(overlay & 0x800);
    assert.deepEqual(route, accepted ? { x: 21, y: 20, heading: 2 } : null, `${tile}/${overlay}`);
    assert.equal(calls, accepted ? 1 : 4); // Terrain occupancy doesn't veto routing.
  }
});

test('all road masks and headings preserve reverse exclusion, random circular selection and conditional draws', () => {
  const w = fixture();
  for (let mask = 0; mask < 16; mask++) for (let heading = 0; heading < 8; heading++) for (let selected = 0; selected < 4; selected++) {
    directions.forEach(([dx, dy], side) => { w.cells[worldIndex(20 + dx, 20 + dy)].terrain = mask & 1 << side ? 150 : 15; });
    let calls = 0;
    const route = planTrafficStep(w, 20, 20, heading, { nextVisual: () => calls++ % 2 ? selected : 1 });
    if (!mask) { assert.equal(route, null); assert.equal(calls, 4); continue; }
    const reverse = ((heading >> 1) + 2) % 4, eligible = mask & (mask.toString(2).replaceAll('0', '').length > 1 ? ~(1 << reverse) : 15);
    let side = selected; while (!(eligible & 1 << side)) side = (side + 1) % 4;
    assert.deepEqual(route, { x: 20 + directions[side][0], y: 20 + directions[side][1], heading: side * 2 });
    assert.equal(calls, 2);
  }
});

test('retry reselection permits five attempts, diagonal headings survive fallback, and map edges clamp', () => {
  const w = fixture(); let calls = 0;
  // A road enters the neighbor mask but its overlay makes it unavailable.
  w.cells[worldIndex(21, 20)].terrain = 161; w.cells[worldIndex(21, 20)].overlay = 0x800;
  assert.equal(planTrafficStep(w, 20, 20, 0, { nextVisual: () => { calls++; return 1; } }), null);
  assert.equal(calls, 10); // Five random reselections reset the reference heading.
  w.cells[worldIndex(19, 21)].terrain = 172;
  calls = 0; assert.deepEqual(planTrafficStep(w, 20, 20, 1, { nextVisual: () => { calls++; return 0; } }), { x: 19, y: 21, heading: 5 });
  assert.equal(calls, 3);
  for (const [x, y, heading] of [[0, 0, 0], [95, 95, 2], [95, 95, 4], [0, 0, 6]]) {
    w.cells[worldIndex(x, y)].terrain = 150;
    assert.deepEqual(planTrafficStep(w, x, y, heading, { nextVisual: () => 0 }), { x, y, heading });
  }
});

test('visible traffic clears only source occupancy/image bits, paints all variants/headings and retains record payload', () => {
  const w = fixture();
  for (let heading = 0; heading < 8; heading++) for (let variant = 0; variant < 4; variant++) {
    const s = fresh(); allocateTraffic(s, 20, 20, heading, { nextVisual: () => variant });
    const record = s.records[0]; record.bytes[0] |= 0xf0; record.bytes[1] = 173;
    const dx = [0, 1, 1, 1, 0, -1, -1, -1][heading], dy = [-1, -1, 0, 1, 1, 1, 0, -1][heading];
    const origin = w.cells[worldIndex(20, 20)], destination = w.cells[worldIndex(20 + dx, 20 + dy)];
    origin.terrain = 0xf800 | 150; origin.overlay = 0xe800 | 916;
    destination.terrain = 0x7000 | 150; destination.overlay = 0xf800 | 201;
    assert.deepEqual(advanceTrafficVehicle(w, s, 0, { nextVisual: () => 0 }, runtime()), { x: 20 + dx, y: 20 + dy, heading, slot: 0, kind: 'painted' });
    assert.equal(origin.terrain, 0xf000 | 150); assert.equal(origin.overlay, 0xe800);
    assert.equal(destination.terrain, 0x7800 | 150); assert.equal(destination.overlay, 0xf800 | 916 + variant * 4 + (heading >> 1));
    assert.deepEqual([...record.bytes], [0xf3, 173, 20 + dx, 0, 20 + dy, 0, heading, variant]);
    assert.equal(s.activeCount, 1); assert.equal(destination.attribute, 173);
    destination.terrain = 15; destination.overlay = 0;
  }
});

test('traffic moves through occupied cells while hidden, but only drawn vehicles hit livestock and preserve breeding eligibility', () => {
  const w = fixture(), s = fresh(), r = runtime(65535), a = w.animals[1];
  allocateTraffic(s, 20, 20, 2, { nextVisual: () => 0 });
  a.bytes[0] = 21; a.bytes[1] = 20; a.flags = 0x23;
  for (let x = 20; x <= 23; x++) w.cells[worldIndex(x, 20)].terrain = 150;
  const occupied = w.cells[worldIndex(21, 20)]; occupied.terrain |= 0x800; occupied.overlay = 0x4000 | 980;
  const once = () => advanceTrafficVehicle(w, s, 0, { nextVisual: () => 0 }, r);
  assert.equal(once()?.kind, 'hidden'); assert.equal(s.records[0].x, 21); assert.equal(s.records[0].flags, 1);
  assert.equal(a.flags, 0x2b); assert.equal(a.bytes[30] | a.bytes[31] << 8, 65535); assert.equal(occupied.overlay, 0x4000 | 1040);
  assert.deepEqual(r.notices, [{ type: 'animal-hit', slot: 1 }]);
  const next = w.cells[worldIndex(22, 20)]; next.terrain |= 0x800; next.overlay = 946;
  a.flags = 0x22; a.bytes[0] = 22;
  assert.equal(once()?.kind, 'hidden'); assert.equal(s.records[0].x, 22); assert.equal(next.overlay, 946); assert.equal(a.flags, 0x22);
  assert.equal(once()?.kind, 'painted'); assert.equal(s.records[0].x, 23); assert.equal(s.records[0].flags, 3);
  assert.equal(occupied.overlay, 0x4000 | 1040); assert.equal(next.overlay, 946); assert.equal(r.notices.length, 1);
});

test('route failure removes exactly one active record without clearing payload, while scans retain later sparse slots', () => {
  const w = fixture(), s = fresh(), r = runtime();
  for (let i = 0; i < 16; i++) allocateTraffic(s, 20, 20, 2, { nextVisual: () => 0 });
  for (let i = 1; i < 15; i++) removeTraffic(s, i);
  assert.equal(removeTraffic(s, 1), false); s.records[0].bytes[1] = 173;
  const before = [...s.records[0].bytes]; before[0] &= ~1;
  w.cells[worldIndex(20, 20)].terrain = 0x8800 | 15; w.cells[worldIndex(20, 20)].overlay = 0xf800 | 916;
  let draws = 0; const updates = advanceTraffic(w, s, { nextVisual: () => { draws++; return 0; } }, r);
  assert.deepEqual(updates.map(u => [u.slot, u.kind]), [[0, 'removed'], [15, 'removed']]);
  assert.deepEqual([...s.records[0].bytes], before); assert.equal(s.activeCount, 0); assert.equal(draws, 8);
  assert.equal(w.cells[worldIndex(20, 20)].terrain, 0x8000 | 15); assert.equal(w.cells[worldIndex(20, 20)].overlay, 0xf800);
  assert.equal(s.lastTick, 16);
});

test('traffic timing uses unsigned elapsed, delay1 bypass, ordered occupancy and no catch-up', () => {
  const w = fixture(); for (const c of w.cells) c.terrain = 150;
  for (const [last, tick, delay, expected] of [[0, 15, 16, false], [0, 16, 16, true], [65530, 10, 16, true], [16, 16, 1, true], [0, 0, 0, true], [100, 99, 65535, true]] as const) {
    const s = fresh(); s.lastTick = last; s.delay = delay; allocateTraffic(s, 20, 20, 2, { nextVisual: () => 0 });
    let draws = 0; const result = advanceTraffic(w, s, { nextVisual: () => { draws++; return 0; } }, runtime(tick));
    assert.equal(result.length, expected ? 1 : 0); assert.equal(s.records[0].x, expected ? 21 : 20);
    assert.equal(s.lastTick, expected ? tick : last); assert.equal(draws, expected ? 1 : 0);
    for (const c of w.cells) { c.terrain = 150; c.overlay = 0; }
  }
  const s = fresh(); allocateTraffic(s, 20, 20, 2, { nextVisual: () => 0 }); allocateTraffic(s, 20, 20, 2, { nextVisual: () => 0 });
  assert.deepEqual(advanceTraffic(w, s, { nextVisual: () => 0 }, runtime(1600)).map(r => r.kind), ['painted', 'hidden']);
  assert.deepEqual(s.records.slice(0, 2).map(r => r.x), [21, 21]); // One move, not100 elapsed rounds.
  const empty = fresh(); advanceTraffic(w, empty, { nextVisual: () => { throw Error('No active draws'); } }, runtime(16));
  assert.equal(empty.lastTick, 16);
});

test('detached traffic records, occupied map and visual RNG continue exactly after repeated checkpoints', () => {
  const a = fixture(), b = fixture();
  for (const w of [a, b]) for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) if (x % 8 === 0 || y % 8 === 0) w.cells[worldIndex(x, y)].terrain = 150;
  let s = fresh(), rng = random(); const control = fresh(), expected = random();
  for (let i = 0; i < 8; i++) { allocateTraffic(s, 16, 16, 4, rng); allocateTraffic(control, 16, 16, 4, expected); }
  for (let tick = 0; tick < 600; tick += 7) {
    assert.deepEqual(advanceTraffic(a, s, rng, runtime(tick)), advanceTraffic(b, control, expected, runtime(tick)));
    assert.deepEqual(frame(s), frame(control)); assert.deepEqual(a.cells, b.cells); assert.deepEqual(rng.snapshot(), expected.snapshot());
    s = createTrafficState(JSON.parse(JSON.stringify(frame(s)))); rng = new FarmRandom(rng.snapshot());
  }
  assert.equal(rng.snapshot().simulation, 9029); assert.equal(rng.snapshot().bounded, 51);
});

test('invalid traffic inputs reject before map, record or RNG mutation', () => {
  const w = fixture(), s = fresh(), r = runtime(), rng = random(); allocateTraffic(s, 20, 20, 0, rng);
  const before = frame(s), cells = structuredClone(w.cells), seed = rng.snapshot();
  for (const slot of [-1, 16, NaN, 0.5]) assert.throws(() => advanceTrafficVehicle(w, s, slot, rng, r), /traffic/);
  for (const tick of [-1, 65536, NaN, 0.5]) assert.throws(() => advanceTraffic(w, s, rng, runtime(tick)), /traffic/);
  for (const heading of [-1, 8, NaN, 0.5]) assert.throws(() => planTrafficStep(w, 20, 20, heading, rng), /traffic/);
  assert.throws(() => advanceTraffic(w, { ...s, activeCount: 0 }, rng, r), /count/);
  assert.throws(() => advanceTraffic({ ...w, cells: w.cells.slice(1) }, s, rng, r), /traffic/);
  assert.deepEqual(frame(s), before); assert.deepEqual(w.cells, cells); assert.deepEqual(rng.snapshot(), seed);
});
