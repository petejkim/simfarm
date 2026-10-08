import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readMarketDefaults } from '../src/formats/market-defaults';
import { createColdMarket, adjustMarketForDisaster, adjustMarketForPlanting, loadMarketCropPrices, updateWeeklyMarket, validateMarketState } from '../src/simulation/market';
import { FarmRandom } from '../src/simulation/random';
import { createSetupRecords } from '../src/formats/new-farm-records';
import { newFarmAssets, newFarmExe as exe } from './support/new-farm';

const fresh = (price = 100, mood = 0) => ({ history: Array.from({ length: 16 }, () => Array(30).fill(price)), mood, rawBC72: 0 });
const crops = (base = 100) => Array.from({ length: 16 }, () => {
  const c = Array(128).fill(0); c[34] = base & 255; c[35] = base >>> 8; return c;
});
const tables = () => createSetupRecords(newFarmAssets.records);
const originalCrops = newFarmAssets.crops.map(c => [...c.rawDefinition]);
const rng = () => new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });
function scripted(initial: number, choice: number, magnitude: number, mood = 0) {
  const calls: string[] = [];
  let draw = 0;
  return { calls, nextSimulation: () => { calls.push('simulation'); return draw++ === 0 ? initial : draw % 2 === 0 ? choice : magnitude; },
    below: (limit: number) => { calls.push(`below(${limit})`); return mood; } };
}

test('market load, weekly dispatch, signed arithmetic and separate history writes match original bytes', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x2393, '8e06f2c526803ec466027503e91901'); // Loaded setup skips to24bb.
  exact(0x45a69, '6a008a46f05057560ee8ab0a83c408ff46f0837ef01072bb');
  exact(0x466d0, '268b95cec58e06f4ce268997386f899e4aff6bd93c8e06f6ce2689973afa');
  exact(0x915e6, '9f4d'); exact(0x9166c, '9f2d9f4d');
  exact(0xbe4c, '0ee8b2009a0600430c9aba0fe624'); // Aging bf02 then updater stub.
  exact(0x4aeaf, '9ad000fd05250f008946f63d0d007c0d6a039aa300fd0583c402a266bc');
  exact(0x4aecc, '803e72bc0c7e15fe0666bc803e66bc027e05c60666bc00c60672bc00');
  exact(0x4af39, '837efe0a7d0ac746fe0a00c60666bc01');
  exact(0x4af6f, '8b46fec1f8028e0690cf26898762723d0500730726c78762720500');
  exact(0x4afbf, '268b873afa8946fec1f8038946f8837efe007505c746fe0100');
  exact(0x4b07c, '268b873afa8bc8c1f8022bc826898f3afa');
  exact(0x4b0d7, '268b843afad3e82601843afa');
  // The only literal DSbc72 references found are its test and reset. This does
  // not prove indirect writers cannot exist; do not invent a weekly increment.
  const references: number[] = [];
  for (let i = 0; i < exe.length - 1; i++) if (exe[i] === 0x72 && exe[i + 1] === 0xbc) references.push(i);
  assert.deepEqual(references, [0x4aece, 0x4aee5]);
});

test('cold history decoding and crop loading preserve every other word and unknown mode byte without RNG', () => {
  assert.deepEqual(readMarketDefaults(exe), fresh(0));
  assert.deepEqual(createColdMarket(), readMarketDefaults(exe));
  assert.equal(createHash('sha256').update(exe.subarray(0x801e0, 0x805a0)).digest('hex'), '3dc463a76fc170607c07b104c3cb531362ce7d6e10c1a34e0c0f370aeae08ce8');
  const changed = Buffer.from(exe);
  for (let i = 0; i < 480; i++) changed.writeUInt16LE(i * 137 & 65535, 0x801e0 + i * 2);
  changed[0x90356] = 255; changed[0x90362] = 128;
  const backing = Buffer.alloc(exe.length + 17); changed.copy(backing, 9);
  const state = readMarketDefaults(backing.subarray(9, 9 + exe.length)), before = structuredClone(state);
  loadMarketCropPrices(state, originalCrops);
  for (let i = 0; i < 16; i++) {
    assert.deepEqual(state.history[i].slice(0, 29), before.history[i].slice(0, 29));
    assert.equal(state.history[i][29], originalCrops[i][34] | originalCrops[i][35] << 8);
  }
  assert.equal(state.mood, 255); assert.equal(state.rawBC72, 128);
  state.history[0][0] = 65535; assert.equal(changed.readUInt16LE(0x801e0), 0);
  assert.throws(() => readMarketDefaults(exe.subarray(0, -1)), /executable/);
  changed[0] = 0; assert.throws(() => readMarketDefaults(changed), /executable/);
});

test('weekly mood thresholds, conditional draws, history shift and all three trade tables are exact', () => {
  const world = tables(), defs = crops();
  for (let mood = 0; mood < 256; mood++) for (let choice = 0; choice < 8; choice++) for (let magnitude = 0; magnitude < 4; magnitude++) {
    const market = fresh(100, mood), random = scripted(0, choice, magnitude);
    market.history[0] = Array.from({ length: 30 }, (_, i) => i === 29 ? 100 : i);
    const raw = world.cropDefinitions[0].bytes.slice();
    updateWeeklyMarket(world, defs, market, random);
    const threshold = [3, 1, 5][mood];
    const expected = mood > 2 ? 100 : 100 + (choice <= threshold ? 1 : -1) * magnitude * 12;
    assert.deepEqual(market.history[0], [...Array.from({ length: 28 }, (_, i) => i + 1), 100, expected]);
    assert.equal(market.mood, mood);
    assert.equal(random.calls.length, mood <= 2 ? 33 : 17);
    for (let i = 0; i < 16; i++) {
      assert.equal(world.cropDefinitions[i].price, expected); assert.equal(world.harvestDefinitions[i].price, expected);
      assert.equal(world.seedDefinitions[i].price, expected >>> 2);
    }
    for (let i = 0; i < raw.length; i++) if (i !== 6 && i !== 7) assert.equal(world.cropDefinitions[0].bytes[i], raw[i]);
  }
});

test('weekly mood reroll and raw BC72 use separate RNG and signed byte comparisons', () => {
  const world = tables(), defs = crops();
  for (let initial = 0; initial < 16; initial++) for (let selected = 0; selected < 3; selected++) {
    const state = fresh(100, 2), random = scripted(initial, 0, 0, selected);
    updateWeeklyMarket(world, defs, state, random);
    assert.equal(state.mood, initial >= 13 ? selected : 2);
    assert.deepEqual(random.calls.slice(0, 2), initial >= 13 ? ['simulation', 'below(3)'] : ['simulation', 'simulation']);
    assert.equal(random.calls.length, initial >= 13 ? 34 : 33);
  }
  for (let mood = 0; mood < 256; mood++) for (const rawBC72 of [0, 12, 13, 127, 128, 255]) {
    const state = { ...fresh(100, mood), rawBC72 };
    updateWeeklyMarket(world, defs, state, { nextSimulation: () => 0, below: () => { throw new Error('Unexpected reroll'); } });
    const triggered = rawBC72 >= 13 && rawBC72 <= 127, increment = (mood + 1) & 255;
    const expected = !triggered ? mood : increment >= 3 && increment <= 127 ? 0 : increment;
    assert.equal(state.mood, expected); assert.equal(state.rawBC72, triggered ? 0 : rawBC72);
  }
});

test('signed eighth steps, word overflow and ordered unsigned then signed bounds retain original quirks', () => {
  const vectors = [
    // history, base, direction choice, magnitude, resulting price, resulting mood
    [100, 100, 0, 3, 136, 0], [100, 100, 7, 3, 64, 0],
    [1, 100, 0, 3, 50, 0], [1000, 100, 0, 3, 200, 0],
    [65535, 100, 0, 3, 200, 0], [65535, 100, 7, 3, 50, 0],
    [0, 0, 0, 3, 10, 1], [0, 19, 0, 3, 10, 1], [0, 20, 0, 3, 10, 0],
    [32767, 30000, 0, 0, 32767, 0], [32768, 30000, 0, 0, 10, 1],
    [50000, 32768, 0, 0, 16384, 0], [65535, 65535, 0, 0, 10, 1],
  ];
  for (const [head, base, choice, magnitude, price, mood] of vectors) {
    const state = fresh(head), world = tables();
    updateWeeklyMarket(world, crops(base), state, scripted(0, choice, magnitude));
    assert.equal(state.history[0][29], price, JSON.stringify([head, base, choice, magnitude]));
    assert.equal(state.mood, mood); assert.equal(world.seedDefinitions[0].price, Math.max(5, price >>> 2));
  }
  // A minimum-price change switches the global mood before the next crop;
  // an initially invalid mode consumes no magnitude until that switch.
  const market = fresh(100, 255), defs = crops(), world = tables();
  defs[0][34] = 0; market.history[0][29] = 0;
  let count = 0;
  updateWeeklyMarket(world, defs, market, { nextSimulation: () => count++ === 0 ? 0 : count === 2 ? 7 : count % 2 ? 3 : 1,
    below: () => { throw new Error('Unexpected reroll'); } });
  assert.equal(count, 32); assert.equal(market.mood, 1);
  assert.equal(market.history[0][29], 10); assert.equal(market.history[1][29], 88);
});

test('planting and each disaster affect history only, preserving shifts, no-ops and word wrapping', () => {
  for (const [head, expected] of [[0, 0], [3, 3], [100, 75], [32767, 24576], [32768, 40960], [65535, 0]]) {
    const market = fresh(head), before = structuredClone(market);
    adjustMarketForPlanting(market, 7); before.history[7][29] = expected;
    assert.deepEqual(market, before);
  }
  for (let mode = 1; mode <= 8; mode++) for (let sensitivity = 0; sensitivity <= 255; sensitivity++) {
    const market = fresh(65530), defs = crops(100);
    const offset = mode === 2 ? 71 : mode === 3 ? 70 : 72;
    defs.forEach(c => { c[offset] = sensitivity; });
    adjustMarketForDisaster(market, defs, mode);
    const shift = sensitivity % 32;
    const change = shift >= 16 ? 0 : Math.floor(65530 / 2 ** shift);
    const expected = sensitivity && [2, 3, 5, 6].includes(mode) ? Math.min((65530 + change) % 65536, 400) : 65530;
    assert.ok(market.history.every(row => row[29] === expected && row.slice(0, 29).every(v => v === 65530)));
    assert.equal(market.mood, 0); assert.equal(market.rawBC72, 0);
  }
  const state = fresh(), world = tables(), defs = crops(); defs.forEach(c => { c[71] = 1; });
  const before = structuredClone(world);
  adjustMarketForPlanting(state, 0); adjustMarketForDisaster(state, defs, 2);
  assert.deepEqual(structuredClone(world), before); assert.equal(state.history[0][29], 112);
  updateWeeklyMarket(world, defs, state, scripted(0, 0, 0));
  assert.equal(world.cropDefinitions[0].price, 112); assert.equal(world.harvestDefinitions[0].price, 112);
  assert.equal(world.seedDefinitions[0].price, 28);
});

test('market and RNG continuation survive detached serialization across weekly changes and events', () => {
  let state = readMarketDefaults(exe), random = rng(), world = tables();
  loadMarketCropPrices(state, originalCrops);
  const uninterrupted = structuredClone(state), controlRandom = rng(), controlWorld = tables();
  for (let week = 0; week < 52; week++) {
    for (const market of [state, uninterrupted]) {
      if (week % 5 === 0) adjustMarketForPlanting(market, week % 16);
      if (week % 7 === 0) adjustMarketForDisaster(market, originalCrops, 2);
    }
    updateWeeklyMarket(world, originalCrops, state, random);
    updateWeeklyMarket(controlWorld, originalCrops, uninterrupted, controlRandom);
    assert.deepEqual(state, uninterrupted); assert.deepEqual(random.snapshot(), controlRandom.snapshot());
    assert.deepEqual(world.cropDefinitions.map(d => d.price), controlWorld.cropDefinitions.map(d => d.price));
    state = JSON.parse(JSON.stringify(state)); validateMarketState(state);
    random = new FarmRandom(random.snapshot()); world = tables();
  }
  assert.equal(random.snapshot().visual, 27);
  // Independent Python calculation from CRP blocks and documented arithmetic,
  // not a capture from an emulated/running DOS game.
  const encoded = Buffer.alloc(960);
  state.history.flat().forEach((price, i) => encoded.writeUInt16LE(price!, i * 2));
  assert.equal(createHash('sha256').update(encoded).digest('hex'), '28ee597ec92285571b6fba2e84d6aead17d85135f4f812061943e0fde0862af2');
  assert.deepEqual(state.history.map(h => h[29]), [196, 26, 45, 68, 47, 112, 47, 32, 22, 238, 387, 161, 131, 970, 640, 34]);
  assert.equal(state.mood, 2); assert.equal(state.rawBC72, 0);
  assert.deepEqual(random.snapshot(), { visual: 27, simulation: 11253, bounded: 182 });
});

test('malformed market inputs reject before changing history, trade prices or RNG', () => {
  const world = tables(), defs = crops(), random = rng(), before = structuredClone(world), seed = random.snapshot();
  for (const bad of [-1, 65536, NaN, 1.5]) {
    const market = fresh(); market.history[15][29] = bad;
    assert.throws(() => updateWeeklyMarket(world, defs, market, random), /history/);
  }
  for (const value of [-1, 256, NaN, 0.5]) for (const key of ['mood', 'rawBC72'] as const) {
    const market = fresh(); market[key] = value;
    assert.throws(() => updateWeeklyMarket(world, defs, market, random), /byte/);
  }
  const market = fresh(), marketBefore = structuredClone(market);
  for (const slot of [-1, 16, NaN, 0.5]) assert.throws(() => adjustMarketForPlanting(market, slot), /slot/);
  for (const bad of [defs.slice(1), [...defs.slice(1), Array(127).fill(0)], [...defs.slice(1), Array(128).fill(256)]]) {
    assert.throws(() => updateWeeklyMarket(world, bad, market, random), /crop/);
    assert.throws(() => loadMarketCropPrices(market, bad), /crop/);
  }
  assert.throws(() => updateWeeklyMarket({ ...world, seedDefinitions: [] }, defs, market, random), /tables/);
  assert.deepEqual(market, marketBefore); assert.deepEqual(structuredClone(world), before); assert.deepEqual(random.snapshot(), seed);
});
