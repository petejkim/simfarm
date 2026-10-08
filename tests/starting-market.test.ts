import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initializeCropPriceHistory, initializeStartingMarket } from '../src/simulation/starting-market';
import { FarmRandom } from '../src/simulation/random';
import { readNewFarmRecordDefaults, createSetupRecords } from '../src/formats/new-farm-records';
import { loadStartingCrops, resetSetupRecords } from '../src/simulation/new-farm-records';
import { readCrop } from '../src/formats/crop';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const exe = source('SIMFARM.EXE');
const defaults = readNewFarmRecordDefaults(exe);
const catalog = defaults.cropFiles.map(file => readCrop(file.slice(0, -4), source(`CROPS/${file.toUpperCase()}`)));

test('startup market history, cold mood and slot ordering are pinned to the executable', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0x24a2, 'c746be0000ff76be9a2e0fe62483c402ff46be837ebe107cec');
  exact(0x4ae07, '8e0686cf6b5e0612268b87386f8946fec1e8028946f8');
  exact(0x4ae24, '807ef6037e1a9ad000fd05a80174299ad000fd0525010040eb18807ef6017fe69ad000fd05a801740f9ad000fd0525010048f766f80146fe');
  exact(0x4ae65, '8b46fe8e067ecf6b5e061e8a4ef02aed03d9d1e326898700fa9ad000fd0524078846f6a066bc980bc074944874ab4875c6807ef6057ec0807ef601eb86');
  exact(0x9166e, '9f4d'); // ES history selector:4d9f, array atfa00.
  assert.equal(defaults.marketMood, exe[0x90356]); assert.equal(defaults.marketMood, 0);
  const retained = createSetupRecords({ ...defaults, marketMood: 255 });
  resetSetupRecords(retained); assert.equal(retained.marketMood, 255);
  assert.throws(() => createSetupRecords({ ...defaults, marketMood: -1 }), /bytes/);
});

test('every market mood and branch retains exact conditional draws and the final discarded adjustment', () => {
  for (let mood = 0; mood < 256; mood++) for (let choice = 0; choice < 8; choice++) {
    for (const gate of [0, 1]) for (const magnitude of [0, 1]) {
      // Derived branch table:0 splits3/4;1 splits1/2;2 only increases for6/7.
      const active = mood < 2 || (mood === 2 && choice >= 6);
      const increasing = mood === 0 ? choice >= 4 : mood === 1 ? choice >= 2 : true;
      const group = active ? (gate ? [choice, gate, magnitude] : [choice, gate]) : [choice];
      const delta = !active || !gate ? 0 : (increasing ? magnitude + 1 : magnitude - 1) * 25;
      let draws = 0;
      const history = initializeCropPriceHistory(100, mood, { nextSimulation: () => group[draws++ % group.length] | 0xff00 });
      assert.deepEqual(history, Array.from({ length: 30 }, (_, i) => (100 + i * delta) & 65535));
      assert.equal(draws, 30 * group.length); // Includes draws after history[29].
    }
  }
});

test('startup uses a fixed unsigned quarter-price step and wraps without the later market clamps', () => {
  for (const initial of [0, 1, 2, 3, 4, 7, 100, 32767, 32768, 65535]) {
    for (const [draws, factor] of [[[7, 1, 1], 2], [[0, 1, 0], -1]] as const) {
      let position = 0;
      const actual = initializeCropPriceHistory(initial, 0, { nextSimulation: () => draws[position++ % 3] });
      assert.deepEqual(actual, Array.from({ length: 30 }, (_, i) => (initial + i * (initial >>> 2) * factor) & 65535));
      assert.equal(position, 90); // Zero step still consumes all source draws.
    }
  }
  let draws = 0;
  const falling = initializeCropPriceHistory(100, 0, { nextSimulation: () => [0, 1, 0][draws++ % 3] });
  assert.deepEqual(falling.slice(0, 7), [100, 75, 50, 25, 0, 65511, 65486]);
  const realRandom = new FarmRandom({ visual: 27, simulation: 19, bounded: 51 });
  const corn = catalog[0].rawDefinition, cornPrice = corn[34] | corn[35] << 8;
  assert.equal(cornPrice, 150);
  const cornHistory = initializeCropPriceHistory(cornPrice, 0, realRandom);
  assert.equal(cornHistory[17], 2); assert.equal(cornHistory[18], 65501);
});

test('all sixteen original crops initialize sequentially without changing definition prices or other random streams', () => {
  const records = createSetupRecords(defaults);
  loadStartingCrops(records, defaults.cropFiles, catalog);
  const before = structuredClone(records);
  const prices = records.cropDefinitions.slice(0, 16).map(d => d.price);
  const random = new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });
  let draws = 0;
  const history = initializeStartingMarket(prices, records.marketMood, { nextSimulation: () => { draws++; return random.nextSimulation(); } });
  assert.deepEqual(structuredClone(records), before);
  assert.deepEqual(prices, catalog.map(c => c.rawDefinition[34] | c.rawDefinition[35] << 8));
  assert.equal(history.length, 16); assert.ok(history.every(h => h.length === 30));
  assert.equal(draws, 1206); assert.equal(random.snapshot().simulation, 10344);
  // Fixed vector independently calculated from the documented word arithmetic,
  // source CRP definition blocks and LFSR; not an original DOS execution trace.
  const encoded = Buffer.alloc(960);
  history.flat().forEach((price, i) => encoded.writeUInt16LE(price, i * 2));
  assert.equal(createHash('sha256').update(encoded).digest('hex'), 'd05fde61efbf8980b9e7c988cfc7b8df79a7d6871230df9ca2ba116941dd9cdc');
  assert.deepEqual(history[0].slice(0, 7), [150, 113, 113, 113, 113, 113, 187]);
  assert.equal(history[0][29], 594); assert.equal(history[15][29], 3);
  assert.equal(random.snapshot().visual, 27); assert.equal(random.snapshot().bounded, 51);
  const resumed = new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });
  const first = prices.slice(0, 7).map(p => initializeCropPriceHistory(p, 0, resumed));
  const continuation = new FarmRandom(resumed.snapshot());
  const rest = prices.slice(7).map(p => initializeCropPriceHistory(p, 0, continuation));
  assert.deepEqual([...first, ...rest], history); assert.deepEqual(continuation.snapshot(), random.snapshot());
  history[0][0] = 12345; assert.equal(history[1][0], prices[1]); assert.equal(records.cropDefinitions[0].price, prices[0]);
});

test('invalid market inputs reject before consuming random state', () => {
  const random = new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 }), before = random.snapshot();
  for (const price of [-1, 65536, 1.5, NaN, Infinity]) {
    assert.throws(() => initializeStartingMarket([...Array(15).fill(100), price], 0, random), /price/);
    assert.throws(() => initializeCropPriceHistory(price, 0, random), /price/);
  }
  for (const mood of [-1, 256, 1.5, NaN]) assert.throws(() => initializeStartingMarket(Array(16).fill(100), mood, random), /mood/);
  assert.throws(() => initializeStartingMarket(Array(15).fill(100), 0, random), /count/);
  assert.deepEqual(random.snapshot(), before);
});
