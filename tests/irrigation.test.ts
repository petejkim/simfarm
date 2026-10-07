import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readIrrigation, copyIrrigation, validateIrrigation, addIrrigationSource, removeIrrigationSource } from '../src/formats/irrigation';
import { updateIrrigation } from '../src/simulation/irrigation';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup() {
  const b = source('SCEN4.SSM'), world = readScenario(b), state = readIrrigation(b);
  for (const cell of world.cells) { cell.terrain = 15; cell.overlay = 0; }
  for (const b of world.buildings) b.flags = 0;
  state.sources.fill(0); state.sourceCount = 0;
  const cell = (x: number, y: number) => world.cells[worldIndex(x, y)];
  const pump = (x = 10, y = 10, strength = 64) => {
    const b = world.buildings[1]; b.flags = 32; b.bytes[0] = 70; b.bytes[1] = 0; b.bytes[4] = x; b.bytes[5] = y;
    cell(x, y).terrain = 120; cell(Math.max(0, x - 1), y).terrain |= 0x2000;
    assert.ok(addIrrigationSource(state, x, y, strength));
  };
  return { world, state, cell, pump };
}

test('irrigation evidence pins source overlap, flow categories, pump refresh, driver order and merge arithmetic', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0xbd42, '9a42088c14'); exact(0x1730a, 'e80300');
  exact(0x449d0, '8b46f2d1e08bc80554f9'); exact(0x459de, '8b46f0d1e08bc80554f9');
  exact(0x4620b, '6802249a4a078400');
  exact(0x1758f, '26808f250480'); exact(0x175bb, '2680a725047f');
  exact(0x173c9, '9aac105719'); exact(0x1749e, '9a9e0fb315');
  exact(0x17cc7, '8a46f28846f00246fe8846f0');
  assert.equal(e.readUInt16LE(0x4ec60 + 0x862), 87); assert.equal(e.readUInt16LE(0x4ec60 + 0x8d8), 120);
  assert.equal(e[0x4ec60 + 0x9db], 2);
});

test('all original source registries decode overlapping saved bytes, preserve inactive transferred bytes and reject missing active tails', () => {
  const counts = [4, 9, 4, 1, 4, 4, 2, 3];
  for (let id = 0; id < 8; id++) {
    const b = source(`SCEN${id}.SSM`), before = Uint8Array.from(b), s = readIrrigation(b);
    assert.equal(s.sourceCount, counts[id]); assert.equal(s.delay, 3);
    assert.deepEqual([s.active, s.phase, s.lastTick, s.flow], [false, 0, 0, []]);
    for (let offset = 0; offset < 129; offset++) {
      const last = Math.min(63, Math.floor(offset / 2)), member = offset - last * 2;
      assert.equal(s.sources[offset], b[0x210d3 + last * 3 + member]);
    }
    assert.ok(s.sources.subarray(129).every(n => n === 0));
    for (let i = 0; i < s.sourceCount; i++) {
      assert.ok(s.sources[i * 3] < 96 && s.sources[i * 3 + 1] < 96); assert.ok([48, 64].includes(s.sources[i * 3 + 2]));
    }
    const clone = copyIrrigation(s); clone.sources.fill(255); assert.notDeepEqual(clone.sources, s.sources);
    assert.deepEqual(Uint8Array.from(b), before);
  }
  const b = source('SCEN4.SSM'), s = readIrrigation(b);
  assert.deepEqual(Array.from(s.sources.slice(0, 12)), [35, 54, 64, 35, 42, 64, 31, 42, 64, 32, 53, 64]);
  assert.throws(() => readIrrigation(b.subarray(0, 0x21192)), /Binary range/);
  b[0x210d2] = 44; assert.throws(() => readIrrigation(b), /tail is not saved/);
  b[0x210d2] = 64; assert.throws(() => readIrrigation(b), /tail is not saved/);
  b[0x210d2] = 4; b[0x210d3] = 96; assert.throws(() => readIrrigation(b), /coordinate/);
});

test('source registry supports all64 native entries and bounded removal while retaining inactive bytes', () => {
  const { state } = setup(); state.sources.fill(0xa5);
  for (let i = 0; i < 64; i++) assert.equal(addIrrigationSource(state, i, 1, i + 1), true);
  const before = Array.from(state.sources);
  assert.equal(addIrrigationSource(state, 90, 1, 48), false); assert.deepEqual(Array.from(state.sources), before);
  assert.equal(removeIrrigationSource(state, 40, 1), true); assert.equal(state.sourceCount, 63);
  assert.deepEqual(Array.from(state.sources.slice(120, 129)), [41, 1, 42, 42, 1, 43, 43, 1, 44]);
  assert.deepEqual(Array.from(state.sources.slice(189)), before.slice(189)); // No read of successor64.
  assert.equal(removeIrrigationSource(state, 90, 1), false);
  assert.throws(() => addIrrigationSource(state, 96, 1, 48), /source/);
  state.flow = [{ x: 0, y: 0, strength: 1 }]; assert.throws(() => validateIrrigation(state), /state/);
  state.active = true; state.flow[0].strength = 256; assert.throws(() => validateIrrigation(state), /packet/);
});

test('pump flow respects four-packet timing, alternating visit bits and field refresh order', () => {
  const { world, state, cell, pump } = setup(); pump();
  for (let x = 11; x <= 18; x++) cell(x, 10).terrain = 87;
  const calls: { status: boolean; wet: number }[] = [];
  const refresh = (status: boolean) => calls.push({ status, wet: world.cells.filter(c => (c.terrain & 0x7ff) === 98).length });
  const before = JSON.stringify({ world, state });
  assert.equal(updateIrrigation(world, state, 2, 0, refresh), false); assert.equal(JSON.stringify({ world, state }), before);
  updateIrrigation(world, state, 3, 0, refresh);
  assert.equal(state.active, true); assert.equal(state.phase, 1);
  assert.deepEqual(state.flow, [{ x: 14, y: 10, strength: 60 }]);
  assert.equal(cell(14, 10).terrain, 0x8000 | 98); assert.equal(cell(15, 10).terrain, 87);
  updateIrrigation(world, state, 6, 0, refresh); assert.deepEqual(state.flow, [{ x: 18, y: 10, strength: 56 }]);
  assert.equal(updateIrrigation(world, state, 9, 0, refresh), true);
  assert.deepEqual(calls, [{ status: false, wet: 8 }]); assert.equal(state.active, false);
  updateIrrigation(world, state, 12, 0, refresh);
  assert.equal(state.phase, 0); assert.deepEqual(calls[1], { status: true, wet: 8 });
  assert.equal(cell(14, 10).terrain, 87); assert.equal(cell(15, 10).terrain, 0x8000 | 98);
  updateIrrigation(world, state, 15, 0, refresh); updateIrrigation(world, state, 18, 0, refresh);
  assert.equal(state.active, false); assert.equal(state.flow.length, 0); assert.equal(calls.length, 2);
});

test('pump needs nearby water, wind source uses signed threshold and a one-row outlet, and drying permits closed valves', () => {
  for (const wind of [-128, 8, 9, 127]) {
    const { world, state, cell } = setup(); addIrrigationSource(state, 10, 10, 48);
    cell(10, 11).terrain = 87; cell(11, 11).terrain = 123; cell(12, 11).terrain = 87;
    updateIrrigation(world, state, 3, wind, () => {});
    assert.equal(cell(10, 11).terrain, wind < 9 ? 87 : 0x8000 | 98);
    assert.equal(cell(11, 11).terrain, 123); assert.equal(cell(12, 11).terrain, 87);
    // Dry pass crosses closed valves only where the previous phase marked them.
    state.phase = 1; state.active = false; state.flow = [];
    for (let x = 10; x <= 12; x++) cell(x, 11).terrain |= 0x8000;
    updateIrrigation(world, state, 6, wind, () => {});
    assert.equal(cell(11, 11).terrain, 123); assert.equal(cell(12, 11).terrain, 87);
  }
  const { world, state, cell, pump } = setup(); pump(); cell(9, 10).terrain = 15; cell(11, 10).terrain = 87;
  updateIrrigation(world, state, 3, 127, () => {}); assert.equal(cell(11, 10).terrain, 87);
});

test('junctions preserve directional division while zero-strength branches drain; large FIFO never aliases empty', () => {
  const { world, state, cell } = setup();
  state.active = true; state.phase = 1; state.flow = [{ x: 10, y: 10, strength: 1 }]; cell(10, 10).terrain = 0x8000 | 87;
  for (const [x, y] of [[10, 9], [11, 10], [10, 11], [9, 10]]) cell(x, y).terrain = 87;
  updateIrrigation(world, state, 3, 0, () => {});
  assert.deepEqual(state.flow, [{ x: 9, y: 10, strength: 0 }]);
  assert.equal(updateIrrigation(world, state, 6, 0, () => {}), true); assert.equal(state.active, false);
  for (const [x, y] of [[10, 9], [11, 10], [10, 11], [9, 10]]) assert.equal(cell(x, y).terrain, 0x8000 | 98);
  state.active = true; state.flow = Array.from({ length: 129 }, (_, x) => ({ x: x % 96, y: 0, strength: 0 }));
  updateIrrigation(world, state, 9, 0, () => {}); assert.equal(state.flow.length, 125); assert.equal(state.active, true);
  for (let tick = 12; state.active && tick < 200; tick += 3) updateIrrigation(world, state, tick, 0, () => {});
  assert.equal(state.active, false); assert.equal(state.flow.length, 0);
});

test('dead-end packet merging preserves the original saturate-then-add-again byte arithmetic', () => {
  const { world, state } = setup(); state.active = true; state.phase = 1;
  state.flow = [200, 100, 10, 20, 30, 40].map((strength, x) => ({ x, y: 0, strength }));
  updateIrrigation(world, state, 3, 0, () => {});
  assert.deepEqual(state.flow, [{ x: 5, y: 0, strength: 110 }, { x: 3, y: 0, strength: 199 }]);
});

test('edge sources and branches stay inside world bounds, and clocks preserve word-wrap timing', () => {
  const { world, state, cell } = setup();
  addIrrigationSource(state, 95, 95, 48); cell(95, 95).terrain = 87; cell(94, 95).terrain = 87;
  state.lastTick = 65534;
  updateIrrigation(world, state, 0, 9, () => {}); assert.equal(state.lastTick, 65534);
  updateIrrigation(world, state, 1, 9, () => {});
  assert.equal(cell(95, 95).terrain, 0x8000 | 98); assert.equal(cell(94, 95).terrain, 0x8000 | 98);
  assert.equal(state.lastTick, 1); validateIrrigation(state);
});
