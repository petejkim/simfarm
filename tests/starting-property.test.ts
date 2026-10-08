import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { worldIndex } from '../src/formats/scenario';
import { FarmRandom } from '../src/simulation/random';
import { initialTerrainHistory, TerrainRandom } from '../src/simulation/terrain-random';
import { generateFarmTerrain, type TerrainWorld } from '../src/simulation/terrain-generation';
import { initializeStartingProperty, isDrySetupRegion, selectStartingLocations } from '../src/simulation/starting-property';

const blank = (): TerrainWorld => ({ cells: Array.from({ length: 9216 }, () => ({ terrain: 23, overlay: 0, attribute: 8 })), regionalConditions: new Uint8Array(1008) });
function sequence(values: number[]) {
  let cursor = 0;
  return { nextVisual: () => { assert.ok(cursor < values.length, 'Unexpected RNG draw'); return values[cursor++]; },
    snapshot: () => ({ visual: cursor, simulation: 9029, bounded: 51 }) };
}

test('starting-location branches, water bounds, ownership and homestead cash are pinned to original instructions', () => {
  const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
  const exact = (o: number, h: string) => assert.equal(exe.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x33ac3, '2503007414487503e9fc00487503e92801487503e96601eb42');
  exact(0x33b62, '26ff3612008e062acb26a1100040500ee8c10283c4040bc07503e936ff');
  exact(0x33c7e, '8e062acb26a11000c1e0038e062ecb26a30c008e062ccb26a11200c1e0038e0630cb26a30e00c9');
  exact(0x33e70, '8e0634cb263b06600872d18e0636cb268a0e9f092aed8e0634cb26030e60083bc173b92bc0c9cb');
  exact(0x40f3c, '26c687bd0001ebd2'); exact(0x40fa3, '8e0692ce26808f254c08ebe1');
  exact(0x41016, '8e068ace26c706483e409c26c7064a3e00006a009a7409781c83c402');
  assert.equal(exe[0x4ec60 + 0x99f], 30); assert.equal(exe.readUInt16LE(0x4ec60 + 0x860), 39);
});

test('setup eligibility examines every region tile using low11-bit images rather than water flags', () => {
  const world = blank();
  for (const [regionX, regionY] of [[0, 0], [11, 11], [3, 8]]) {
    for (let dx = 0; dx < 8; dx++) for (let dy = 0; dy < 8; dy++) {
      const c = world.cells[worldIndex(regionX * 8 + dx, regionY * 8 + dy)];
      for (const tile of [38, 39, 68, 69, 141]) {
        c.terrain = 0xf800 | tile;
        assert.equal(isDrySetupRegion(world, regionX, regionY), tile < 39 || tile >= 69);
      }
      c.terrain = 23;
    }
  }
  for (const [x, y] of [[-1, 0], [12, 0], [0, 12], [1.5, 2], [NaN, 0]]) assert.equal(isDrySetupRegion(world, x, y), false);
});

test('all four source orientations retain exact coordinate formulas and differing visual draw counts', () => {
  const cases = [
    { draws: [0, 1, 4, 3], town: [3, 0], player: [6, 9] },
    { draws: [1, 2, 5, 3, 7], town: [9, 7], player: [4, 9] },
    { draws: [2, 7, 3, 0, 2], town: [9, 8], player: [2, 2] },
    { draws: [3, 7, 3, 1], town: [0, 9], player: [9, 3] },
  ];
  for (const { draws, town, player } of cases) {
    const world = blank(), before = structuredClone(world), random = sequence(draws);
    assert.deepEqual(selectStartingLocations(world, random), { ok: true, attempts: 1, locations: {
      town: { regionX: town[0], regionY: town[1] }, player: { regionX: player[0], regionY: player[1] },
    } });
    assert.equal(random.snapshot().visual, draws.length); assert.deepEqual(world, before);
  }
});

test('water rejects all five checked regions but the source accepts an unchecked third player strip', () => {
  for (const [x, y] of [[2, 6], [2, 0], [3, 6], [2, 7], [3, 7]]) {
    const world = blank(); world.cells[worldIndex(x * 8 + 7, y * 8 + 7)].terrain = 55;
    const random = sequence([0, 0, 0, 0, 3, 0, 0, 0]);
    const result = selectStartingLocations(world, random);
    assert.deepEqual(result, { ok: true, attempts: 2, locations: { town: { regionX: 0, regionY: 2 }, player: { regionX: 6, regionY: 2 } } });
    assert.equal(random.snapshot().visual, 8);
  }
  const world = blank(); world.cells[worldIndex(4 * 8, 8 * 8)].terrain = 0x3037;
  const chosen = selectStartingLocations(world, sequence([0, 0, 0, 0])); assert.ok(chosen.ok);
  initializeStartingProperty(world, chosen.locations.player);
  assert.equal(world.cells[worldIndex(32, 64)].terrain, 0x3037);
  assert.equal(world.cells[worldIndex(32, 64)].overlay & 0x800, 0x800);
});

test('repeated source visual states terminate impossible placement without guessing a replacement location', () => {
  const world = blank(); for (const c of world.cells) c.terrain = 55;
  const zero = new FarmRandom({ visual: 0, simulation: 9029, bounded: 51 }), before = structuredClone(world);
  assert.deepEqual(selectStartingLocations(world, zero), { ok: false, reason: 'no-reachable-location', attempts: 1 });
  assert.deepEqual(zero.snapshot(), { visual: 0, simulation: 9029, bounded: 51 }); assert.deepEqual(world, before);
  const live = new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });
  const result = selectStartingLocations(world, live); assert.equal(result.ok, false);
  assert.ok(result.attempts > 1 && result.attempts <= 65536);
  assert.equal(live.snapshot().simulation, 9029); assert.equal(live.snapshot().bounded, 51);
});

test('starting property grants nine regions and576 tiles, fences only the outer perimeter and paints the original rank0 home', () => {
  for (const [regionX, regionY] of [[0, 0], [9, 9], [2, 6]]) {
    const world = blank();
    for (let i = 0; i < world.regionalConditions.length; i++) if (i % 7 !== 1) world.regionalConditions[i] = i & 255;
    for (const c of world.cells) c.overlay = 0x4032;
    const oldRegions = Uint8Array.from(world.regionalConditions);
    const result = initializeStartingProperty(world, { regionX, regionY });
    assert.deepEqual(result, { cash: 40000, homestead: { x: regionX * 8, y: regionY * 8, rank: 0 } });
    assert.equal(world.regionalConditions.filter((n, i) => i % 7 === 1 && n === 1).length, 9);
    assert.equal(world.cells.filter(c => c.overlay === 0x4832).length, 576);
    assert.equal(world.cells.filter(c => c.terrain >= 177 && c.terrain <= 187).length, 92);
    for (let i = 0; i < 1008; i++) if (i % 7 !== 1) assert.equal(world.regionalConditions[i], oldRegions[i]);
    for (const [dx, dy, tile] of [[1, 1, 79], [2, 1, 79], [3, 1, 79], [3, 2, 79], [3, 3, 79], [1, 2, 252], [2, 2, 253], [1, 3, 292], [2, 3, 293]]) {
      assert.equal(world.cells[worldIndex(regionX * 8 + dx, regionY * 8 + dy)].terrain, tile);
    }
    assert.ok(world.cells.every(c => c.attribute === 8 && (c.overlay & ~0x800) === 0x4032));
  }
  const world = blank(), before = structuredClone(world);
  for (const x of [-1, 10, NaN, 1.5]) assert.throws(() => initializeStartingProperty(world, { regionX: x, regionY: 0 }), /property/);
  assert.deepEqual(world, before);
});

test('all source soil/water options can progress from generated terrain through selected locations to starting property', () => {
  for (const seed of [0, 27, 65535]) for (const soilMoisture of [0, 4, 8, 12]) for (const river of [false, true]) for (const lake of [false, true]) {
    const random = new FarmRandom({ visual: seed, simulation: 9029, bounded: 51 });
    const world = generateFarmTerrain(new Uint8Array(1008), { soilMoisture, river, lake }, random, new TerrainRandom(random, initialTerrainHistory(9029)));
    const before = random.snapshot(), restored = new FarmRandom(before), selected = selectStartingLocations(world, random);
    assert.deepEqual(selectStartingLocations(world, restored), selected); assert.deepEqual(random.snapshot(), restored.snapshot());
    // Seed0 can be trapped by a water feature; finite failure is an explicit result, not an invented reroll.
    if (!selected.ok) { assert.equal(seed, 0); continue; }
    const { town, player } = selected.locations;
    assert.ok(isDrySetupRegion(world, town.regionX, town.regionY));
    assert.ok(isDrySetupRegion(world, player.regionX, player.regionY));
    const result = initializeStartingProperty(world, player);
    assert.equal(result.cash, 40000); assert.equal(result.homestead.rank, 0);
    assert.equal(world.regionalConditions.filter((n, i) => i % 7 === 1 && n === 1).length, 9);
    assert.equal(random.snapshot().simulation, before.simulation); assert.equal(random.snapshot().bounded, before.bounded);
  }
});
