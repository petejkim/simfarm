import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { miniTileAtlas, readPalette, readInterleavedScreen } from '../src/formats/graphics';
import { renderTerrainPreview } from '../src/render/terrain-preview';
import { beginTerrainPreview, locateTerrainPreview, rebuildTerrainPreview } from '../src/simulation/terrain-preview';
import { FarmRandom } from '../src/simulation/random';
import { TerrainRandom, initialTerrainHistory } from '../src/simulation/terrain-random';
import { generateFarmTerrain, populateTerrain } from '../src/simulation/terrain-generation';
import { selectStartingLocations } from '../src/simulation/starting-property';

const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const exe = source('SIMFARM.EXE'), archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const asset = (name: string) => archive.find(a => a.name === name)!.bytes;
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const seeds = { visual: 27, simulation: 9029, bounded: 51 }, history = initialTerrainHistory(9029);

test('preview source pins preliminary generation, cold/reset water flags, custom redraw/rebuild and packed miniature uploads', () => {
  assert.equal(hash(exe), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o: number, hex: string) => assert.equal(exe.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x3f8aa, '0ee8d0099a7a13e624');
  exact(0x40285, 'b0c98e068acd26a221158e068ccd26a2db230ee87ffb');
  exact(0x846f0 + 0x67b4, '01'); exact(0x408e2, '8e0686cd26a2b467');
  exact(0x33145, '0ee85d0b'); exact(0x33d36, '0ee86cfd');
  exact(0x27060 + 0x123a + 3, 'ea0000ce270700');
  exact(0x27060 + 0x1230 + 3, 'ea3a07ce271300');
  exact(0x27060 + 0x1226 + 3, 'ead609ce270700');
  exact(0x337a6, 'a0b667c0e0028e061ecb26a264019a3012e6240ee8e904');
  exact(0x337f8, '8036b46701'); exact(0x33864, '8036b46702');
  exact(0x49450, '688007689f2d68accd1e68f0b7');
  exact(0x6ea5, '8b460ad1e003f0ac8ae024c08846fe');
  exact(0x7061, 'bac403b80201ef8a46fe2688058a46fa26884550');
  exact(0x40ab3, '26a0640198'); exact(0x40af5, '2500f80bd02689972404');
  for (const selector of [0xcd86, 0xcd8a, 0xcd8c, 0xcb1e]) assert.equal(exe.readUInt16LE(0x846f0 + selector), 0x6190);
  assert.equal(exe.subarray(0x8ae32, 0x8ae3f).toString('ascii'), 'defworld.int\0');
  assert.equal(hash(asset('defworld.int')), '68942e94ec397ccc644ffe1d1b3d123a54f5ffa73f401be06e75316d295ca57b');
  assert.equal(hash(asset('far_mapc.mbm')), '2fad5b9a88d639e943af13b85124898451edb055ec7acf12b0a5c49046ca5043');
});

test('miniature decoder preserves every row/plane/bit, typed-array offsets and exact boundaries', () => {
  const palette = Array.from({ length: 16 }, (_, i) => [i, i + 16, i + 32]);
  for (let plane = 0; plane < 4; plane++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const storage = new Uint8Array(1937), bytes = storage.subarray(9, 1929);
    bytes[1918 + y] = 1 << (7 - plane * 2 - x);
    const atlas = miniTileAtlas(bytes, palette), p = ((58 + y) * 64 + 62 + x) * 4;
    assert.deepEqual(Array.from(atlas.rgba.slice(p, p + 4)), [...palette[1 << plane], 255]);
    assert.equal(atlas.rgba.filter((n, i) => i % 4 === 0 && n !== 0).length, 1);
  }
  for (const n of [0, 1919, 1921]) assert.throws(() => miniTileAtlas(new Uint8Array(n), palette));
  assert.throws(() => miniTileAtlas(new Uint8Array(1920), palette.slice(1)));
  assert.throws(() => miniTileAtlas(new Uint8Array(1920), palette.map((c, i) => i === 0 ? [256, 0, 0] : c)));
  const atlas = miniTileAtlas(asset('far_mapc.mbm'), readPalette(asset('scenario.pal')));
  assert.deepEqual([atlas.width, atlas.height], [64, 60]);
  // Independent Python decoding from archive offsets gives these complete hashes.
  assert.equal(hash(atlas.rgba), '9e2f3b9e380d28cb557a30ac664f2de56a309c55cc253d5c55eb9efaae5febb8');
  assert.equal(hash(readInterleavedScreen(asset('defworld.int'), readPalette(asset('scenario.pal'))).rgba),
    '6ed5cbf89537cd4b49fc1c53067485901c807157bde2fae5a7ea9f2fac35636a');
});

test('cold and restart preliminary maps use different water flags, retain soil and do not choose sites until custom preview', () => {
  const regions = new Uint8Array(1008).fill(173), before = Uint8Array.from(regions);
  for (const entry of ['cold', 'restart'] as const) {
    const preliminary = beginTerrainPreview(regions, seeds, history, 5, entry);
    assert.equal(preliminary.locations, null); assert.equal(preliminary.terrain.soilMoisture, 5);
    assert.deepEqual(preliminary.raw, { ds1521: 201, ds23db: 201 });
    const random = new FarmRandom(seeds), terrain = new TerrainRandom(random, history);
    const reset = Uint8Array.from(regions); for (let i = 0; i < 144; i++) { reset[i * 7] = 255; reset[i * 7 + 1] = 0; }
    assert.deepEqual(preliminary.world, generateFarmTerrain(reset, { soilMoisture: 5, river: entry === 'cold', lake: false }, random, terrain));
    assert.deepEqual(preliminary.random, random.snapshot()); assert.deepEqual(preliminary.terrainHistory, terrain.snapshot());
    const viewed = locateTerrainPreview(preliminary), selected = selectStartingLocations(preliminary.world, random);
    assert.ok(selected.ok); assert.deepEqual(viewed.locations, selected.locations); assert.deepEqual(viewed.random, random.snapshot());
    assert.deepEqual(viewed.world, preliminary.world); assert.deepEqual(viewed.terrainHistory, preliminary.terrainHistory);
    viewed.world.cells[0].terrain ^= 1; assert.notEqual(viewed.world.cells[0].terrain, preliminary.world.cells[0].terrain);
    assert.equal(preliminary.locations, null); assert.deepEqual(regions, before);
  }
});

test('Generate World retains setup random streams across rerolls and applies only explicit selected water/rain', () => {
  let preview = locateTerrainPreview(beginTerrainPreview(new Uint8Array(1008), seeds, history, 8, 'restart'));
  for (const rain of [0, 1, 2, 3]) for (const river of [false, true]) for (const lake of [false, true]) {
    const before = structuredClone(preview), random = new FarmRandom(preview.random), terrain = new TerrainRandom(random, preview.terrainHistory);
    const expected = generateFarmTerrain(preview.world.regionalConditions, { soilMoisture: rain * 4, river, lake }, random, terrain);
    const sites = selectStartingLocations(expected, random); assert.ok(sites.ok);
    const next = rebuildTerrainPreview(preview, rain, { river, lake });
    assert.deepEqual(next.world, expected); assert.deepEqual(next.locations, sites.locations);
    assert.deepEqual(next.random, random.snapshot()); assert.deepEqual(next.terrainHistory, terrain.snapshot());
    assert.deepEqual(preview, before); assert.equal(next.random.simulation, seeds.simulation);
    preview = next;
  }
  const before = structuredClone(preview);
  for (const rain of [-1, 4, 0.5, NaN]) assert.throws(() => rebuildTerrainPreview(preview, rain, { river: false, lake: false }));
  assert.throws(() => rebuildTerrainPreview(preview, 2, { river: 1 as any, lake: false }));
  assert.deepEqual(preview, before);
});

test('retained signed soil follows word arithmetic; preview rendering preserves column order and bounds original atlas reads', () => {
  for (const soil of [-128, -19, -18, -16, -15, -1, 0, 12, 13, 127]) {
    const world = { cells: Array.from({ length: 9216 }, () => ({ terrain: 15, overlay: 0, attribute: 0 })), regionalConditions: new Uint8Array(1008) };
    populateTerrain(world, soil, { nextVisual: () => 0 });
    const sum = (15 + soil) & 65535, expected = (sum & 2047) < 15 ? (sum & 0xf800) | 15 : sum;
    assert.equal(world.cells[0].terrain, expected);
    assert.ok(world.cells.every(c => c.terrain === expected));
  }
  const atlas = miniTileAtlas(asset('far_mapc.mbm'), readPalette(asset('scenario.pal')));
  const world = { cells: Array.from({ length: 9216 }, (_, i) => ({ terrain: 0xf800 | (i % 960), overlay: 65535, attribute: 255 })) };
  const raster = renderTerrainPreview(world, atlas);
  for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) for (let row = 0; row < 2; row++) {
    const tile = (x * 96 + y) % 960, from = (((tile >> 5) * 2 + row) * 64 + (tile & 31) * 2) * 4;
    const to = ((y * 2 + row) * 192 + x * 2) * 4;
    assert.deepEqual(raster.rgba.slice(to, to + 8), atlas.rgba.slice(from, from + 8));
  }
  world.cells[0].terrain = 960; assert.throws(() => renderTerrainPreview(world, atlas), /outside/);
  assert.throws(() => beginTerrainPreview(new Uint8Array(1007), seeds, history, 8, 'cold'));
  for (const soil of [-129, 128, NaN]) assert.throws(() => beginTerrainPreview(new Uint8Array(1008), seeds, history, soil, 'cold'));
});
