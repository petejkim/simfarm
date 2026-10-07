import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, terrainTile, worldIndex } from '../src/formats/scenario';
import { fenceLandSaleNeighbors } from '../src/simulation/land';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));

test('land-sale neighboring fences match source bounds, ownership, direction order and grass range', () => {
  const exe = source('SIMFARM.EXE');
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0x3d6aa, '837e060b'); exact(0x3d6b0, '837e080b'); exact(0x3d6cd, '2680bfbd0001');
  exact(0x3d74b, '2b46fe'); exact(0x3d7c5, '050800'); exact(0x3d869, '2b46f0');
  exact(0x3d8f7, '2b46f0'); exact(0x3d973, '050800'); exact(0x3cb7b, 'e85c0b');
  for (const offset of [0x3d7b7, 0x3d847, 0x3d8d5, 0x3d965]) exact(offset, '9a7815c221');
  assert.equal(exe.readUInt16LE(0x4ec60 + 0x85e), 15);
  // ES for category lengths is initialized to data-overlay segment 2be7.
  assert.equal(exe.readUInt16LE(0x846f0 + 0xcc86), 0x2be7);
  assert.equal(exe[0x4ec60 + 0x99e], 16);
});

test('all ownership masks and map boundaries fence only bordering owned regions with original asymmetric corners', () => {
  for (const rx of [0, 5, 11]) for (const ry of [0, 5, 11]) for (let mask = 0; mask < 16; mask++) {
    const world = readScenario(source(`SCEN${mask % 8}.SSM`));
    world.regionalConditions.fill(0);
    for (const c of world.cells) { c.terrain = 0xa800 | 15; c.overlay = 0x1234; c.attribute = 53; }
    const neighbors = [[rx, ry - 1], [rx, ry + 1], [rx - 1, ry], [rx + 1, ry]];
    const owned = neighbors.map(([x, y], bit) => x >= 0 && x < 12 && y >= 0 && y < 12 && Boolean(mask & (1 << bit)));
    neighbors.forEach(([x, y], bit) => { if (owned[bit]) world.regionalConditions[(x * 12 + y) * 7 + 1] = 1; });
    const beforeRegions = Uint8Array.from(world.regionalConditions), beforeFarm = { ...world.farm };
    fenceLandSaleNeighbors(world, rx, ry);
    for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) {
      const dx = x - rx * 8, dy = y - ry * 8, [n, s, w, e] = owned;
      const horizontal = ((n && dy === -1) || (s && dy === 8)) && dx >= (w ? -1 : 0) && dx < 8;
      const vertical = ((w && dx === -1) || (e && dx === 8)) && dy >= (n ? -1 : 0) && dy < 8;
      const c = world.cells[worldIndex(x, y)], tile = terrainTile(c);
      assert.equal(tile >= 177 && tile <= 187, Boolean(horizontal || vertical));
      if (!horizontal && !vertical) assert.equal(tile, 15);
      assert.equal(c.terrain & 0xf800, 0xa800); assert.equal(c.overlay, 0x1234); assert.equal(c.attribute, 53);
    }
    assert.deepEqual(world.regionalConditions, beforeRegions); assert.deepEqual(world.farm, beforeFarm);
  }
});

test('sale-side repair accepts only grass, leaves gates and other categories, and rejects invalid regions atomically', () => {
  const world = readScenario(source('SCEN4.SSM')); world.regionalConditions.fill(0);
  for (const [x, y] of [[4, 3], [4, 5], [3, 4], [5, 4]]) world.regionalConditions[(x * 12 + y) * 7 + 1] = 1;
  for (let tile = 0; tile < 1100; tile++) {
    for (const c of world.cells) c.terrain = 0;
    const targets = [[35, 31], [35, 40], [31, 35], [40, 35]].map(([x, y]) => world.cells[worldIndex(x, y)]);
    for (const c of targets) c.terrain = 0x8000 | tile;
    fenceLandSaleNeighbors(world, 4, 4);
    for (const c of targets) assert.equal(c.terrain, 0x8000 | (tile >= 15 && tile < 31 ? 177 : tile));
  }
  for (const owner of [0, 2, 128, 255]) {
    for (const c of world.cells) c.terrain = 15;
    for (let i = 1; i < world.regionalConditions.length; i += 7) world.regionalConditions[i] = owner;
    fenceLandSaleNeighbors(world, 4, 4);
    assert.ok(world.cells.every(c => c.terrain === 15));
  }
  const before = JSON.stringify(world);
  for (const [x, y] of [[-1, 0], [0, 12], [0.5, 4], [NaN, 2]]) assert.throws(() => fenceLandSaleNeighbors(world, x, y));
  assert.equal(JSON.stringify(world), before);
});
