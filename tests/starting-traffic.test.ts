import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createTrafficState, readTrafficDefaults, TrafficRecord, validateTraffic } from '../src/formats/traffic';
import { allocateTraffic, initializeStartingTraffic, resetTrafficRecords } from '../src/simulation/starting-traffic';
import { FarmRandom } from '../src/simulation/random';
import { initializeWeather } from '../src/simulation/weather';
import { createStartupCalendar } from '../src/simulation/starting-environment';
import { initializeStartingMarket } from '../src/simulation/starting-market';

const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
const defaults = readTrafficDefaults(exe);
const fresh = () => createTrafficState(defaults);
const random = () => new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });
const bytes = (s: ReturnType<typeof fresh>) => s.records.map(r => [...r.bytes]);

test('startup traffic counts, slots, variant draws and partial reset are pinned to source bytes', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0xd2c9, 'c606fa1e00c746fe00008b5efec1e303c687fc1e00ff46fe837efe107cec');
  exact(0xd2f7, '803efa1e107c062bc0');
  exact(0xd31c, 'f687fc1e0175e7808ffc1e038b4e06898ffe1e8b4e08898f001f8a4e0a888f021f8bf08bfb9a7d00fd0524038885031ffe06fa1e8bc65e5fc9cb');
  exact(0x2560, 'c746be00006a048e0600c626a130d5c1e003508e0602c626a19275c1e003509a3a16ab0983c406ff46be837ebe087cd5');
  exact(0xd54c, '8a46ee988bc805e500c1e0028b56fad1fa03c28e06e0c68bf0268aa7254c2500f80bf02689b7244c');
});

test('cold decoder retains all128 record bytes, independent count and timing globals, and detached unknown bytes', () => {
  assert.deepEqual(defaults, { records: Array.from({ length: 16 }, () => Array(8).fill(0)), activeCount: 0, delay: 16, lastTick: 0 });
  const changed = Buffer.from(exe);
  for (let i = 0; i < 128; i++) changed[0x865ec + i] = i * 7 & 255;
  changed[0x865ea] = 249; changed.writeUInt16LE(65535, 0x86976); changed.writeUInt16LE(32768, 0x86780);
  const decoded = readTrafficDefaults(changed);
  assert.deepEqual(decoded.records.flat(), Array.from(changed.subarray(0x865ec, 0x8666c)));
  assert.equal(decoded.activeCount, 249); assert.equal(decoded.delay, 65535); assert.equal(decoded.lastTick, 32768);
  assert.throws(() => createTrafficState(decoded), /traffic/); // Preserve source bits, reject unsafe live state.
  const state = fresh(); state.records[0].bytes[1] = 233;
  assert.equal(defaults.records[0][1], 0); assert.equal(exe[0x865ed], 0);
  assert.throws(() => readTrafficDefaults(exe.subarray(0, -1)), /executable/);
  changed[0] = 0; assert.throws(() => readTrafficDefaults(changed), /executable/);
  const backing = new Uint8Array(18); backing.set([3, 99, 95, 0, 7, 0, 6, 2], 5);
  const r = new TrafficRecord(0, backing.subarray(5, 13));
  assert.deepEqual([r.active, r.flags, r.x, r.y, r.heading, r.variant], [true, 3, 95, 7, 6, 2]);
});

test('first-fit allocation includes slot0, retains flag bits/unknown byte and consumes exactly one variant draw', () => {
  const state = fresh(), rng = random(), expected = random();
  for (const r of state.records) { r.bytes.fill(201); r.bytes[0] = 0xa8; }
  for (let i = 0; i < 16; i++) {
    const variant = expected.nextVisual() & 3;
    assert.equal(allocateTraffic(state, i * 6, 95 - i, i % 8, rng), i);
    assert.deepEqual([...state.records[i].bytes], [0xab, 201, i * 6, 0, 95 - i, 0, i % 8, variant]);
    assert.equal(state.activeCount, i + 1); assert.deepEqual(rng.snapshot(), expected.snapshot());
  }
  const before = bytes(state), seed = rng.snapshot();
  assert.equal(allocateTraffic(state, 0, 0, 0, rng), null);
  assert.deepEqual(bytes(state), before); assert.deepEqual(rng.snapshot(), seed);
  // A hole is chosen before a higher slot, independent of stale payload.
  state.records[5].bytes[0] &= 0xfe; state.activeCount--;
  assert.equal(allocateTraffic(state, 95, 95, 4, rng), 5);
  assert.equal(state.records[5].bytes[1], 201);
});

test('reset clears only flags/count, preserving seven payload bytes and both clocks', () => {
  const state = fresh(); initializeStartingTraffic(state, { regionX: 4, regionY: 6 }, random());
  for (const r of state.records) r.bytes[1] = 100 + r.slot;
  state.lastTick = 65535; state.delay = 1;
  const before = bytes(state); resetTrafficRecords(state);
  assert.equal(state.activeCount, 0); assert.equal(state.delay, 1); assert.equal(state.lastTick, 65535);
  for (let i = 0; i < 16; i++) assert.deepEqual([...state.records[i].bytes], [0, ...before[i].slice(1)]);
  resetTrafficRecords(state); assert.ok(state.records.every(r => !r.active));
});

test('all town coordinates start eight heading4 vehicles after weather, including exact resumed RNG and partial capacity', () => {
  for (let regionX = 0; regionX < 12; regionX++) for (let regionY = 0; regionY < 12; regionY++) {
    const state = fresh(), rng = random();
    // Prior startup dependencies use separate streams but weather also consumes visual draws.
    initializeStartingMarket(Array(16).fill(150), 0, rng);
    const climate = { temperature: Array(240).fill(55), precipitation: Array(240).fill(3), wind: Array(240).fill(5) };
    initializeWeather(climate, createStartupCalendar({ year: 1992, dayOfWeek: 1 }), 0, rng, [], 4);
    const before = rng.snapshot(), expected = new FarmRandom(before), variants = Array.from({ length: 8 }, () => expected.nextVisual() & 3);
    assert.deepEqual(initializeStartingTraffic(state, { regionX, regionY }, rng), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(state.records.slice(0, 8).map(r => [r.x, r.y, r.heading, r.variant]), variants.map(v => [regionX * 8, regionY * 8, 4, v]));
    assert.deepEqual(rng.snapshot(), expected.snapshot()); assert.equal(rng.snapshot().simulation, before.simulation); assert.equal(rng.snapshot().bounded, before.bounded);
    const restored = createTrafficState({ ...state, records: bytes(state) });
    assert.deepEqual(bytes(restored), bytes(state));
    const resumed = new FarmRandom(rng.snapshot());
    initializeStartingTraffic(restored, { regionX, regionY }, resumed);
    initializeStartingTraffic(state, { regionX, regionY }, rng);
    assert.deepEqual(bytes(restored), bytes(state)); assert.deepEqual(resumed.snapshot(), rng.snapshot());
  }
  for (const count of [9, 15, 16]) {
    const state = fresh(), rng = random();
    for (let i = 0; i < count; i++) allocateTraffic(state, 0, 0, 0, rng);
    const expected = new FarmRandom(rng.snapshot()); for (let i = count; i < 16; i++) expected.nextVisual();
    assert.equal(initializeStartingTraffic(state, { regionX: 11, regionY: 11 }, rng).length, 16 - count);
    assert.equal(state.activeCount, 16); assert.deepEqual(rng.snapshot(), expected.snapshot());
  }
});

test('malformed counters, byte tables, active fields and positions fail before allocation or random mutation', () => {
  const state = fresh(), rng = random(), before = bytes(state), seed = rng.snapshot();
  for (const x of [-1, 96, NaN, 0.5]) assert.throws(() => allocateTraffic(state, x, 0, 0, rng), /placement/);
  for (const heading of [-1, 8, NaN]) assert.throws(() => allocateTraffic(state, 0, 0, heading, rng), /placement/);
  assert.throws(() => initializeStartingTraffic(state, { regionX: 12, regionY: 0 }, rng), /town/);
  state.activeCount = 1; assert.throws(() => allocateTraffic(state, 0, 0, 0, rng), /count/);
  for (const count of [-1, 17, 127, 128, 255]) { state.activeCount = count; assert.throws(() => allocateTraffic(state, 0, 0, 0, rng), /state/); }
  state.activeCount = 0; assert.deepEqual(bytes(state), before); assert.deepEqual(rng.snapshot(), seed);
  for (const input of [{ ...defaults, records: [] }, { ...defaults, records: new Array(16) },
    { ...defaults, records: defaults.records.map((r, i) => i ? r : [0, 256, 0, 0, 0, 0, 0, 0]) }]) assert.throws(() => createTrafficState(input), /traffic/);
  allocateTraffic(state, 0, 0, 0, rng);
  for (const [offset, value] of [[2, 96], [3, 1], [4, 96], [6, 8], [7, 4]]) {
    const old = state.records[0].bytes[offset]; state.records[0].bytes[offset] = value;
    assert.throws(() => validateTraffic(state), /active traffic/); state.records[0].bytes[offset] = old;
  }
});
