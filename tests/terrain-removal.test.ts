import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { clearManualTerrain, removableTerrain } from '../src/simulation/terrain-removal';
import { FarmRandom } from '../src/simulation/random';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const shapes = [0, 0, 1, 2, 0, 0, 3, 4, 1, 5, 1, 6, 7, 8, 9, 10];
function setup() {
  const w = readScenario(source('SCEN4.SSM'));
  for (const c of w.cells) { c.terrain = 15; c.overlay = 0x800; c.attribute = 0; }
  return w;
}
const rng = () => new FarmRandom({ visual: 1234, simulation: 5678, bounded: 90 });

test('road, fence, ditch and shore tables and removal call gates match executable evidence', () => {
  const e = source('SIMFARM.EXE'), words = (o: number, n: number) => Array.from({ length: n }, (_, i) => e.readUInt16LE(o + i * 2));
  assert.deepEqual(words(0x846f0 + 0x5696, 8), [4, 11, 128, 34, 5, 11, 65535, 65535]);
  assert.deepEqual(words(0x846f0 + 0x56ae, 10), [83, 11, 84, 11, 128, 34, 129, 36, 61, 34]);
  assert.deepEqual(words(0x846f0 + 0x56c6, 4), [78, 11, 80, 36]);
  assert.deepEqual(words(0x846f0 + 0x59c4, 16), shapes);
  assert.deepEqual(words(0x846f0 + 0x23dc, 16), [55, 51, 47, 49, 43, 57, 45, 65, 39, 53, 59, 67, 41, 61, 63, 65535]);
  const exact = (o: number, hex: string) => assert.equal(e.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x26222, '6a006a196aff9a2e00661a'); exact(0x26302, '9a5c028c14');
  exact(0x2541e, '0ac07452'); exact(0x25438, 'f6c1207537');
  exact(0x16fb0, '9a7d00fd05250100');
});

test('all2048 terrain IDs use precisely the manual removal ranges; accepted terrain retains flags, secondary words and source bytes', () => {
  const e = source('SIMFARM.EXE'), ranges = [[0x868, 0x9a3], [0x866, 0x9a2], [0x904, 0x9f1], [0x906, 0x9f2], [0x8fa, 0x9ec],
    [0x8fe, 0x9ee], [0x8da, 0x9dc], [0x8fc, 0x9ed], [0x960, 0xa1f], [0x95e, 0xa1e], [0x980, 0xa2f], [0x8ce, 0x9d6]];
  const accepted = new Set([192, 193, 73, 74, 113, 114]);
  for (const [o, c] of ranges) for (let i = 0; i < e[0x4ec60 + c]; i++) accepted.add(e.readUInt16LE(0x4ec60 + o) + i);
  const w = setup(), raw = Uint8Array.from(w.sourceBytes), cell = w.cells[worldIndex(40, 40)];
  for (let tile = 0; tile < 2048; tile++) {
    assert.equal(removableTerrain(tile), accepted.has(tile), String(tile)); if (!accepted.has(tile)) continue;
    cell.terrain = 0x8800 | tile; cell.attribute = 44; cell.overlay = 0xabcd;
    clearManualTerrain(w, 40, 40, 3);
    assert.deepEqual(cell, { terrain: 0x8800 | 29, overlay: 0xabcd, attribute: 44 });
  }
  assert.deepEqual(w.sourceBytes, raw);
});

test('road, fence and irrigation neighbors recompute all connection masks while isolated and fixed images retain their source shapes', () => {
  for (const base of [150, 161, 177, 87, 98]) for (let d = 0; d < 4; d++) for (let mask = 0; mask < 16; mask++) {
    const [dx, dy] = directions[d], opposite = (d + 2) % 4;
    if (mask & 1 << opposite) continue;
    const w = setup(), nx = 40 + dx, ny = 40 + dy;
    w.cells[worldIndex(40, 40)].terrain = base;
    const neighbor = w.cells[worldIndex(nx, ny)]; neighbor.terrain = 0x8000 | (base + shapes[mask | 1 << opposite]);
    for (const [i, [ox, oy]] of directions.entries()) if (mask & 1 << i) w.cells[worldIndex(nx + ox, ny + oy)].terrain = base;
    const before = neighbor.terrain; clearManualTerrain(w, 40, 40, 0);
    assert.equal(neighbor.terrain, mask ? 0x8000 | (base + shapes[mask]) : before);
  }
  const w = setup(); w.cells[worldIndex(40, 40)].terrain = 177;
  w.cells[worldIndex(41, 40)].terrain = 189; w.cells[worldIndex(42, 40)].terrain = 178;
  clearManualTerrain(w, 40, 40, 0); assert.equal(w.cells[worldIndex(41, 40)].terrain, 189);
  // Original gate removal omits fence-neighbor repair entirely (SF-113).
  w.cells[worldIndex(40, 40)].terrain = 188; w.cells[worldIndex(41, 40)].terrain = 187;
  clearManualTerrain(w, 40, 40, 0); assert.equal(w.cells[worldIndex(41, 40)].terrain, 187);
});

test('crossings repair both mixed road and irrigation families, clear only the water flag, and valves preserve adjacent orientation', () => {
  const w = setup(); const c = (x: number, y: number) => w.cells[worldIndex(x, y)];
  c(40, 40).terrain = 0xa000 | 172; c(41, 40).terrain = 160; c(42, 40).terrain = 161;
  c(40, 41).terrain = 108; c(40, 42).terrain = 87; c(39, 40).terrain = 122; c(39, 39).terrain = 98;
  clearManualTerrain(w, 40, 40, 0);
  assert.equal(c(40, 40).terrain, 0x800f); assert.equal(c(41, 40).terrain, 151); assert.equal(c(40, 41).terrain, 98); assert.equal(c(39, 40).terrain, 122);
  // Pump entry5 is not scanned by the original four-entry helper (SF-094).
  c(50, 50).terrain = 122; c(51, 50).terrain = 97; c(52, 50).terrain = 120;
  clearManualTerrain(w, 50, 50, 0); assert.equal(c(51, 50).terrain, 97); assert.equal(c(52, 50).terrain, 120);
});

test('shore restoration covers every neighbor mask and consumes only the original visual RNG; isolated water expands in source scan order', () => {
  const shores = [55, 51, 47, 49, 43, 57, 45, 65, 39, 53, 59, 67, 41, 61, 63];
  for (let mask = 0; mask < 15; mask++) {
    const w = setup(), random = rng(), expected = rng(), c = w.cells[worldIndex(40, 40)]; c.terrain = 0x3000 | 535;
    for (const [i, [dx, dy]] of directions.entries()) if (!(mask & 8 >>> i)) w.cells[worldIndex(40 + dx, 40 + dy)].terrain |= 0x2000;
    clearManualTerrain(w, 40, 40, 0, random);
    assert.equal(c.terrain, 0x3000 | (shores[mask] + (expected.nextVisual() & 1))); assert.deepEqual(random.snapshot(), expected.snapshot());
  }
  const w = setup(), random = rng(), expected = rng(); w.cells[worldIndex(40, 40)].terrain = 0x3000 | 535;
  clearManualTerrain(w, 40, 40, 0, random);
  const bases = [25, 67, 65, 61, 45, 45, 63, 45, 45];
  for (let i = 0; i < 9; i++) {
    const x = 39 + Math.floor(i / 3), y = 39 + i % 3;
    assert.equal(w.cells[worldIndex(x, y)].terrain, i === 0 ? 25 : (i === 4 ? 0x3000 : 0x2000) | (bases[i] + (expected.nextVisual() & 1)));
  }
  assert.deepEqual(random.snapshot(), expected.snapshot());
  assert.equal(w.cells[worldIndex(38, 40)].terrain, 15);
});

test('shoreline edges and protected town/pump/crossing neighbors remain bounded; missing RNG rejects before mutation', () => {
  for (const [x, y] of [[0, 0], [0, 95], [95, 0], [95, 95]]) {
    const w = setup(), random = rng(), c = w.cells[worldIndex(x, y)]; c.terrain = 0x3000 | 535;
    const before = JSON.stringify(w); assert.throws(() => clearManualTerrain(w, x, y, 0)); assert.equal(JSON.stringify(w), before);
    clearManualTerrain(w, x, y, 0, random); assert.ok(c.terrain & 0x2000);
    assert.equal(w.cells.filter(c => c.terrain !== 15).length, 1);
  }
  for (const protection of ['town', 'pump', 'crossing']) {
    const w = setup(), random = rng(); w.cells[worldIndex(40, 40)].terrain = 0x3000 | 535;
    const c = w.cells[worldIndex(39, 40)]; c.terrain = protection === 'pump' ? 120 : protection === 'crossing' ? 173 : 161;
    if (protection === 'town') c.overlay |= 0x4000;
    const tile = c.terrain; clearManualTerrain(w, 40, 40, 0, random); assert.equal(c.terrain, tile | 0x2000);
  }
});
