import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aircraftFixture } from './support/aircraft';
import { purchaseAircraft, aircraftFuel, aircraftPayload } from '../src/simulation/aircraft';
import { advanceFlight, beginFlight, flightPosition, moveFlight } from '../src/simulation/aircraft-flight';
import { worldIndex } from '../src/formats/scenario';
function setup(columns = 20, rows = 16) {
  const f = aircraftFixture(), w = f.state.scenario, a = f.state.finances;
  const result = purchaseAircraft(w, a); assert.ok(result.ok);
  const e = w.equipment[result.slot], v = new DataView(e.bytes.buffer, e.bytes.byteOffset, e.bytes.length);
  v.setUint16(20, 255, true); v.setUint16(32, 255, true); v.setUint16(34, 221, true);
  const start = beginFlight(w, a, e.slot, columns, rows, 2, true); assert.ok(start.ok);
  return { ...f, w, a, e, v, flight: start.flight, cropsRaw: f.crops.map(c => [...c.rawDefinition]) };
}
const frame = (f: ReturnType<typeof setup>, tick: number) => advanceFlight(f.w, f.a, f.cropsRaw, f.flight, tick);

test('flight evidence pins BIOS extended keys, motion table, interval gates and NW wrong-axis instruction', () => {
  const b = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
  const exact = (o: number, h: string) => assert.equal(b.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x6326, 'b401cd16'); exact(0x6341, 'b400cd16');
  exact(0x31053, '2b46e83d020072f0'); exact(0x31131, '2b46c83d20007620'); exact(0x3119a, '2b46c63d08007627');
  exact(0x31274, '900b1a0cb80bb20b800bc80b8a0be20bc80b1a0cce0b');
  exact(0x314b2, '220c5c0c080dcc0c140d5a0dca0dd20d');
  exact(0x31493, 'ff4ef63b46f67e278a46ec98f7d8');
});

test('takeoff retains equipment/home/account bytes, clears soil with source formula and centres viewport; rejected takeoff is atomic', () => {
  const f = aircraftFixture(), w = f.state.scenario, a = f.state.finances;
  const p = purchaseAircraft(w, a); assert.ok(p.ok); const e = w.equipment[p.slot];
  const original = JSON.stringify({ equipment: w.equipment, farm: w.farm, finances: a });
  for (const [x, y] of [[21, 22], [21, 23], [22, 22], [22, 23]]) w.cells[worldIndex(x, y)].attribute = 12;
  for (const [cols, rows] of [[7, 20], [20, 81], [NaN, 20]]) {
    const before = JSON.stringify(w);
    assert.deepEqual(beginFlight(w, a, e.slot, cols, rows, 2, true), { ok: false, reason: 'invalid-viewport' }); assert.equal(JSON.stringify(w), before);
  }
  const result = beginFlight(w, a, e.slot, 20, 16, 2, true); assert.ok(result.ok);
  assert.deepEqual(flightPosition(result.flight), { x: 21, y: 22 }); assert.equal(result.flight.heading, 6);
  assert.deepEqual([result.flight.cameraX, result.flight.cameraY], [11, 14]);
  for (const [x, y] of [[21, 22], [21, 23], [22, 22], [22, 23]]) assert.equal(w.cells[worldIndex(x, y)].terrain, 20);
  assert.equal(JSON.stringify({ equipment: w.equipment, farm: w.farm, finances: a }), original);
  assert.deepEqual(beginFlight(w, a, e.slot, 20, 16, 2, true), { ok: false, reason: 'not-parked' });
});

test('viewport movement matches all eight interior directions and remains bounded for square, portrait and odd-sized views', () => {
  const f = setup(), base = f.flight;
  const deltas = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  for (let heading = 0; heading < 8; heading++) {
    const flight = { ...base, cameraX: 30, cameraY: 30, heading }, before = flightPosition(flight);
    moveFlight(flight); assert.deepEqual(flightPosition(flight), { x: before.x + deltas[heading][0], y: before.y + deltas[heading][1] });
  }
  for (const [columns, rows] of [[20, 16], [8, 40], [40, 8], [31, 19], [80, 80]]) {
    const limitX = (columns >> 1) - 3, limitY = (rows >> 1) - 3;
    for (const [cameraX, offsetX] of [[0, -limitX], [96 - columns, limitX]])
      for (const [cameraY, offsetY] of [[0, -limitY], [95 - rows, limitY]]) for (let heading = 0; heading < 8; heading++) {
        const flight = { ...base, columns, rows, cameraX, cameraY, offsetX, offsetY, heading };
        for (let n = 0; n < 100; n++) {
          moveFlight(flight); const p = flightPosition(flight);
          assert.ok(p.x >= 3 && p.x <= 93 && p.y >= 3 && p.y <= 92);
          assert.ok(Math.abs(flight.offsetX) <= limitX && Math.abs(flight.offsetY) <= limitY);
        }
      }
  }
  const northwest = { ...base, columns: 8, rows: 40, cameraX: 0, cameraY: 0, offsetX: -1, offsetY: -17, heading: 7 };
  moveFlight(northwest); assert.deepEqual(flightPosition(northwest), { x: 3, y: 3 }); assert.equal(northwest.heading, 0); // SF-111.
});

test('flight frame timing, queued input, uint16 wrap and first spraying interval follow source order', () => {
  const f = setup(), s = f.flight; s.heading = 2;
  for (const k of ['lastFrameTick', 'lastWearTick', 'lastFuelTick', 'lastSprayTick'] as const) s[k] = 65534;
  s.inputs.push('spray-on'); assert.deepEqual(frame(f, 65535), { advanced: false }); assert.equal(s.inputs.length, 1);
  frame(f, 0); assert.equal(s.spraying, true); assert.equal(aircraftPayload(f.e), 255);
  for (const t of [2, 4, 6]) frame(f, t); assert.equal(aircraftPayload(f.e), 255);
  frame(f, 8); assert.equal(aircraftPayload(f.e), 254); // First interval10, initialized at takeoff (SF-110).
  for (let tick = 10; tick <= 30; tick += 2) frame(f, tick);
  assert.equal(f.e.condition, 0); assert.equal(aircraftFuel(f.e), 255);
  frame(f, 32); assert.equal(f.e.condition, 1); assert.equal(aircraftFuel(f.e), 254);
  s.inputs.push('left', 'right'); const heading = s.heading;
  frame(f, 34); assert.equal(s.heading, (heading - 1) & 7); assert.equal(s.inputs.length, 1);
  frame(f, 36); assert.equal(s.heading, heading);
});

test('every fourth spray frame applies actual loaded chemical, toxicity and retained-pressure effects without ground supply purchases', () => {
  for (const [chemical, offset, pressure] of [[221, 20, 60], [222, 21, 61], [223, 22, 62]]) {
    const f = setup(), field = f.w.fields[1];
    field.bytes[7] |= 1; field.bytes[10] = 20; field.bytes[11] = 16;
    field.bytes[12] = 8; field.bytes[13] = 8; field.bytes[14] = 0;
    f.flight.heading = 2; f.flight.inputs.push('spray-on'); f.v.setUint16(34, chemical, true);
    field.bytes[offset] = 100; field.bytes[pressure] = 101; field.bytes[32] = 10;
    const cash = f.w.farm.cash, expenses = f.w.farm.chemicalExpenses;
    for (const tick of [2, 4, 6]) frame(f, tick); assert.equal(field.bytes[offset], 100);
    frame(f, 8); assert.equal(field.bytes[offset], 0); assert.equal(field.bytes[32], 12); assert.equal(field.bytes[pressure], 50);
    assert.equal(f.w.farm.cash, cash); assert.equal(f.w.farm.chemicalExpenses, expenses); assert.equal(aircraftPayload(f.e), 255);
  }
});

test('ending over an airport returns home, while fuel loss or pilot termination elsewhere crashes without sale income', () => {
  const landed = setup(); landed.flight.inputs.push('end'); const result = frame(landed, 2);
  assert.equal(result.end?.kind, 'landed'); assert.equal(landed.e.active, true); assert.equal(landed.flight.active, false);
  assert.equal(landed.w.cells[worldIndex(21, 22)].terrain, 71);
  for (const cause of ['pilot', 'fuel', 'wear'] as const) {
    const f = setup(); f.flight.cameraX = 40; f.flight.cameraY = 40;
    if (cause === 'pilot') f.flight.inputs.push('end');
    else if (cause === 'fuel') f.v.setUint16(20, 1, true);
    else f.e.bytes[17] = 250;
    const cash = f.w.farm.cash, income = f.a.accounts.assets.equipmentIncome, book = f.a.accounts.assets.equipmentBookValue;
    const end = frame(f, cause === 'pilot' ? 2 : 34).end!;
    assert.deepEqual([end.kind, end.cause, f.e.active], ['crashed', cause, false]);
    assert.equal(f.w.farm.cash, cash); assert.equal(f.a.accounts.assets.equipmentIncome, income);
    assert.equal(f.a.accounts.assets.equipmentBookValue, (book - 6000) >>> 0); assert.equal(f.w.equipmentDefinitions[8].ownedCount, 0);
    for (const [dx, dy, tile] of [[0, 0, 73], [1, 0, 74], [0, 1, 113], [1, 1, 114]]) assert.equal(f.w.cells[worldIndex(end.x + dx, end.y + dy)].terrain, tile);
    assert.equal(f.w.cells[worldIndex(21, 22)].terrain, 23); assert.equal(f.w.regionalConditions[(2 * 12 + 2) * 7] & 64, 0);
    const after = JSON.stringify(f.w); assert.deepEqual(frame(f, 36), { advanced: false }); assert.equal(JSON.stringify(f.w), after);
  }
});

test('spray controls cannot enable an empty payload and source consumes the last unit before disabling a later interval', () => {
  const f = setup(), s = f.flight; f.v.setUint16(32, 0, true);
  for (const [tick, control] of [[2, 'spray-on'], [4, 'spray-toggle']] as const) {
    s.inputs.push(control); frame(f, tick); assert.equal(s.spraying, false);
  }
  f.v.setUint16(32, 1, true); s.inputs.push('spray-on'); frame(f, 6);
  frame(f, 10); assert.equal(aircraftPayload(f.e), 0); assert.equal(s.spraying, true);
  frame(f, 18); assert.equal(s.spraying, true); frame(f, 20); assert.equal(s.spraying, false);
  f.v.setUint16(32, 255, true); s.inputs.push('spray-toggle'); frame(f, 22); assert.equal(s.spraying, true);
  s.inputs.push('spray-off'); frame(f, 24); assert.equal(s.spraying, false);
});

test('climb is capped at100, descent through zero ends after movement and byte wear retains its source wrap', () => {
  const f = setup(); f.flight.altitude = 100; f.flight.inputs.push('climb'); frame(f, 2); assert.equal(f.flight.altitude, 100);
  f.flight.altitude = 1; f.flight.inputs.push('descend'); const before = flightPosition(f.flight), end = frame(f, 4).end!;
  assert.equal(f.flight.altitude, 0); assert.equal(end.kind, 'landed'); assert.equal(end.x, before.x - 1);
  const wrap = setup(); wrap.e.bytes[17] = 255;
  assert.equal(frame(wrap, 34).end, undefined); assert.equal(wrap.e.condition, 0);
  const empty = setup(); empty.v.setUint16(20, 0, true);
  assert.equal(frame(empty, 32).end, undefined); assert.equal(aircraftFuel(empty.e), 0);
  assert.equal(frame(empty, 34).end?.cause, 'fuel'); assert.equal(aircraftFuel(empty.e), 0);
});

test('ending over a different airport restores the original home rather than relocating the plane', () => {
  const f = setup(); f.w.regionalConditions[(5 * 12 + 5) * 7] = 5;
  f.flight.cameraX = 34; f.flight.cameraY = 36; f.flight.inputs.push('end');
  const end = frame(f, 2).end!;
  assert.deepEqual([end.kind, end.x, end.y], ['landed', 43, 44]);
  assert.deepEqual([f.e.x, f.e.y, f.e.bytes[50], f.e.bytes[51]], [21, 22, 21, 22]);
  assert.equal(f.w.cells[worldIndex(21, 22)].terrain, 71);
});

test('tornado reaction uses squared camera-centre distance, defers spin until the next frame and expires at128 ticks', () => {
  const f = setup(), s = f.flight; s.cameraX = 30; s.cameraY = 30; s.offsetX = 7; s.heading = 0;
  const hit = advanceFlight(f.w, f.a, f.cropsRaw, s, 2, { x: 47, y: 37 });
  assert.equal(hit.end, undefined); assert.equal(s.turbulence, true); assert.equal(s.spin, 0);
  // The plane itself is at47,37, but the source checks camera centre40,37: squared distance49.
  frame(f, 4); assert.equal(s.spin, 1);
  frame(f, 130); assert.equal(s.turbulence, false); assert.equal(s.spin, 0);
  const near = setup(); near.flight.cameraX = 30; near.flight.cameraY = 30; near.flight.heading = 0;
  const crash = advanceFlight(near.w, near.a, near.cropsRaw, near.flight, 2, { x: 42, y: 37 });
  assert.equal(crash.end?.cause, 'tornado'); assert.equal(crash.end?.kind, 'crashed'); assert.equal(near.flight.altitude, 0);
  const far = setup(); far.flight.cameraX = 30; far.flight.cameraY = 30; far.flight.heading = 0;
  advanceFlight(far.w, far.a, far.cropsRaw, far.flight, 2, { x: 45, y: 42 });
  assert.equal(far.flight.turbulence, false); // squared distance50 is excluded.
});
