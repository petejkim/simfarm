import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { TownLayouts, readTownConstructionState } from '../src/formats/town';
import { readScenario, terrainTile, worldIndex } from '../src/formats/scenario';
import { connectTownRoad, constructTownDistrict, resolveTownChoice } from '../src/simulation/town-construction';
import { beginTownExpansion } from '../src/simulation/town';
import { FarmRandom } from '../src/simulation/random';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const raw = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')).find(a => a.name === 'townly0.cmp')!.bytes;
const layouts = new TownLayouts(raw);
function setup(id = 4) {
  const bytes = source(`SCEN${id}.SSM`), s = readScenario(bytes), state = readTownConstructionState(bytes);
  return { s, state };
}
function empty() {
  const result = setup(); result.s.regionalConditions.fill(0);
  for (const c of result.s.cells) { c.terrain = 15; c.overlay = 0; c.attribute = 0; }
  result.state.recreationCount = 0; result.state.airportCount = 0;
  return result;
}

test('town patterns retain all source words and use the original 40-word stride and loader boundaries', () => {
  assert.equal(createHash('sha256').update(raw).digest('hex'), '6f8f3cac0d93bda8aa7d0be96fd4a07f6dace1241ffbc3f13a756ebfecec5be7');
  const e = source('SIMFARM.EXE'), exact = (o: number, hex: string) => assert.equal(e.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x4a383, '68c0036a02689061682c95');
  assert.equal(e.subarray(0x846f0 + 0xba70, 0x846f0 + 0xba70 + 12).toString(), 'townly0.cmp\0');
  exact(0x3ad5c, '6b76f4280376f20376f6d1e68b842c95');
  exact(0x3ac4c, '052300'); exact(0x3ac5c, '054600');
  exact(0x3ad6f, '2680a72504cf'); exact(0x3ad1c, '26808f254c40');
  const b = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  for (let type = 0; type < 15; type++) for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
    const band = type < 5 ? type : type < 10 ? type + 35 : type + 70;
    assert.equal(layouts.tile(type, x, y), b.getUint16(2 * (band * 8 + y * 40 + x), true));
  }
  for (const bytes of [raw.subarray(1), new Uint8Array(1921)]) assert.throws(() => new TownLayouts(bytes));
  for (const [t, x, y] of [[-1, 0, 0], [15, 0, 0], [0, 8, 0], [0, 0, -1], [NaN, 0, 0]]) assert.throws(() => layouts.tile(t, x, y));
  const custom = new Uint8Array(1920); custom[1918] = 255; custom[1919] = 255;
  const preserved = new TownLayouts(custom); custom.fill(0);
  assert.equal(preserved.tile(14, 7, 7), 65535); // Unknown source word remains intact.
});

test('town construction counters/coordinate bytes load separately on all farms and detach from the source', () => {
  const e = source('SIMFARM.EXE');
  assert.equal(e.subarray(0x45bc8, 0x45bcc).toString('hex'), '837ef008');
  assert.equal(e.subarray(0x45bdb, 0x45bde).toString('hex'), '68bc9c');
  assert.equal(e.subarray(0x46103, 0x46106).toString('hex'), '68c664');
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), before = Buffer.from(bytes), state = readTownConstructionState(bytes);
    assert.equal(state.recreationCount, bytes[0x21673]); assert.equal(state.airportCount, bytes[0x21712]);
    assert.deepEqual(Buffer.from(state.recreationCoordinates), bytes.subarray(0x21663, 0x21673));
    state.recreationCoordinates.fill(255); assert.deepEqual(bytes, before);
  }
  assert.throws(() => readTownConstructionState(new Uint8Array(0x21712)));
});

test('town roads reproduce all connection masks, retain paved neighbors, protect bridges and bound edges', () => {
  const { s } = empty(), e = source('SIMFARM.EXE');
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  assert.equal(e.subarray(0x846f0 + 0x5696, 0x846f0 + 0x56a6).toString('hex'), '04000b008000220005000b00ffffffff');
  for (let mask = 0; mask < 16; mask++) {
    for (const c of s.cells) c.terrain = 15;
    s.cells[worldIndex(40, 40)].terrain = 0x880f;
    dirs.forEach(([dx, dy], bit) => { if (mask & (1 << bit)) s.cells[worldIndex(40 + dx, 40 + dy)].terrain = 0xa096; });
    connectTownRoad(s, 40, 40);
    assert.equal(s.cells[worldIndex(40, 40)].terrain, 0x8800 | (161 + e.readUInt16LE(0x846f0 + 0x59c4 + mask * 2)));
    dirs.forEach(([dx, dy], bit) => {
      if (mask & (1 << bit)) assert.equal(s.cells[worldIndex(40 + dx, 40 + dy)].terrain,
        0xa000 | (150 + e.readUInt16LE(0x846f0 + 0x59c4 + (1 << ((bit + 2) % 4)) * 2)));
    });
  }
  s.cells[worldIndex(40, 39)].terrain = 0xf8ac; connectTownRoad(s, 40, 40);
  assert.equal(s.cells[worldIndex(40, 39)].terrain, 0xf8ac);
  for (const [x, y] of [[0, 0], [95, 0], [0, 95], [95, 95]]) assert.doesNotThrow(() => connectTownRoad(s, x, y));
  assert.throws(() => connectTownRoad(s, 96, 0));
});

test('all fifteen districts on all farms follow initial template/grass rules while preserving skipped tiles and unknown records', () => {
  for (let id = 0; id < 8; id++) for (let type = 0; type < 15; type++) {
    const { s, state } = setup(id), site = { regionX: 0, regionY: 0 };
    state.recreationCount = 0; s.regionalConditions[1] = 2;
    const sourceBefore = Buffer.from(s.sourceBytes), fieldBefore = s.fields.map(f => Array.from(f.bytes));
    const airportBefore = state.airportCount, coordinatesBefore = Uint8Array.from(state.recreationCoordinates);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
      Object.assign(s.cells[worldIndex(x, y)], { terrain: 0xb80f, overlay: 0x1234, attribute: x * 8 + y });
    }
    const regionBefore = Uint8Array.from(s.regionalConditions.slice(2, 7));
    const kept = [71, 72, 111, 112];
    kept.forEach((tile, i) => s.cells[worldIndex(1, i + 1)].terrain = 0xb800 | tile);
    const result = constructTownDistrict(s, state, layouts, site, type);
    assert.equal(result.ok, true);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
      const c = s.cells[worldIndex(x, y)], tile = layouts.tile(type, x, y);
      if (x === 1 && y >= 1 && y <= 4) assert.equal(c.terrain, 0xb800 | kept[y - 1]);
      else if (type === 5) assert.equal(c.terrain, 0x8800 | tile);
      else if (tile >= 161 && tile <= 172) { assert.ok(terrainTile(c) >= 161 && terrainTile(c) <= 171); assert.equal(c.terrain & 0xf800, 0x8800); }
      else assert.equal(c.terrain, 15 + ((x * 8 + y) & 15));
      assert.equal(c.overlay, 0x5234); assert.equal(c.attribute, x * 8 + y);
    }
    assert.equal(s.regionalConditions[0], type === 0 || type === 5 ? 0xa0 | type : type);
    assert.equal(s.regionalConditions[1], 2); assert.deepEqual(s.regionalConditions.slice(2, 7), regionBefore);
    assert.equal(state.airportCount, (airportBefore + Number(type === 5)) & 255);
    assert.equal(state.recreationCount, Number(type === 4));
    if (type === 4) coordinatesBefore.set([0, 0], 0);
    assert.deepEqual(state.recreationCoordinates, coordinatesBefore);
    assert.deepEqual(Buffer.from(s.sourceBytes), sourceBefore); assert.deepEqual(s.fields.map(f => Array.from(f.bytes)), fieldBefore);
    if (type === 0) { assert.equal(s.farm.townRegionX, 0); assert.equal(s.farm.townRegionY, 0); }
  }
});

test('recreation needs more than sixteen regions per prior site; malformed indices and types fail atomically', () => {
  const { s, state } = empty(), site = { regionX: 11, regionY: 11 };
  state.recreationCount = 1;
  for (let i = 0; i < 16; i++) s.regionalConditions[i * 7 + 1] = 2;
  let before = JSON.stringify([s, state]);
  assert.deepEqual(constructTownDistrict(s, state, layouts, site, 4), { ok: false, reason: 'recreation-limit' });
  assert.equal(JSON.stringify([s, state]), before);
  s.regionalConditions[143 * 7 + 1] = 2;
  assert.equal(constructTownDistrict(s, state, layouts, site, 4).ok, true);
  assert.deepEqual(Array.from(state.recreationCoordinates.slice(2, 4)), [88, 88]);
  state.recreationCount = 7;
  for (let i = 0; i < 144; i++) s.regionalConditions[i * 7 + 1] = 2;
  assert.equal(constructTownDistrict(s, state, layouts, site, 4).ok, false);
  for (const count of [8, 128, 255, -1]) {
    state.recreationCount = count; before = JSON.stringify([s, state]);
    assert.deepEqual(constructTownDistrict(s, state, layouts, site, 4), { ok: false, reason: 'invalid-state' });
    assert.equal(JSON.stringify([s, state]), before);
  }
  state.recreationCount = 0;
  for (const type of [-1, 15, 256, NaN]) assert.equal(constructTownDistrict(s, state, layouts, site, type).ok, false);
  assert.equal(constructTownDistrict(s, state, layouts, { regionX: 12, regionY: 0 }, 5).ok, false);
  state.airportCount = 255;
  assert.equal(constructTownDistrict(s, state, layouts, site, 5).ok, true); assert.equal(state.airportCount, 0);
});

test('reserved town choices use original RNG streams and retain failed recreational reservations', () => {
  for (const choice of ['residential', 'commercial', 'airport', 'recreational', 'timeout'] as const) {
    const { s, state } = empty(); s.farm.townRegionX = 6; s.farm.townRegionY = 6;
    const funds = { townRevenue: 100, expansionFunds: 15000 };
    const site = beginTownExpansion(s, funds)!;
    const random = new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });
    const expected = new FarmRandom(random.snapshot());
    const type = choice === 'residential' ? (expected.nextSimulation() & 7) + 6
      : choice === 'commercial' ? Math.min(3, (expected.nextSimulation() & 3) + 1)
      : choice === 'airport' ? 5 : choice === 'recreational' ? 4 : expected.below(14) + 1;
    assert.deepEqual(resolveTownChoice(s, state, layouts, site, choice, random), { ok: true, type, site });
    assert.deepEqual(random.snapshot(), expected.snapshot()); assert.equal(funds.expansionFunds, 0);
  }
  const { s, state } = empty(), site = { regionX: 6, regionY: 6 };
  s.regionalConditions[(6 * 12 + 6) * 7 + 1] = 2; state.recreationCount = 1;
  const random = new FarmRandom({ visual: 27, simulation: 9029, bounded: 6 });
  const before = JSON.stringify([s, state]);
  assert.deepEqual(resolveTownChoice(s, state, layouts, site, 'timeout', random), { ok: false, reason: 'recreation-limit' });
  assert.equal(JSON.stringify([s, state]), before); // Keep pending rather than silently claiming construction succeeded.
});
