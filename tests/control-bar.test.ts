import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readBitmap, readPalette } from '../src/formats/graphics';
import { readControlBar, CONTROL_BAR_TEXT } from '../src/formats/control-bar';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const bytes = archive.find(e => e.name === 'cntlbtnh.bmp')!.bytes;
const palette = readPalette(archive.find(e => e.name === 'simfarm.pal')!.bytes);

test('control bar preserves source artwork outside its five text regions and leaves source bytes intact', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '6099e6fd31c27d73c0a20c1ee63a0ac1f41bfbff0f9fa54e739e11637a3c2b0f');
  const before = Uint8Array.from(bytes), original = readBitmap(bytes, palette), live = readControlBar(bytes, palette);
  assert.equal(live.width, 640); assert.equal(live.height, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 640; x++) {
    const offset = (y * 640 + x) * 4;
    const lettering = CONTROL_BAR_TEXT.some(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
    assert.deepEqual([...live.rgba.slice(offset, offset + 4)], lettering ? [194, 194, 194, 255] : [...original.rgba.slice(offset, offset + 4)]);
  }
  assert.deepEqual([...bytes], [...before]);
  const exe = source('SIMFARM.EXE');
  assert.equal(exe.subarray(0x2a106, 0x2a109).toString('hex'), '68be5a'); // bitmap filename
  assert.equal(exe.subarray(0x2a11a, 0x2a11e).toString('hex'), '6a106a00'); // upload at (0,16)
  assert.deepEqual(Array.from({ length: 10 }, (_, i) => 0x3e3b0 + exe.readUInt16LE(0x3ea56 + i * 2)),
    [0x3e7c8, 0x3e80c, 0x3e846, 0x3e8ac, 0x3e8e6, 0x3e920, 0x3e95a, 0x3e994, 0x3e9ce, 0x3ea08]);
});

test('control bar rejects truncated planes, unsupported headers and different bitmap dimensions', () => {
  for (const size of [0, 7, 8, bytes.length - 1]) assert.throws(() => readControlBar(bytes.subarray(0, size), palette));
  for (const offset of [4, 6]) { const bad = Uint8Array.from(bytes); bad[offset] = 0; assert.throws(() => readControlBar(bad, palette)); }
  const otherSize = Uint8Array.from(bytes); otherSize[0] = 40; otherSize[2] = 64; // same payload size; 320×64
  assert.throws(() => readControlBar(otherSize, palette), /dimensions/);
});
