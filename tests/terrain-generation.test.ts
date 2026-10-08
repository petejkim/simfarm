import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { worldIndex } from '../src/formats/scenario';
import { FarmRandom } from '../src/simulation/random';
import { initialTerrainHistory, TerrainRandom } from '../src/simulation/terrain-random';
import { addTerrainWater, generateFarmTerrain, generateTerrainHeights, populateTerrain, terrainHeightAt, type TerrainWorld } from '../src/simulation/terrain-generation';

const blank = (): TerrainWorld => ({ cells: Array.from({ length: 9216 }, () => ({ terrain: 16, overlay: 0, attribute: 1 })), regionalConditions: new Uint8Array(1008) });
const rng = (seed = 9029) => new FarmRandom({ visual: 27, simulation: seed, bounded: 51 });

test('terrain generation pins source RNG state, interpolation passes, feature options and regional sampling', () => {
  const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
  const exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x81f5, '8b5e06b8ff7f33d243f7fb8946fec706851b0000bb08008b87791b89877b1b0106851b83eb0275efa1851b89877b1b');
  exact(0x8229, '83e01f01877b1b5825ff7f8b5efe33d2f7fb3b46067f055a8be55dcb');
  exact(0x39c52, '837e06007d09b860002b4606894606837e06607e04836e0660');
  exact(0x39e76, '6a1f6a100ee826fe83c4046a0f6a080ee81bfe83c4046a076a040ee810fe83c4046a036a020ee805fe83c4046a016a010ee8fafdc9');
  exact(0x40b09, '2680bce49f0a722e8bf8895ef4897ef69a7d00fd05240f3a46067d1a');
  exact(0x40d31, '6bc76003f0268a84e49f8bc8c0e0048e0678ce2688878d03c0e1028e067ace26888ffd02');
  exact(0x3fea2, '26f606b46701'); exact(0x4006a, '26f606b46702');
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => exe.readUInt16LE(0x8626b + i * 2)), initialTerrainHistory(0));
  for (const [offset, value] of [[0x85e, 15], [0x860, 39], [0x8da, 131], [0x980, 535]]) assert.equal(exe.readUInt16LE(0x4ec60 + offset), value);
});

test('setup random history uses the pre-perturbation sum, wraps words, retains the fifth word and resumes rerolls', () => {
  let calls = 0;
  const r = new TerrainRandom({ nextVisual: () => { calls++; return 31; } }, initialTerrainHistory(0));
  assert.equal(r.inclusive(31), 6); assert.deepEqual(r.snapshot(), [6191, 1018, 4521, 202, 419]);
  assert.equal(r.inclusive(15), 5); assert.deepEqual(r.snapshot(), [11963, 6191, 1018, 4521, 202]);
  assert.equal(calls, 2);
  assert.deepEqual(initialTerrainHistory(65535), [1025, 4528, 209, 419, 3]);
  const wrap = new TerrainRandom({ nextVisual: () => 31 }, [65535, 65535, 65535, 65535, 0]);
  assert.equal(wrap.inclusive(31), 31); assert.deepEqual(wrap.snapshot(), [27, 65535, 65535, 65535, 65535]);
  const untouched = new TerrainRandom({ nextVisual: () => 0 }, [0, 0, 0, 0, 65535]);
  assert.equal(untouched.inclusive(31), 0); assert.deepEqual(untouched.snapshot(), [0, 0, 0, 0, 0]);
  const a = rng(), ar = new TerrainRandom(a, initialTerrainHistory(9029));
  for (let i = 0; i < 50; i++) ar.inclusive(31);
  const b = new FarmRandom(a.snapshot()), br = new TerrainRandom(b, ar.snapshot());
  for (let i = 0; i < 100; i++) assert.equal(ar.inclusive(i % 32), br.inclusive(i % 32));
  assert.deepEqual(a.snapshot(), b.snapshot()); assert.deepEqual(ar.snapshot(), br.snapshot());
  const before = r.snapshot();
  for (const bound of [-1, 32767, NaN, 0.5]) assert.throws(() => r.inclusive(bound), /bound/);
  assert.deepEqual(r.snapshot(), before); assert.equal(calls, 2);
  assert.throws(() => new TerrainRandom(a, [0, 0, 0, 0, 65536]), /history/);
});

test('height lookup preserves negative reflection, >96 wrapping and exact96 map/overlay aliases', () => {
  const world = blank();
  world.cells[worldIndex(16, 5)].terrain = 30;
  assert.equal(terrainHeightAt(world, -16, 5), 15); assert.equal(terrainHeightAt(world, 112, 5), 15);
  world.cells[worldIndex(6, 0)].terrain = 22;
  assert.equal(terrainHeightAt(world, 5, 96), 7);
  world.cells[5].overlay = 28; assert.equal(terrainHeightAt(world, 96, 5), 13);
  world.cells[96].overlay = 26; assert.equal(terrainHeightAt(world, 96, 96), 11);
});

test('five interpolation passes retain nine coarse anchors, clamp heights and reset every map channel', () => {
  for (const extreme of ['zero', 'neutral', 'maximum'] as const) {
    const world = blank(), counts = new Map<number, number>();
    for (const c of world.cells) { c.overlay = 65535; c.attribute = 255; }
    generateTerrainHeights(world, { inclusive: maximum => {
      counts.set(maximum, (counts.get(maximum) ?? 0) + 1);
      return extreme === 'zero' ? 0 : extreme === 'neutral' ? (maximum + 1) / 2 : maximum;
    } });
    assert.deepEqual([...counts], [[31, 27], [15, 108], [7, 432], [3, 1728], [1, 6912]]);
    for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) {
      const c = world.cells[worldIndex(x, y)], anchor = x % 32 === 0 && y % 32 === 0;
      assert.equal(c.overlay, 0); assert.equal(c.attribute, 0);
      if (anchor) assert.equal(c.terrain, 0);
      else if (extreme !== 'maximum') assert.equal(c.terrain, 16);
      else assert.ok(c.terrain >= 16 && c.terrain <= 30);
    }
  }
});

test('vegetation thresholds, source RNG consumption and regional channels retain unscaled sampling', () => {
  const world = blank(); world.regionalConditions.fill(173);
  world.cells[worldIndex(0, 0)].terrain = 25; // attribute10 -> tree141.
  world.cells[worldIndex(1, 0)].terrain = 19; // attribute4 -> rock538.
  world.cells[worldIndex(2, 0)].terrain = 20; // attribute5, rejected rock.
  world.cells[worldIndex(3, 0)].terrain = 30; // attribute15, rejected tree.
  const draws = [6, 1, 3, 2, 7]; let calls = 0;
  populateTerrain(world, 8, { nextVisual: () => { calls++; return draws.shift() ?? 9; } });
  assert.equal(calls, 5 + 432);
  assert.deepEqual(world.cells.slice(0, 1).map(c => c.terrain), [141]);
  assert.equal(world.cells[worldIndex(1, 0)].terrain, 538);
  assert.equal(world.cells[worldIndex(2, 0)].terrain, 24);
  assert.equal(world.cells[worldIndex(3, 0)].terrain, 26);
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) {
    const region = (x * 12 + y) * 7, attribute = world.cells[worldIndex(x, y)].attribute;
    assert.deepEqual(Array.from(world.regionalConditions.slice(region, region + 7)), [173, 173, 36, 36, 36, attribute * 4, attribute * 16]);
  }
  assert.notEqual(world.regionalConditions[(3 * 12) * 7 + 6], world.cells[worldIndex(24, 0)].attribute * 16);
  assert.equal(world.cells[worldIndex(1, 1)].attribute, 3); // Eight neighbors:10+4+5+five1, truncated /8.
});

test('river brush has both orientations, consumes final-step randomness and clips origin-only edge checks', () => {
  for (const alongY of [false, true]) {
    const world = blank(); let calls = 0, bounds = 0;
    addTerrainWater(world, { river: true, lake: false }, {
      below: n => { assert.equal(n, 94); bounds++; return 93; },
      nextVisual: () => { const call = calls++; return call === 0 ? Number(alongY) : call < 5 ? 1 : 0; },
    });
    assert.equal(calls, 193); assert.equal(bounds, 1);
    assert.ok(world.cells.every(c => c.overlay === 0));
    const at = (distance: number, transverse: number) => world.cells[worldIndex(alongY ? transverse : distance, alongY ? distance : transverse)];
    assert.equal(at(0, 93).terrain, 0x3037); assert.equal(at(1, 94).terrain, 0x3037); assert.equal(at(2, 95).terrain, 0x3037);
    assert.equal(at(95, 95).terrain, 0x3037); assert.equal(at(3, 0).terrain, 16);
  }
  const world = blank(); let calls = 0;
  addTerrainWater(world, { river: false, lake: false }, { below: () => { throw Error('unused'); }, nextVisual: () => ++calls });
  assert.equal(calls, 0); assert.ok(world.cells.every(c => c.terrain === 16));
});

test('lake rows use original asymmetric width progression and bounded draw order', () => {
  const world = blank(), bounds: number[] = []; let calls = 0;
  addTerrainWater(world, { river: false, lake: true }, {
    below: n => { bounds.push(n); return 10; }, nextVisual: () => { calls++; return 0; },
  });
  assert.deepEqual(bounds, [24, 48, 24, 48]); assert.equal(calls, 9);
  assert.deepEqual(Array.from({ length: 8 }, (_, row) => world.cells.filter((c, index) => index % 96 === 20 + row && c.terrain === 0x3037).length), [1, 3, 5, 7, 9, 7, 5, 3]);
  assert.equal(world.cells.filter(c => c.terrain === 0x3037).length, 40);
  assert.ok(world.cells.every(c => c.overlay === 0));
});

test('complete terrain generation is deterministic across soil/options and resumed rerolls, preserving unrelated region bytes', () => {
  for (const soilMoisture of [0, 4, 8, 12]) for (const river of [false, true]) for (const lake of [false, true]) {
    const input = Uint8Array.from({ length: 1008 }, (_, i) => i & 255), original = Uint8Array.from(input);
    const a = rng(), b = rng(), ar = new TerrainRandom(a, initialTerrainHistory(9029)), br = new TerrainRandom(b, initialTerrainHistory(9029));
    const options = { soilMoisture, river, lake };
    const first = generateFarmTerrain(input, options, a, ar), second = generateFarmTerrain(input, options, b, br);
    assert.deepEqual(first, second); assert.deepEqual(a.snapshot(), b.snapshot()); assert.deepEqual(ar.snapshot(), br.snapshot());
    assert.deepEqual(input, original); assert.equal(a.snapshot().simulation, 9029);
    for (let i = 0; i < 144; i++) assert.deepEqual(first.regionalConditions.slice(i * 7, i * 7 + 2), input.slice(i * 7, i * 7 + 2));
    assert.ok(first.cells.every(c => c.overlay === 0 && c.attribute >= 0 && c.attribute <= 15 && (c.terrain & 2047) >= 15 && (c.terrain & 2047) <= 538));
    assert.equal(first.cells.some(c => c.terrain & 0x2000), river || lake);
    const restored = new FarmRandom(a.snapshot()), restoredTerrain = new TerrainRandom(restored, ar.snapshot());
    assert.deepEqual(generateFarmTerrain(input, options, a, ar), generateFarmTerrain(input, options, restored, restoredTerrain));
    assert.deepEqual(a.snapshot(), restored.snapshot()); assert.deepEqual(ar.snapshot(), restoredTerrain.snapshot());
  }
});
