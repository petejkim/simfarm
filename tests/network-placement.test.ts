import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { checkNetworkPlacement, placeNetwork, setGateOpen, type NetworkTool } from '../src/simulation/network-placement';
import { animalCanWalk } from '../src/simulation/animal-world';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const bytes = source(`SCEN${id}.SSM`), world = readScenario(bytes), finances = readFinancialState(bytes);
  for (const cell of world.cells) { cell.terrain = 15; cell.overlay = 0; cell.attribute = 0; }
  world.farm.cash = 10000; world.farm.autoClear = false;
  const cell = (x = 10, y = 10) => world.cells[worldIndex(x, y)];
  const place = (tool: NetworkTool, x = 10, y = 10, soil = 0) => placeNetwork(world, finances, tool, x, y, soil);
  return { world, finances, cell, place };
}

test('network prices, unsigned debits, ownership, crossing bounds and gate pairs match source instructions', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, hex: string) => assert.equal(e.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x24523, '26a1ca732bd252506aff'); exact(0x24655, '26a124742bd252506aff');
  exact(0x245c4, '26a1b4742bd252506aff'); exact(0x2485e, '26a16c742bd252506aff');
  exact(0x248d8, '26a1d8742bd252506aff'); exact(0x24594, '83c1163bc87325');
  exact(0x245b9, '3bc87303'); exact(0x2484f, '26f687254c08');
  exact(0x25732, '2500f880e507410bc826898f2404'); exact(0x257a6, '2500f880e50749eb8a');
  exact(0x24cd1, '807efe04'); exact(0x24e7b, '807efe06'); // Distinct mask/category bounds.
  for (let id = 0; id < 8; id++) {
    const { world, finances, cell, place } = setup(id), original = Uint8Array.from(world.sourceBytes);
    const accounts = structuredClone(finances.accounts), expenses = finances.annual.otherExpenses;
    assert.deepEqual(place('road-161'), { ok: true, price: 20, clearingCost: 0, tile: 161 });
    cell().terrain = 31; assert.deepEqual(place('road-150'), { ok: true, price: 30, clearingCost: 0, tile: 150 });
    cell().terrain = 98; assert.deepEqual(place('road-161'), { ok: true, price: 40, clearingCost: 0, tile: 172 });
    cell().terrain = 15; cell().overlay = 0x800;
    assert.deepEqual(place('fence'), { ok: true, price: 50, clearingCost: 0, tile: 177 });
    assert.deepEqual(place('gate'), { ok: true, price: 75, clearingCost: 0, tile: 188 });
    assert.equal(world.farm.cash, 9785); assert.equal(finances.annual.otherExpenses, expenses + 215);
    assert.deepEqual(structuredClone(finances.accounts), accounts); assert.deepEqual(world.sourceBytes, original);
  }
});

test('all2048 terrain IDs follow recovered purchase eligibility without mutating rejected state or quotes', () => {
  for (const tool of ['road-161', 'road-150', 'fence', 'gate'] as const) {
    const { world, finances, cell, place } = setup(); cell().overlay = 0x800; world.farm.cash = 1000000;
    for (let tile = 0; tile < 2048; tile++) {
      cell().terrain = tile;
      const accepted = tool === 'gate' ? tile === 177 || tile === 178 : tool === 'fence' ? tile >= 15 && tile <= 31
        : (tile >= 15 && tile <= 31) || (tile >= 39 && tile <= 69) || (tile >= 87 && tile <= 109);
      const cash = world.farm.cash, expenses = finances.annual.otherExpenses;
      const quote = checkNetworkPlacement(world, finances, tool, 10, 10, 0);
      assert.equal(quote.ok, accepted, `${tool}/${tile}`); assert.equal(cell().terrain, tile); assert.equal(world.farm.cash, cash);
      const result = place(tool); assert.equal(result.ok, accepted);
      if (!accepted) { assert.equal(cell().terrain, tile); assert.equal(world.farm.cash, cash); assert.equal(finances.annual.otherExpenses, expenses); }
    }
  }
});

test('all source connection masks reshape mixed roads and fences, retaining fixed crossings/gates and edge bounds', () => {
  const e = source('SIMFARM.EXE'), dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (const [tool, base] of [['road-150', 150], ['road-161', 161], ['fence', 177]] as const) for (let mask = 0; mask < 16; mask++) {
    const { cell, place } = setup(); cell().terrain = 0x9000 | 15; cell().overlay = 0x1800; cell().attribute = 47;
    dirs.forEach(([dx, dy], i) => { if (mask & 1 << i) cell(10 + dx, 10 + dy).terrain = 0x4000 | (base === 177 ? 177 : i % 2 ? 161 : 150); });
    assert.ok(place(tool).ok);
    assert.deepEqual(cell(), { terrain: 0x9000 | (base + e.readUInt16LE(0x846f0 + 0x59c4 + mask * 2)), overlay: 0x1800, attribute: 47 });
    dirs.forEach(([dx, dy], i) => {
      if (mask & 1 << i) assert.equal(cell(10 + dx, 10 + dy).terrain, 0x4000 | ((base === 177 ? 177 : i % 2 ? 161 : 150) + (i % 2 ? 1 : 0)));
    });
  }
  const { world, cell, place } = setup(); cell(9, 10).terrain = 173; cell(11, 10).terrain = 172;
  assert.equal(place('road-161').ok, true); assert.equal(cell().terrain, 162);
  assert.equal(cell(9, 10).terrain, 173); assert.equal(cell(11, 10).terrain, 172);
  cell().terrain = 15; cell().overlay = 0x800; cell(9, 10).terrain = 189; cell(11, 10).terrain = 190;
  assert.ok(place('fence').ok); assert.equal(cell().terrain, 178); assert.equal(cell(9, 10).terrain, 189); assert.equal(cell(11, 10).terrain, 190);
  for (const [x, y] of [[0, 0], [95, 0], [0, 95], [95, 95]]) {
    cell(x, y).overlay = 0x800; assert.ok(place('fence', x, y).ok);
    assert.ok(place('gate', x, y).ok); assert.ok(setGateOpen(world, x, y, true).ok);
  }
});

test('crossings preserve water flags, repair only road neighbors and use identical price for either road style', () => {
  for (const tool of ['road-150', 'road-161'] as const) for (const from of [39, 69, 87, 98, 109]) {
    const { cell, place } = setup(); cell().terrain = 0x3000 | from; cell().overlay = 1010; cell().attribute = 255;
    cell(11, 10).terrain = 160; cell(10, 9).terrain = 97; cell(10, 11).terrain = 108; cell(9, 10).terrain = 173;
    assert.deepEqual(place(tool), { ok: true, price: 40, clearingCost: 0, tile: 172 });
    assert.deepEqual(cell(), { terrain: 0x3000 | 172, overlay: 1010, attribute: 255 });
    assert.equal(cell(11, 10).terrain, 151); assert.equal(cell(10, 9).terrain, 97); assert.equal(cell(10, 11).terrain, 108); assert.equal(cell(9, 10).terrain, 173);
  }
  const { cell, place } = setup(); cell().terrain = 87; place('road-150'); assert.equal(cell().terrain, 172); // No invented water bit.
});

test('town, occupancy, ownership and cash checks are atomic, including automatic clearing and expense wrap', () => {
  const { world, finances, cell, place } = setup(); const saved = () => JSON.stringify({ world, finances });
  for (const [x, y] of [[-1, 0], [96, 0], [1, 1.5], [NaN, 0]]) assert.deepEqual(place('road-161', x, y), { ok: false, reason: 'outside-map' });
  assert.deepEqual(place('fence'), { ok: false, reason: 'not-owned' });
  cell().terrain = 177; assert.ok(place('gate').ok); // Ownership does not gate insertion.
  for (const tool of ['road-150', 'road-161', 'fence', 'gate'] as const) {
    cell().terrain = tool === 'gate' ? 177 : 15; cell().overlay = 0x4800;
    let before = saved(); assert.deepEqual(place(tool), { ok: false, reason: 'town-land' }); assert.equal(saved(), before);
    cell().overlay = 0x800; cell().terrain |= 0x800;
    before = saved(); assert.deepEqual(place(tool), { ok: false, reason: 'blocked-terrain' }); assert.equal(saved(), before);
  }
  world.farm.autoClear = true; cell().terrain = 535; cell().overlay = 0; world.farm.cash = 44;
  let before = saved(); assert.deepEqual(place('road-161'), { ok: false, reason: 'insufficient-cash' }); assert.equal(saved(), before);
  world.farm.cash = 45; world.farm.workerExpenses = 0xfffffff0;
  assert.deepEqual(place('road-161'), { ok: true, price: 20, clearingCost: 25, tile: 161 }); assert.equal(world.farm.cash, 0); assert.equal(world.farm.workerExpenses, 9);
  cell().terrain = 131; world.farm.cash = 24; before = saved(); assert.equal(place('road-161').ok, false); assert.equal(saved(), before);
  world.farm.cash = 25; assert.ok(place('road-161').ok); assert.equal(world.farm.cash, 5);
  cell().terrain = 535; world.farm.cash = 100; before = saved(); assert.equal(place('fence').ok, false); assert.equal(saved(), before);
  cell().overlay = 0x800; cell().attribute = 64; before = saved(); assert.equal(place('fence', 10, 10, 1).ok, false); assert.equal(saved(), before); // Restored32 is not grass.
  cell().terrain = 15; finances.accounts.otherDefinitions[0].price = 65535; world.farm.cash = 65535; finances.annual.otherExpenses = 0xffffffff;
  assert.ok(place('road-161').ok); assert.equal(world.farm.cash, 0); assert.equal(finances.annual.otherExpenses, 65534);
  cell().terrain = 15; finances.accounts.otherDefinitions[0].price = 0; assert.ok(place('road-161').ok);
});

test('both gate orientations toggle livestock passability freely without changing surrounding cells or retained state', () => {
  const { world, cell, place, finances } = setup();
  for (const [fence, gate] of [[177, 188], [178, 190]]) {
    cell().terrain = 0x9000 | fence; cell().overlay = 0x1234; cell().attribute = 155;
    cell(9, 10).terrain = 187; cell(11, 10).terrain = 186;
    assert.deepEqual(place('gate'), { ok: true, price: 75, clearingCost: 0, tile: gate });
    assert.equal(animalCanWalk(world, 10, 10), false);
    const expected = structuredClone(world), accounts = structuredClone(finances);
    for (const open of [true, true, false, false, true]) {
      assert.deepEqual(setGateOpen(world, 10, 10, open), { ok: true, tile: gate + Number(open) });
      assert.equal(animalCanWalk(world, 10, 10), open);
      expected.cells[worldIndex(10, 10)].terrain = 0x9000 | (gate + Number(open)); assert.deepEqual(structuredClone(world), expected); assert.deepEqual(structuredClone(finances), accounts);
    }
    cell().terrain |= 0x800; cell().overlay = 0x4000;
    assert.ok(setGateOpen(world, 10, 10, false).ok); assert.equal(cell().terrain, 0x9800 | gate); // Toggle path has no shop land/mask checks.
  }
  cell().terrain = 187; const before = structuredClone(world);
  assert.deepEqual(setGateOpen(world, 10, 10, true), { ok: false, reason: 'gate-required' }); assert.deepEqual(structuredClone(world), before);
  assert.deepEqual(setGateOpen(world, 96, 0, true), { ok: false, reason: 'outside-map' });
});
