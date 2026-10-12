import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readBitmap, readPalette } from '../src/formats/graphics';
import { readControlBar, CONTROL_BAR_TEXT, timeToggleFaces, BUY_ARROW_FACE } from '../src/formats/control-bar';
import { readBuyArtwork } from '../src/formats/buy-window';
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

test('pause/resume faces: resume is the Buy up-arrow face rotated clockwise; pause uses only that arrow\'s colours', () => {
  const buy = readBuyArtwork(archive.find(e => e.name === 'buywndo.bmp')!.bytes, readPalette(archive.find(e => e.name === 'simfarm.pal')!.bytes));
  const sheet = timeToggleFaces(buy), { x, y, size } = BUY_ARROW_FACE;
  assert.deepEqual([sheet.width, sheet.height], [52, 26]);
  const px = (r: typeof buy, px: number, py: number) => Array.from(r.rgba.subarray((py * r.width + px) * 4, (py * r.width + px) * 4 + 4));
  const face = px(buy, x, y);
  for (let dy = 0; dy < 26; dy++) for (let dx = 0; dx < 26; dx++) {
    const inside = dx >= 2 && dx < 24 && dy >= 2 && dy < 24;
    // dest (dx-2, dy-2) of the rotation reads source (dy-2, size-1-(dx-2)).
    assert.deepEqual(px(sheet, 26 + dx, dy), inside ? px(buy, x + dy - 2, y + size - 1 - (dx - 2)) : face, `resume ${dx},${dy}`);
  }
  const arrowColours = new Set<string>(); for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) arrowColours.add(px(buy, x + dx, y + dy).join());
  const pauseColours = new Set<string>(); for (let dy = 0; dy < 26; dy++) for (let dx = 0; dx < 26; dx++) pauseColours.add(px(sheet, dx, dy).join());
  assert.ok([...pauseColours].every(c => arrowColours.has(c))); assert.equal(pauseColours.size, 4);
  // Two bars: columns 7..11 and 15..19 differ from the face on the middle row; the gap and margins stay face.
  const row = Array.from({ length: 26 }, (_, dx) => px(sheet, dx, 13).join() !== face.join());
  assert.deepEqual(row.map((v, i) => v ? i : -1).filter(i => i >= 0), [6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19]);
});
