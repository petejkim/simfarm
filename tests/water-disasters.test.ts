import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { readCrop } from '../src/formats/crop';
import { createMovingDisasters } from '../src/simulation/moving-disasters';
import { createColdMarket, loadMarketCropPrices, adjustMarketForDisaster } from '../src/simulation/market';
import { createWaterDisasters, beginWaterDisaster, stopWaterDisaster, advanceFlood, advanceFloodCounter,
  countDryNeighbors, validateWaterDisasters } from '../src/simulation/water-disasters';
import { refreshShorelines } from '../src/simulation/terrain-removal';
import { FarmRandom } from '../src/simulation/random';
import { purchaseBuilding } from '../src/simulation/building-placement';
import { purchaseEquipment } from '../src/simulation/equipment-purchase';
import { shopFixture } from './support/livestock';
import { disasterFixture } from './support/disasters';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function fixture() {
  const f = shopFixture(); return { ...f, water: createWaterDisasters(), random: new FarmRandom(f.state.random) };
}

test('water disasters pin source defaults, price sensitivities, asymmetric scan limits, deletion gates and inactive counter behavior', () => {
  const exe = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x8b084, '00010000'); exact(0x60748, '0000000000000000'); assert.equal(exe[0x846f0 + 0x69b7], 0);
  exact(0x36b8c, 'c606946904'); exact(0x3705f, 'c6069769f8c606946900');
  exact(0x3792b, 'f6069669047404fe069769cb'); exact(0x378b1, '837eec407d39');
  exact(0x37889, '26833e6aff5e'); exact(0x378a1, '26833e68ff5e');
  exact(0x376e5, '2680bf342400740b2680bf342404');
  exact(0x376f9, '9a26025719'); exact(0x37704, '9afa025719'); exact(0x377e3, '9a2a00d417'); exact(0x377fb, '9aaa10e624');
  exact(0x4b0ca, '268a8ff3c5'); exact(0x4b128, '268a8ff2c5');
  for (const [offset, value] of [[0x85e, 15], [0x860, 39], [0x8d8, 120], [0x95e, 172]]) assert.equal(exe.readUInt16LE(0x4ec60 + offset), value);
  for (const [offset, value] of [[0x9db, 2], [0xa1e, 2]]) assert.equal(exe[0x4ec60 + offset], value);
  const d = createWaterDisasters(); validateWaterDisasters(d);
  for (const patch of [{ counter: -129 }, { counter: 128 }, { scanY: 94 }, { scanX: 95 }, { scanning: true, scanX: 94 }, { rawFF6C: 65536 }])
    assert.throws(() => validateWaterDisasters({ ...d, ...patch }));
});

test('whole-map shoreline repaint follows source x-major random consumption and protects pump, bridge and masked tiles', () => {
  const f = fixture(), w = f.state.scenario, expected = new FarmRandom(f.state.random);
  for (const c of w.cells) { c.terrain = 0xb800 | 39; c.overlay = 0; }
  for (const [x, y, tile, overlay] of [[0, 0, 120, 0], [10, 20, 121, 0], [30, 40, 172, 0], [95, 95, 173, 0], [50, 60, 150, 0x4000]]) {
    w.cells[worldIndex(x, y)].terrain = 0xb800 | tile; w.cells[worldIndex(x, y)].overlay = overlay;
  }
  const before = w.cells.map(c => ({ ...c })); refreshShorelines(w, f.random);
  for (let i = 0; i < w.cells.length; i++) {
    const protectedTile = [120, 121, 172, 173].includes(before[i].terrain & 2047) || before[i].overlay & 0x4000;
    assert.equal(w.cells[i].terrain, protectedTile ? before[i].terrain : 0xb800 | (55 + (expected.nextVisual() & 1)));
    assert.equal(w.cells[i].overlay, before[i].overlay); assert.equal(w.cells[i].attribute, before[i].attribute);
  }
  assert.deepEqual(f.random.snapshot(), expected.snapshot());
  assert.deepEqual(f.random.snapshot().simulation, f.state.random.simulation);
});

test('drought, flood and wind use distinct crop sensitivity bytes and original masked word shifts', () => {
  const f = fixture(), w = f.state.scenario, crops = f.state.crops.map(c => [...c]);
  const unused = w.cropDefinitions.slice(16).map(c => Array.from(c.bytes));
  for (const c of crops) { c[34] = 100; c[35] = 0; c[70] = 2; c[71] = 1; c[72] = 3; }
  for (const [mode, expected] of [[2, 150], [3, 125], [5, 112], [6, 112]] as const) {
    const market = createColdMarket(); loadMarketCropPrices(market, crops); adjustMarketForDisaster(market, crops, mode);
    assert.deepEqual(market.history.map(h => h[29]), Array(16).fill(expected));
    assert.deepEqual(w.cropDefinitions.slice(16).map(c => Array.from(c.bytes)), unused);
  }
  const market = createColdMarket(); loadMarketCropPrices(market, crops);
  for (const [i, shift] of [0, 16, 31, 32, 33, 255].entries()) crops[i][71] = shift;
  adjustMarketForDisaster(market, crops, 2);
  assert.deepEqual(market.history.slice(0, 6).map(h => h[29]), [100, 100, 100, 200, 150, 100]);
});

test('drought counts clamped dry neighbors, preserves original water/obstacle flags, reprices before eligibility and restores permanent water', () => {
  const f = fixture(), { scenario: w, disasters: d, weather, crops, market } = f.state, a = f.water;
  for (const c of w.cells) c.terrain = 0x3000 | 55;
  w.cells[0].terrain = 15;
  assert.equal(countDryNeighbors(w, 0, 0), 4); assert.equal(countDryNeighbors(w, 1, 1), 1);
  for (const c of w.cells) c.terrain = 15;
  const protectedTiles = [120, 121, 172, 173];
  for (let i = 0; i < 5; i++) w.cells[worldIndex(20 + i * 3, 20)].terrain = 0xb800 | (protectedTiles[i] ?? 55);
  // One interior permanent-water cell surrounded by land dries; high flags survive start.
  w.cells[worldIndex(32, 20)].overlay = 0x4000;
  const originalRandom = f.random.snapshot(), oldPrice = market.history[0][29]!, sensitivity = crops[0][71];
  d.enabled = false; assert.equal(beginWaterDisaster(w, crops, market, weather, d, a, 'drought', 99, f.random), false);
  assert.equal(market.history[0][29]!, oldPrice); assert.deepEqual(f.random.snapshot(), originalRandom);
  d.enabled = true; assert.equal(beginWaterDisaster(w, crops, market, weather, d, a, 'drought', 100, f.random), true);
  assert.equal(d.flags & 2, 2); assert.equal(d.lastStartTick, 100);
  assert.equal(w.cells[worldIndex(32, 20)].terrain, 0x981c); // Start ignores overlay protection; only shoreline redraw checks it.
  for (let i = 0; i < 4; i++) assert.equal(w.cells[worldIndex(20 + i * 3, 20)].terrain, 0xb800 | protectedTiles[i]);
  const firstPrice = market.history[0][29]!; assert.equal(beginWaterDisaster(w, crops, market, weather, d, a, 'drought', 101, f.random), false);
  assert.equal(d.lastStartTick, 100); if (sensitivity) assert.ok(market.history[0][29]! >= firstPrice);
  assert.equal(stopWaterDisaster(w, weather, d, a, 'drought', f.random), true);
  assert.equal(w.cells[worldIndex(32, 20)].terrain, 0xb836); // Stop sets54 and water; overlay suppresses redraw.
  assert.equal(d.flags & 2, 0); assert.equal(stopWaterDisaster(w, weather, d, a, 'drought', f.random), false);
});

test('flood scans64 origins per call with the original six-cell footprint, boundary limits and continued redraw after scan completion', () => {
  const f = fixture(), { scenario: w, finances, weather, disasters: d } = f.state, s = f.water;
  d.flags = 4; Object.assign(s, { scanning: true, scanX: 20, scanY: 20 });
  w.cells[worldIndex(20, 20)].terrain = 0x3000 | 55;
  const result = advanceFlood(w, finances, weather, d, s, f.random);
  assert.equal(result.scanned, 64); assert.deepEqual([s.scanX, s.scanY], [20, 84]);
  const flooded = w.cells.flatMap((c, i) => c.terrain & 0x2000 ? [i] : []);
  assert.deepEqual(flooded, [19 * 96 + 19, 19 * 96 + 20, 19 * 96 + 21, 20 * 96 + 19, 20 * 96 + 20, 20 * 96 + 21]);
  // Last four of8836 origins; x94/95 are never scan origins and y95 never floods.
  Object.assign(s, { scanX: 93, scanY: 90, scanning: true });
  w.cells[worldIndex(93, 93)].terrain = 0x3000 | 55;
  w.cells[worldIndex(94, 80)].terrain = 0x1000 | 55;
  const end = advanceFlood(w, finances, weather, d, s, f.random);
  assert.equal(end.scanned, 4); assert.deepEqual([s.scanX, s.scanY, s.scanning], [94, 0, false]);
  assert.equal(w.cells[worldIndex(94, 80)].terrain & 0x2000, 0);
  assert.equal(w.cells[worldIndex(93, 95)].terrain & 0x2000, 0);
  const randomBefore = f.random.snapshot(); assert.equal(advanceFlood(w, finances, weather, d, s, f.random).scanned, 0);
  assert.notDeepEqual(f.random.snapshot(), randomBefore); // Source still refreshes every active dispatcher call.
  Object.assign(s, { scanX: 0, scanY: 0, scanning: true }); for (const c of w.cells) c.terrain = 15;
  w.cells[0].terrain = 0x1000 | 55;
  advanceFlood(w, finances, weather, d, s, f.random);
  assert.deepEqual(w.cells.flatMap((c, i) => c.terrain & 0x2000 ? [i] : []), [0, 1]);
});

test('flood removes idle/growing fields with plans intact, leaves working fields active and destroys storage contents without sale income', () => {
  for (const state of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 255]) {
    const f = disasterFixture(), w = f.state.scenario, field = w.fields[1], s = createWaterDisasters();
    field.bytes[2] = state; const raw = Uint8Array.from(field.bytes), plans = Uint8Array.from(w.schedule.bytes);
    f.state.disasters.flags = 4; Object.assign(s, { scanX: 20, scanY: 20, scanning: true });
    w.cells[worldIndex(20, 20)].terrain |= 0x1000;
    const r = advanceFlood(w, f.state.finances, f.state.weather, f.state.disasters, s, new FarmRandom(f.state.random));
    assert.deepEqual(r.fields, [0, 4].includes(state) ? [1] : []);
    if ([0, 4].includes(state)) raw[7] &= ~1;
    assert.deepEqual(field.bytes, raw); assert.deepEqual(w.schedule.bytes, plans);
  }
  const f = fixture(), { scenario: w, finances: a, weather, disasters: d } = f.state;
  assert.ok(purchaseBuilding(w, a, 67, 20, 20, 0).ok); assert.ok(purchaseEquipment(w, a, 0, 20, 20, 0).ok);
  const cash = w.farm.cash, book = a.accounts.buildingBookValue, equipmentBook = a.accounts.assets.equipmentBookValue;
  d.flags = 4; Object.assign(f.water, { scanX: 20, scanY: 20, scanning: true }); w.cells[worldIndex(20, 20)].terrain |= 0x1000;
  const result = advanceFlood(w, a, weather, d, f.water, f.random);
  assert.deepEqual(result.buildings, [1]); assert.equal(w.buildings[1].active, false); assert.equal(w.equipment[1].active, false);
  assert.equal(w.farm.cash, cash); assert.equal(a.accounts.buildingBookValue, book - w.buildingDefinitions[3].price);
  assert.equal(a.accounts.assets.equipmentBookValue, equipmentBook - w.equipmentDefinitions[0].price);
});

test('flood stop retains source high-bit loss, negative inactive counter and reset-on-manual-start behavior', () => {
  const f = fixture(), { scenario: w, weather, disasters: d, crops, market, finances } = f.state, s = f.water;
  d.flags = 4; weather.precipitationBonus = 4; s.counter = 8; s.rawFF6C = 123; s.rawFF6E = 456;
  const plain = w.cells[worldIndex(20, 20)], bridge = w.cells[worldIndex(30, 30)];
  plain.terrain = 0xe800 | 55; plain.overlay = 0x4800; bridge.terrain = 0xe800 | 172;
  advanceFloodCounter(d, s); assert.equal(s.counter, 9);
  assert.equal(advanceFlood(w, finances, weather, d, s, f.random).ended, true);
  assert.equal(plain.terrain, 28); assert.equal(plain.overlay, 0x4800); assert.equal(bridge.terrain, 0xc800 | 172);
  assert.equal(s.counter, -8); assert.equal(weather.precipitationBonus, 0); assert.equal(s.rawFF6C, 123); assert.equal(s.rawFF6E, 456);
  for (let week = 0; week < 20; week++) advanceFloodCounter(d, s); assert.equal(s.counter, -8);
  assert.equal(beginWaterDisaster(w, crops, market, weather, d, s, 'flood', 65535, f.random), true);
  assert.deepEqual(s, { counter: 0, scanning: true, scanX: 0, scanY: 0, rawFF6C: 0, rawFF6E: 0 });
  assert.equal(weather.precipitationBonus, 4); assert.equal(d.lastStartTick, 65535);
  s.counter = 127; advanceFloodCounter(d, s); assert.equal(s.counter, -128);
});

test('all original farms support drought recovery and full flood scans without altering source bytes or granting cash', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), w = readScenario(bytes), finances = readFinancialState(bytes);
    const crops = w.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)).rawDefinition);
    const f = fixture(), d = createMovingDisasters(), s = createWaterDisasters(), market = createColdMarket(), cash = w.farm.cash; loadMarketCropPrices(market, crops);
    assert.ok(beginWaterDisaster(w, crops, market, f.state.weather, d, s, 'drought', 0, f.random));
    assert.ok(stopWaterDisaster(w, f.state.weather, d, s, 'drought', f.random));
    assert.ok(beginWaterDisaster(w, crops, market, f.state.weather, d, s, 'flood', 1, f.random));
    let scanned = 0;
    while (s.scanning) scanned += advanceFlood(w, finances, f.state.weather, d, s, f.random).scanned;
    assert.equal(scanned, 94 * 94); assert.ok(stopWaterDisaster(w, f.state.weather, d, s, 'flood', f.random));
    assert.deepEqual(w.sourceBytes, Uint8Array.from(bytes)); assert.equal(w.farm.cash, cash);
  }
}, 15000);
