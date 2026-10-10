import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readBitmap, readPalette } from '../src/formats/graphics';
import { BANK_BUTTONS, BANK_TEXT_MASKS, readBankArtwork } from '../src/formats/bank-artwork';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const bytes = entries.find(e => e.name === 'bankterm.bmp')!.bytes;
const palette = readPalette(entries.find(e => e.name === 'simfarm.pal')!.bytes);

test('Bank button rectangles match the complete source chain and its callback dispatch', () => {
  const exe = source('SIMFARM.EXE'), base = 0x846f0, buttons = [];
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  assert.equal(exe.subarray(base + 0xb15c, base + 0xb16e).toString(), 'BANK\0bankterm.bmp\0');
  assert.equal(exe.readUInt16LE(base + 0xb32a + 4), 176);
  assert.equal(exe.readUInt16LE(base + 0xb32a + 6), 96);
  assert.equal(exe.readUInt16LE(base + 0xb32a + 8), 288);
  assert.equal(exe.readUInt16LE(base + 0xb32a + 10), 240);
  let pointer = exe.readUInt16LE(base + 0xb32a + 0x30);
  for (let count = 0; pointer && count < 20; count++) {
    const p = base + pointer;
    buttons.push({ id: exe.readUInt16LE(p + 10), x: exe.readUInt16LE(p + 2), y: exe.readUInt16LE(p + 4) - 16, width: exe.readUInt16LE(p + 6), height: exe.readUInt16LE(p + 8) });
    assert.equal(exe.readUInt16LE(p + 12), 8);
    const next = exe.readUInt16LE(p + 18); if (next) assert.equal(exe.readUInt16LE(p + 20), 0x6190); pointer = next;
  }
  assert.equal(pointer, 0);
  assert.deepEqual(buttons, BANK_BUTTONS.map(({ label, ...b }) => b));
  const callbackBase = 0x46e90;
  assert.deepEqual(Array.from({ length: 18 }, (_, i) => callbackBase + exe.readUInt16LE(0x4769a + i * 2)),
    [0x4732a,0x47352,0x473ca,0x47492,0x47492,0x47492,0x47492,0x47492,0x47492,0x47492,0x47492,0x47492,0x4751e,0x475ca,0x475ca,0x475ca,0x475e2,0x4760e]);
  // Source zero-key cap differs from digit/keyboard cap: retain SF-155 evidence.
  assert.equal(exe.subarray(0x473b5, 0x473bb).toString('hex'), 'b83f42ba0f00');
  assert.equal(exe.subarray(0x47515, 0x4751b).toString('hex'), 'b87f96ba9800');
});

test('Bank artwork retains every pixel outside the HTML-caption masks without changing supplied bytes', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '0808f7e390e8bbae23828204134dbd12ce840af994457f656b44ed647bd8b0f9');
  const before = Uint8Array.from(bytes), original = readBitmap(bytes, palette), live = readBankArtwork(bytes, palette);
  assert.equal(live.width, 288); assert.equal(live.height, 224);
  for (let y = 0; y < 224; y++) for (let x = 0; x < 288; x++) {
    const p = (y * 288 + x) * 4, mask = BANK_TEXT_MASKS.find(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
    assert.deepEqual(live.rgba.subarray(p, p + 4), mask ? Uint8Array.from([...palette[mask.color],255]) : original.rgba.subarray(p,p+4));
  }
  assert.deepEqual(Uint8Array.from(bytes), before);
});

test('Bank artwork validates planes, headers, dimensions and typed-array boundaries', () => {
  for (const size of [0, 7, 8, bytes.length - 1]) assert.throws(() => readBankArtwork(bytes.subarray(0,size), palette));
  for (const offset of [4,6]) { const bad = Uint8Array.from(bytes); bad[offset] = 0; assert.throws(() => readBankArtwork(bad, palette)); }
  const other = Uint8Array.from(bytes); other[0] = 28; other[2] = 32; other[3] = 1;
  assert.throws(() => readBankArtwork(other, palette), /dimensions/); // 224×288, same payload
  const surrounded = new Uint8Array(bytes.length + 16).fill(255); surrounded.set(bytes,8);
  assert.deepEqual(readBankArtwork(surrounded.subarray(8,-8),palette), readBankArtwork(bytes,palette));
});
