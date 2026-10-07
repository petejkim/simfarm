import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readHomestead } from '../src/formats/homestead';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { homesteadRank, updateHomestead } from '../src/simulation/homestead';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const cash = [0, 60000, 200000, 400000, 550000, 750000];

test('homestead source pins independent saved coordinates, first-assignment sentinel, cash gap and tile stores', () => {
  const e = source('SIMFARM.EXE'), exact = (o: number, h: string) => assert.equal(e.subarray(o, o + h.length / 2).toString('hex'), h);
  exact(0x46054, '6a016a02689f2d680c009a4a078400'); exact(0x4606c, '6a016a02689f2d680e009a4a078400');
  assert.equal(e[0x846f0 + 0x462e], 255); exact(0x407a5, '26c6062e46ff');
  for (const p of [0xc92a, 0xc92c, 0xc92e]) assert.equal(e.readUInt16LE(0x846f0 + p), 0x2d9f);
  exact(0xcf09, '26813e483e3f42730a6a059a7409781c'); exact(0x41028, '6a009a7409781c');
  exact(0x1f328, '268987e604268987a605268987660626898768062689876a06');
  exact(0x1f3be, 'c746fefc00'); exact(0x1f3c6, 'c746fe1001'); exact(0x1f3ce, 'c746fe1201');
  exact(0x1f4ae, '268987e80440268987a805'); exact(0x1f4bc, '052800268987ea04'); exact(0x1f4c7, '052900268987aa05');
  for (const [p, name] of [[0x4561, 'boos.voc'], [0x45be, 'cheers.voc'], [0x45c9, 'cowman.xmi']] as const) {
    assert.equal(e.subarray(0x846f0 + p, 0x846f0 + p + name.length + 1).toString('ascii'), name + '\0');
  }
});

test('all original farms load saved tile origins without repaint or inferred rank; malformed footprints reject', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), before = Uint8Array.from(bytes), h = readHomestead(bytes);
    assert.deepEqual(h, { x: bytes.readUInt16LE(0x21707), y: bytes.readUInt16LE(0x21709), rank: 255 });
    assert.deepEqual(Uint8Array.from(bytes), before);
  }
  const bytes = source('SCEN4.SSM'); bytes.writeUInt16LE(92, 0x21707); bytes.writeUInt16LE(0, 0x21709);
  assert.deepEqual(readHomestead(bytes), { x: 92, y: 0, rank: 255 });
  assert.throws(() => readHomestead(bytes.subarray(0, 0x2170a)), /Binary range/);
  bytes.writeUInt16LE(93, 0x21707); assert.throws(() => readHomestead(bytes), /homestead/);
});

test('cash rank uses strict unsigned boundaries, including the omitted top range', () => {
  const limits = [60000, 200000, 400000, 550000, 750000, 999999];
  for (let i = 0; i < limits.length; i++) {
    assert.equal(homesteadRank(limits[i] - 1), i); assert.equal(homesteadRank(limits[i]), i === 5 ? null : i + 1);
  }
  for (const high of [1000000, 9999999, 0x80000000, 0xffffffff]) assert.equal(homesteadRank(high), null);
  for (const bad of [-1, 0.5, NaN, 0x100000000]) assert.throws(() => homesteadRank(bad));
});

test('all six house layouts replace exactly nine full terrain words and preserve other planes at map boundaries', () => {
  for (const [x, y] of [[0, 0], [92, 92], [56, 48]]) for (let rank = 0; rank < 6; rank++) {
    const { cells } = readScenario(source('SCEN4.SSM')), state = { x, y, rank: 255 };
    cells.forEach(c => { c.terrain |= 0xf800; });
    const before = cells.map(c => ({ ...c }));
    const result = updateHomestead(cells, state, cash[rank]);
    assert.deepEqual(result, { previousRank: 255, rank, notice: null, sound: null, music: null });
    const expected = new Map<number, number>();
    const base = [252, 272, 274, 274, 274, 274][rank];
    for (const [dx, dy, tile] of [[1, 2, base], [2, 2, base + 1], [1, 3, base + 40], [2, 3, base + 41],
      [1, 1, rank >= 3 ? 520 : 79], [2, 1, rank >= 4 ? 521 : 79], [3, 1, rank >= 4 ? 522 : 79],
      [3, 2, rank === 5 ? 523 : 79], [3, 3, rank === 5 ? 524 : 79]]) expected.set(worldIndex(x + dx, y + dy), tile);
    for (let i = 0; i < cells.length; i++) assert.deepEqual(cells[i], { ...before[i], terrain: expected.get(i) ?? before[i].terrain });
    assert.equal(state.rank, rank);
    const done = cells.map(c => ({ ...c })); assert.equal(updateHomestead(cells, state, cash[rank]), null);
    assert.equal(updateHomestead(cells, state, 999999), null); assert.deepEqual(cells, done); assert.equal(state.rank, rank);
  }
});

test('rank transitions emit original feedback once, clear obsolete decorations, and reject unsafe inputs before mutation', () => {
  const { cells } = readScenario(source('SCEN4.SSM')), state = { x: 56, y: 48, rank: 0 };
  assert.deepEqual(updateHomestead(cells, state, 800000), { previousRank: 0, rank: 5, notice: 'improved', sound: 'cheers', music: 'cowman' });
  assert.deepEqual(updateHomestead(cells, state, 0), { previousRank: 5, rank: 0, notice: 'declined', sound: 'boos', music: null });
  assert.equal(cells[worldIndex(59, 51)].terrain, 79);
  const before = cells.map(c => ({ ...c }));
  for (const bad of [{ x: 93, y: 0, rank: 0 }, { x: 0, y: -1, rank: 0 }, { ...state, rank: 6 }, { ...state, rank: 254 }]) {
    assert.throws(() => updateHomestead(cells, bad, 60000), /homestead/);
  }
  assert.throws(() => updateHomestead(cells.slice(1), state, 60000), /map/); assert.deepEqual(cells, before);
  assert.equal(state.rank, 0);
});
