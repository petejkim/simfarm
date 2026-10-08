import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fieldWindbreaks, beginWindDisaster, advanceWindDisaster } from '../src/simulation/wind-disaster';
import { worldIndex } from '../src/formats/scenario';
import { disasterFixture } from './support/disasters';

test('wind start callback is price adjustment with no-op tornado/swarm modes; source tree bounds and sparse field branches are pinned', () => {
  const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
  assert.equal(exe.subarray(0x282cc, 0x282d6).toString('hex'), 'e81ef3ea500ace271a00');
  assert.equal(exe.subarray(0x4b226, 0x4b236).toString('hex'), 'f60b640ac20af60b200b7e0bf60bf60b');
  assert.equal(exe.readUInt16LE(0x4ec60 + 0x8da), 131); assert.equal(exe[0x4ec60 + 0x9dc], 16);
  assert.equal(exe.readUInt16LE(0x846f0 + 0x6aa8), 0);
  assert.equal(exe.subarray(0x37103, 0x37107).toString('hex'), '2b06a86a');
});

test('two-cell windbreak boundary counts covered rows/columns once, protects at8 and damages sparse exposed fields on every eligible call', () => {
  const f = disasterFixture(), w = f.state.scenario, field = w.fields[1], crops = f.state.crops;
  assert.equal(fieldWindbreaks(w, field), 0);
  for (let x = 20; x < 28; x++) { w.cells[worldIndex(x, 18)].terrain = 131; w.cells[worldIndex(x, 19)].terrain = 146; }
  assert.equal(fieldWindbreaks(w, field), 8);
  const other = w.fields[5]; other.bytes.set(field.bytes); other.bytes[10] = 50;
  advanceWindDisaster(w, crops, 8, 64, 0, 64); assert.equal(other.bytes[29], 200);
  advanceWindDisaster(w, crops, 8, 65, 0, 64); advanceWindDisaster(w, crops, 8, 66, 0, 64);
  assert.equal(field.bytes[29], 200); assert.equal(field.bytes[55], 8); assert.equal(other.bytes[29], 198); assert.equal(other.bytes[55], 0);
  w.cells[worldIndex(20, 18)].terrain = w.cells[worldIndex(20, 19)].terrain = 130;
  advanceWindDisaster(w, crops, 8, 67, 0, 64); assert.equal(field.bytes[29], 199); assert.equal(field.bytes[55], 7);
  advanceWindDisaster(w, crops, 8, 0, 65535, 0); assert.equal(field.bytes[29], 198);
  for (const [x, y] of [[0, 0], [88, 0], [0, 88], [88, 88]]) {
    field.bytes[10] = x; field.bytes[11] = y; assert.ok(fieldWindbreaks(w, field) >= 0);
  }
});

test('high-wind eligibility follows price changes, disabled starts are inert, and price arithmetic wraps before the source cap', () => {
  const f = disasterFixture(), { scenario: w, weather, disasters: d } = f.state;
  const crops = f.state.crops.map(c => [...c]), market = f.state.market, oldTrade = w.cropDefinitions[0].price;
  for (const c of crops) c[72] = 0;
  crops[0][72] = 1; crops[0][34] = 100; crops[0][35] = 0; market.history[0][29] = 100;
  d.enabled = false; assert.equal(beginWindDisaster(w, crops, market, weather, d, 1), false); assert.equal(market.history[0][29], 100);
  d.enabled = true; d.flags = 32; d.swarm.fieldSlot = 1; weather.wind = 5;
  assert.equal(beginWindDisaster(w, crops, market, weather, d, 2), true); assert.equal(d.flags, 8); assert.equal(weather.windAnomaly, 35);
  assert.equal(market.history[0][29], 150); assert.equal(w.cropDefinitions[0].price, oldTrade); assert.equal(d.lastStartTick, 2);
  assert.equal(beginWindDisaster(w, crops, market, weather, d, 3), false); assert.equal(market.history[0][29], 225); assert.equal(d.lastStartTick, 2);
  d.flags = 1; assert.equal(beginWindDisaster(w, crops, market, weather, d, 4), false); assert.equal(market.history[0][29], 337);
  beginWindDisaster(w, crops, market, weather, d, 5); assert.equal(market.history[0][29], 400);
  crops[0][34] = 30000 & 255; crops[0][35] = 30000 >> 8; market.history[0][29] = 65530;
  beginWindDisaster(w, crops, market, weather, d, 6); assert.equal(market.history[0][29], 32759);
});
