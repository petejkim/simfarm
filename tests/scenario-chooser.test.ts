import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readInterleavedScreen, readPalette } from '../src/formats/graphics';
import { readScenarioChooser, readSetupMap } from '../src/formats/new-farm';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const exe = source('SIMFARM.EXE'), archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const asset = (name: string) => archive.find(e => e.name === name)!;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('screen strip reads and the VGA row/plane upload order are pinned to original instructions', () => {
  assert.equal(hash(exe), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  assert.equal(exe.subarray(0x31d7e, 0x31d97).toString('hex'), '6a006a0068800c6a01ffb632feffb630fe9aa2023f1d83c40c');
  assert.equal(exe.subarray(0x63cf, 0x63f3).toString('hex'), 'b30ab95000f3a483ef50d0e7b0028ae7ef80ff1075ec83c750b701b0028ae7effecb75de');
});

test('INT scanlines preserve plane significance, MSB first, strip edges and typed-array offsets', () => {
  const raw = new Uint8Array(153600), palette = Array.from({ length: 16 }, (_, i) => [i, i, i]);
  for (const y of [0, 1, 9, 10, 349, 350, 479]) {
    for (let plane = 0; plane < 4; plane++) raw[y * 320 + plane * 80] = 128 >> plane;
    raw[y * 320 + 319] = 1;
  }
  const before = raw.slice(), padded = new Uint8Array(raw.length + 7); padded.set(raw, 7);
  const image = readInterleavedScreen(padded.subarray(7), palette);
  assert.deepEqual([image.width, image.height], [640, 480]);
  for (let y = 0; y < 480; y++) for (let x = 0; x < 640; x++) {
    const marked = [0, 1, 9, 10, 349, 350, 479].includes(y);
    const color = marked ? (x < 4 ? 1 << x : x === 639 ? 8 : 0) : 0, p = (y * 640 + x) * 4;
    assert.equal(image.rgba[p], color); assert.equal(image.rgba[p + 3], 255);
  }
  image.rgba.fill(0); assert.deepEqual(raw, before); assert.deepEqual(padded.subarray(7), before);
  for (const size of [0, 319, 320, 3199, 3200, 112000, 153599, 153601])
    assert.throws(() => readInterleavedScreen(new Uint8Array(size), palette), /screen size/);
  assert.throws(() => readInterleavedScreen(raw, palette.slice(1)), /planar/);
});

test('three imported original screens match independent scanline-decoder RGBA hashes', () => {
  // RGBA digests independently computed in Python directly from four80-byte row planes.
  for (const [name, offset, rawHash, rgbaHash] of [
    ['scenario',1101903,'6d0e8c46a7daa234156297c30d5c7f3c31495cd75b8c7af49def4a4798e0da4c','58893a592c53294c30746a0206d522e31317a67a6bfa2da99a35b0d7b57e2cdf'],
    ['sftitle',1562703,'afe829e3a4e823295a32af21e2d3ba0f8bd88bd8f1f655db5f6dc1cbcf953cc5','32269cf18061fa1d62f8bd9197da0347e8ce23f4210ec4abf0e83ae3ab36d349'],
    ['prsnt480',1255503,'88da110ca42f4111a0643618226c65ff70647630063617029e98686b328ff843','cbfca80cdc25a46a7f888a61deaf53d39882ad4d95826587b08422e811a6c169'],
  ] as const) {
    const entry = asset(`${name}.int`); assert.equal(entry.offset, offset); assert.equal(entry.bytes.length, 153600);
    assert.equal(hash(entry.bytes), rawHash);
    assert.equal(hash(readInterleavedScreen(entry.bytes, readPalette(asset(`${name}.pal`).bytes)).rgba), rgbaHash);
  }
});

test('eight region markers select SCEN files in source order and initial selection is independent of saved climate', () => {
  const chooser = readScenarioChooser(exe), locations = readSetupMap(asset('scenario.odt').bytes).locations;
  assert.deepEqual(chooser.farms.map(({ x, y }) => [x, y]), [[0,8],[1,11],[1,3],[3,6],[9,7],[11,6],[13,11],[15,8]]);
  assert.deepEqual(chooser.initialLocation, { x: 2, y: 8 });
  for (const [i, farm] of chooser.farms.entries()) {
    assert.equal(farm.id, i); assert.equal(locations[farm.y * 18 + farm.x].selectable, true);
    assert.equal(source(`SCEN${i}.SSM`).length, 139072);
  }
  assert.equal(locations[8 * 18 + 2].selectable, true);
  assert.equal(exe.subarray(0x32349, 0x32362).toString('hex'), '8b9e34fe8a87ae66983b8648fa75e68a87b666983b46fe75dc');
  assert.equal(exe.subarray(0x32362, 0x32383).toString('hex'), '531e686d66689f2d68e4c49aa82a840083c40a689f2d68e4c49a1c12e62483c404');
  assert.equal(exe.subarray(0x8ad5d, 0x8ad68).toString(), 'scen%d.ssm\0');
});

test('chooser data rejects missing executable and out-of-grid coordinates while returning detached metadata', () => {
  const before = hash(exe), chooser = readScenarioChooser(exe); chooser.farms[0].x = 17; chooser.initialLocation.x = 17;
  assert.equal(hash(exe), before); assert.equal(readScenarioChooser(exe).farms[0].x, 0);
  for (const offset of [0x8ad9e, 0x8ada6, 0x8adb0, 0x8adb2]) {
    const bad = Uint8Array.from(exe); bad[offset] = 18; assert.throws(() => readScenarioChooser(bad), /coordinate/);
  }
  assert.throws(() => readScenarioChooser(exe.subarray(1)), /executable/);
  const bad = Uint8Array.from(exe); bad[0] = 0; assert.throws(() => readScenarioChooser(bad), /executable/);
  const padded = new Uint8Array(exe.length + 13); padded.set(exe, 13);
  assert.deepEqual(readScenarioChooser(padded.subarray(13)), readScenarioChooser(exe));
});
