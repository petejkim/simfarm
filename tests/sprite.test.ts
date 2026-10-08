import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readPalette } from '../src/formats/graphics';
import { readSprite, spriteAtlas } from '../src/formats/sprite';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const palette = readPalette(entries.find(e => e.name === 'simfarm.pal')!.bytes);

test('all flight/disaster sprite pixels and atlas frames match fingerprinted original mask and colour planes', () => {
  for (const [name, offset, count, width, height, hash] of [
    ['airplane.spr', 1720736, 8, 32, 32, '96596a523c83b3988d751afd4bd84575ecd8c7e244e6ea32a3c09cedea1011d9'],
    ['apshadow.spr', 1725866, 8, 32, 32, 'b2d31dfc6a40db9e50a8e08df1e2b776ee1f1371dbb0c52996b54f526a64a93f'],
    ['cropdust.spr', 1783826, 2, 32, 32, 'da48747a817847977b8936bce384b0e545b672073f6b4087699099ff59476848'],
    ['tornado.spr', 1785116, 4, 48, 48, 'ac8960867e84acd422ea9e6ffd26a77e63f5af65f748b83c86011231f6fdb2f7'],
    ['swarm.spr', 1790886, 4, 64, 40, '9217f7d2e3896e2072f36fd4c4e544d989009ad185ce40787478b914e8a67603'],
  ] as const) {
    const entry = entries.find(e => e.name === name)!, bytes = entry.bytes, before = Uint8Array.from(bytes);
    const planeSize = width * height / 8, frameSize = planeSize * 5;
    assert.equal(entry.offset, offset); assert.equal(bytes.length, 10 + count * frameSize);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    const { frames, edgeMask, flags } = readSprite(bytes, palette), atlas = spriteAtlas(bytes, palette);
    assert.equal(edgeMask, 255); assert.equal(flags, 1); assert.equal(frames.length, count);
    assert.deepEqual([atlas.width, atlas.height], [count * width, height]);
    for (let frame = 0; frame < count; frame++) {
      assert.deepEqual([frames[frame].width, frames[frame].height], [width, height]);
      for (let pixel = 0; pixel < width * height; pixel++) {
        const at = 10 + frame * frameSize + Math.floor(pixel / 8), bit = 2 ** (7 - pixel % 8);
        const colour = [1, 2, 3, 4].reduce((n, plane) => n + (bytes[at + plane * planeSize] & bit ? 2 ** (plane - 1) : 0), 0);
        const expected = [...palette[colour], bytes[at] & bit ? 255 : 0];
        assert.deepEqual([...frames[frame].rgba.subarray(pixel * 4, pixel * 4 + 4)], expected);
        const atlasPixel = (Math.floor(pixel / width) * atlas.width + frame * width + pixel % width) * 4;
        assert.deepEqual([...atlas.rgba.subarray(atlasPixel, atlasPixel + 4)], expected);
      }
    }
    frames[0].rgba.fill(0); assert.deepEqual(Uint8Array.from(bytes), before);
  }
  const exe = source('SIMFARM.EXE');
  assert.equal(exe.subarray(0xb9b1, 0xb9c1).toString('hex'), '8b46f2f766128bc8c1e00203c101460e');
  assert.equal(exe.subarray(0x7b0a, 0x7b13).toString('hex'), '8a20b008efac262005');
});

test('sprite transparency is the write mask, including opaque colour zero and transparent nonzero colour', () => {
  const bytes = Uint8Array.from([2, 0, 1, 0, 1, 0, 1, 0, 255, 1, 128, 64, 64, 64, 64, 64, 128, 128, 128, 128]);
  const { frames } = readSprite(bytes, palette);
  assert.deepEqual([...frames[0].rgba.slice(0, 8)], [...palette[0], 255, ...palette[15], 0]);
  assert.deepEqual([...frames[1].rgba.slice(0, 8)], [...palette[15], 0, ...palette[0], 255]);
  const padded = new Uint8Array(bytes.length + 7); padded.set(bytes, 7);
  assert.deepEqual(readSprite(padded.subarray(7), palette).frames, frames);
});

test('sprite parser rejects header truncation, frame truncation, extra bytes, inconsistent dimensions and unsupported layouts', () => {
  const bytes = entries.find(e => e.name === 'airplane.spr')!.bytes;
  for (const end of [...Array.from({ length: 11 }, (_, i) => i), 649, 650, bytes.length - 1])
    assert.throws(() => readSprite(bytes.subarray(0, end), palette));
  const extra = new Uint8Array(bytes.length + 1); extra.set(bytes); assert.throws(() => readSprite(extra, palette));
  for (const [offset, value] of [[0, 0], [1, 2], [2, 0], [3, 1], [4, 0], [5, 1], [6, 127], [7, 1], [8, 0], [9, 0]]) {
    const bad = Uint8Array.from(bytes); bad[offset] = value; assert.throws(() => readSprite(bad, palette));
  }
  assert.throws(() => readSprite(bytes, palette.slice(1)));
});
