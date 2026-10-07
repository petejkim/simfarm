import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readArchive } from '../src/formats/archive';
import { decodePlanar, readBitmap, readPalette } from '../src/formats/graphics';
import { readCrop } from '../src/formats/crop';
import { readScenario, terrainTile } from '../src/formats/scenario';
const original = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const palette = Array.from({ length: 16 }, (_, i) => [i, i, i]);

test('bitplane significance, leftmost bit, row and plane ordering', () => {
  const image = decodePlanar(Uint8Array.of(0x80, 0, 0x40, 0, 0x20, 0, 0x10, 0x80), 8, 2, palette);
  assert.deepEqual(Array.from(image.rgba.filter((_, i) => i % 4 === 0)), [1, 2, 4, 8, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0]);
  assert.throws(() => decodePlanar(new Uint8Array(1), 8, 2, palette));
  assert.throws(() => readBitmap(new Uint8Array(3), palette));
});
test('all original archive boundaries, sentinel and crop metadata', () => {
  const index = original('MEGADATA.IDX'), data = original('MEGADATA.EEA');
  const archive = readArchive(index, data);
  assert.equal(archive.length, 151);
  assert.equal(archive.reduce((n, e) => n + e.bytes.length, 0), data.length);
  assert.equal(archive.at(-1)?.name, 'card48.hc');
  assert.equal(archive.find(e => e.name === 'ega16til.til')?.bytes.length, 880 * 128);
  const pal = readPalette(archive.find(e => e.name === 'simfarm.pal')!.bytes);
  for (const e of archive.filter(e => e.name.endsWith('.bmp'))) assert.ok(readBitmap(e.bytes, pal).rgba.length > 0);
  const wheat = readCrop('wheat', original('CROPS/WHEAT.CRP'));
  assert.equal(wheat.name, 'Wheat');
  assert.match(wheat.description, /Stores well in silos/);
  assert.equal(wheat.rawDefinition.length, 128);
  assert.throws(() => readArchive(index.subarray(0, -1), data));
  assert.throws(() => readArchive(index, data.subarray(0, -1)));
  const bad = Buffer.from(index); bad.writeUInt32LE(0, 36);
  assert.throws(() => readArchive(bad, data));
  const unsafe = Buffer.from(index); unsafe.write('../x.bmp\0', 0);
  assert.throws(() => readArchive(unsafe, data));
});
test('eight scenarios match the executable-backed 96×96 record layout', () => {
  for (let i = 0; i < 8; i++) {
    const scenario = readScenario(original(`SCEN${i}.SSM`));
    assert.equal(scenario.cells.length, 9216);
    assert.ok(scenario.cells.every(c => terrainTile(c) < 880));
  }
  assert.deepEqual(readScenario(original('SCEN0.SSM')).cells[0], { terrain: 21, overlay: 0, attribute: 1 });
  assert.equal(terrainTile({ terrain: 0x8834, overlay: 0, attribute: 0 }), 52);
  const bad = Buffer.from(original('SCEN0.SSM')); bad[0] = 0;
  assert.throws(() => readScenario(bad));
});

test('crop slots follow saved filenames, including substituted crops and case', () => {
  const first = readScenario(original('SCEN0.SSM'));
  assert.deepEqual(first.cropFiles.slice(0, 3), ['almonds.crp', 'grapes.crp', 'barley.crp']);
  assert.equal(readScenario(original('SCEN1.SSM')).cropFiles[15], 'gladiolu.crp');
  assert.equal(readScenario(original('SCEN2.SSM')).cropFiles[3], 'apples.crp');
  assert.equal(readScenario(original('SCEN7.SSM')).cropFiles[0], 'tobacco.crp');
  const bad = Buffer.from(original('SCEN0.SSM')); bad.write('../bad.crp\0', 0x21193);
  assert.throws(() => readScenario(bad));
});

test('transparent tile color 7 preserves underlying pixels, including opaque black', () => {
  const raster = decodePlanar(Uint8Array.of(0x80, 0x80, 0x80, 0x20), 8, 1, palette, 7);
  assert.equal(raster.rgba[3], 0); // 0111 is transparent.
  assert.deepEqual(Array.from(raster.rgba.subarray(4, 8)), [0, 0, 0, 255]);
  assert.deepEqual(Array.from(raster.rgba.subarray(8, 12)), [8, 8, 8, 255]);
});
