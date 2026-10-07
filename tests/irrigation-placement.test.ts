import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { checkIrrigationPlacement, placeIrrigation } from '../src/simulation/irrigation-placement';
import { updateIrrigation } from '../src/simulation/irrigation';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const b = source(`SCEN${id}.SSM`), world = readScenario(b), finances = readFinancialState(b);
  for (const cell of world.cells) { cell.terrain = 15; cell.overlay = 0; cell.attribute = 0; }
  world.farm.cash = 10000; world.farm.autoClear = false;
  const cell = (x: number, y: number) => world.cells[worldIndex(x, y)];
  const place = (tool: Parameters<typeof placeIrrigation>[2], x = 10, y = 10) => placeIrrigation(world, finances, tool, x, y, 0);
  return { world, finances, cell, place };
}

test('ditch and valve evidence pins original prices, unsigned debit, inclusive grass and four-entry connectivity', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x246d0, '26a1dc732bd252506aff'); exact(0x24764, '26a1b4742bd252506aff');
  exact(0x249db, '26a1ea742bd252506aff'); exact(0x246c8, '3bc87250');
  exact(0x24cd1, '807efe04'); exact(0x249a2, '4141e97bff');
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => [e.readUInt16LE(0x89d9e + i * 4), e.readUInt16LE(0x89da0 + i * 4)]),
    [[83, 11], [84, 11], [128, 34], [129, 36], [61, 34]]);
  for (let id = 0; id < 8; id++) {
    const { world, finances, cell, place } = setup(id), before = Uint8Array.from(world.sourceBytes);
    const initialExpenses = finances.annual.otherExpenses;
    assert.deepEqual(place('ditch'), { ok: true, price: 80, clearingCost: 0, tile: 87 });
    cell(11, 10).terrain = 161; assert.deepEqual(place('ditch', 11), { ok: true, price: 40, clearingCost: 0, tile: 172 });
    assert.equal(cell(10, 10).terrain, 88); assert.deepEqual(place('valve'), { ok: true, price: 35, clearingCost: 0, tile: 122 });
    assert.equal(world.farm.cash, 9845); assert.equal(finances.annual.otherExpenses, initialExpenses + 155);
    assert.deepEqual(world.sourceBytes, before);
  }
});

test('all connection shapes, mixed wet neighbors, fixed valves/crossings and map corners retain original flags', () => {
  const e = source('SIMFARM.EXE'), dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let bits = 0; bits < 16; bits++) {
    const { cell, place } = setup(); cell(10, 10).terrain |= 0xa800; cell(10, 10).overlay = 1010;
    dirs.forEach(([dx, dy], i) => { if (bits & (1 << i)) cell(10 + dx, 10 + dy).terrain = 0x5000 | (i % 2 ? 98 : 87); });
    assert.equal(place('ditch').ok, true);
    assert.equal(cell(10, 10).terrain, 0xa800 | (87 + e.readUInt16LE(0x846f0 + 0x59c4 + bits * 2)));
    assert.equal(cell(10, 10).overlay, 1010);
    dirs.forEach(([dx, dy], i) => {
      if (bits & (1 << i)) assert.equal(cell(10 + dx, 10 + dy).terrain, 0x5000 | ((i % 2 ? 98 : 87) + (i % 2 ? 1 : 0)));
    });
  }
  const { cell, place } = setup();
  cell(9, 10).terrain = 125; cell(11, 10).terrain = 173; cell(10, 9).terrain = 120;
  assert.deepEqual(place('ditch'), { ok: true, price: 80, clearingCost: 0, tile: 88 }); // Pump does not reshape ditch (SF-094).
  assert.equal(cell(9, 10).terrain, 125); assert.equal(cell(11, 10).terrain, 173); assert.equal(cell(10, 9).terrain, 120);
  for (const [x, y] of [[0, 0], [0, 95], [95, 0], [95, 95]]) assert.ok(place('ditch', x, y).ok);
});

test('placement boundaries, source-price words, clearing order and rejected transactions are exact', () => {
  const { world, finances, cell, place } = setup();
  const before = () => JSON.stringify({ cells: world.cells, farm: world.farm, finances });
  for (const tile of [14, 32, 86, 87, 109, 149, 172, 173, 177, 535]) {
    cell(10, 10).terrain = tile; const saved = before(); assert.equal(place('ditch').ok, false); assert.equal(before(), saved);
  }
  for (const tile of [15, 30, 31, 150, 160, 161, 171]) { cell(10, 10).terrain = tile; assert.ok(place('ditch').ok); }
  for (const [x, y] of [[-1, 0], [0, 96], [1.5, 1], [NaN, 0]]) assert.deepEqual(place('ditch', x, y), { ok: false, reason: 'outside-map' });
  cell(10, 10).terrain = 15; cell(10, 10).overlay = 0x4000;
  assert.deepEqual(place('ditch'), { ok: false, reason: 'town-land' }); cell(10, 10).overlay = 0;
  world.farm.autoClear = true; cell(10, 10).terrain = 535; world.farm.cash = 104;
  const saved = before(); assert.deepEqual(place('ditch'), { ok: false, reason: 'insufficient-cash' }); assert.equal(before(), saved);
  world.farm.cash = 105; const workers = world.farm.workerExpenses;
  assert.deepEqual(place('ditch'), { ok: true, price: 80, clearingCost: 25, tile: 87 });
  assert.equal(world.farm.cash, 0); assert.equal(world.farm.workerExpenses, workers + 25);
  cell(10, 10).terrain = 131; world.farm.cash = 80; assert.ok(place('ditch').ok); assert.equal(world.farm.cash, 0);
  finances.accounts.otherDefinitions[1].price = 65535; cell(10, 10).terrain = 15; world.farm.cash = 65535;
  finances.annual.otherExpenses = 0xffffffff; assert.ok(place('ditch').ok); assert.equal(world.farm.cash, 0);
  assert.equal(finances.annual.otherExpenses, 65534);
  cell(10, 10).terrain = 15; assert.deepEqual(checkIrrigationPlacement(world, finances, 'ditch', 10, 10, 0), { ok: false, reason: 'insufficient-cash' });
});

test('valves retain orientation, flags and zero-cost native open/close state while controlling original wet flow', () => {
  const { world, cell, place } = setup();
  for (const [from, to] of [[87, 124], [98, 124], [88, 122], [99, 122]]) {
    cell(10, 10).terrain = 0xb000 | from; assert.deepEqual(place('valve'), { ok: true, price: 35, clearingCost: 0, tile: to });
    assert.equal(cell(10, 10).terrain, 0xb000 | to);
    const cash = world.farm.cash; assert.equal(place('close-valve').ok, true); assert.equal(cell(10, 10).terrain, 0xb000 | (to + 1));
    assert.equal(place('close-valve').ok, true); assert.equal(place('open-valve').ok, true); assert.equal(cell(10, 10).terrain, 0xb000 | to);
    assert.equal(world.farm.cash, cash);
  }
  cell(10, 10).terrain = 89; assert.deepEqual(place('valve'), { ok: false, reason: 'straight-ditch-required' });
  assert.deepEqual(place('open-valve'), { ok: false, reason: 'valve-required' });
  cell(10, 10).terrain = 0x800 | 87; assert.deepEqual(place('valve'), { ok: false, reason: 'blocked-terrain' });
  const state = world.irrigation; state.sourceCount = 0; state.phase = 1; state.active = true; state.delay = 3; state.lastTick = 0;
  cell(9, 10).terrain = 0x8000 | 98; cell(10, 10).terrain = 122; cell(11, 10).terrain = 88;
  assert.ok(place('close-valve').ok); state.flow = [{ x: 9, y: 10, strength: 20 }];
  updateIrrigation(world, state, 3, 10, () => {}); assert.equal(cell(11, 10).terrain, 88);
  assert.ok(place('open-valve').ok); state.flow = [{ x: 9, y: 10, strength: 20 }]; state.active = true;
  updateIrrigation(world, state, 6, 10, () => {}); assert.equal(cell(11, 10).terrain & 0x7ff, 99);
});
