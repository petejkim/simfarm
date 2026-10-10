import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readBitmap, readPalette } from '../src/formats/graphics';
import { decodeEditPalette, readEditPalette } from '../src/formats/edit-palette';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const bytes = archive.find(e => e.name === 'editeasy.lzs')!.bytes;
const palette = readPalette(archive.find(e => e.name === 'simfarm.pal')!.bytes);
test('source Edit palette expands to the 48×208 bitmap; only caption interiors change for HTML text', () => {
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('fa398c509ed630a9d9f21197e47cde2e102291e7954d1f489ef39cb8ec55d84b');
  const decoded = decodeEditPalette(bytes), original = readBitmap(decoded, palette), live = readEditPalette(bytes, palette);
  expect([...decoded.subarray(0, 8)]).toEqual([6, 0, 208, 0, 4, 0, 1, 0]);
  expect([original.width, original.height, decoded.length]).toEqual([48, 208, 5000]);
  for (let y = 0; y < 208; y++) for (let x = 0; x < 48; x++) {
    const p = (y * 48 + x) * 4, text = x >= 4 && x < 44 && [148, 172, 192].some(top => y >= top && y < top + 12);
    expect([...live.rgba.subarray(p, p + 4)]).toEqual(text ? [194, 194, 194, 255] : [...original.rgba.subarray(p, p + 4)]);
  }
});
test('Edit decoder rejects every truncated source prefix and trailing bytes without output overflow', () => {
  for (let size = 0; size < bytes.length; size++) expect(() => decodeEditPalette(bytes.subarray(0, size))).toThrow();
  expect(() => decodeEditPalette(Uint8Array.from([...bytes, 0]))).toThrow();
  const invalid = Uint8Array.from(bytes); invalid[1] = 7;
  expect(() => readEditPalette(invalid, palette)).toThrow();
  expect(() => decodeEditPalette(new Uint8Array(4000))).toThrow();
});
