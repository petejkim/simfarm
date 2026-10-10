import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { readArchive } from '../src/formats/archive';
import { decodePlanar, readPalette } from '../src/formats/graphics';

test('window title artwork matches original renderer tile IDs and every imported pixel', () => {
  const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
  const exe = source('SIMFARM.EXE');
  expect(createHash('sha256').update(exe).digest('hex')).toBe('8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  expect(exe.subarray(0x2b0f9, 0x2b0fb).toString('hex')).toBe('6a00'); // left control
  expect(exe.subarray(0x2b20c, 0x2b20f).toString('hex')).toBe('68ed00'); // inactive strip
  expect(exe.subarray(0x2b24a, 0x2b24c).toString('hex')).toBe('6a01'); // front strip
  expect(exe.subarray(0x2b523, 0x2b526).toString('hex')).toBe('050400'); // title y+4
  expect(exe.subarray(0x8d54, 0x8d56).toString('hex')).toBe('6a0f'); // white glyphs
  const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
  const asset = (name: string) => entries.find(e => e.name === name)!.bytes;
  const tiles = asset('ega16til.til'), palette = readPalette(asset('simfarm.pal'));
  expect(createHash('sha256').update(tiles).digest('hex')).toBe('bab4818f7622b695354435ea9ea8b36268c4c306a2f1a88f79ca19dcd72a3f2d');
  for (const [name, tile] of [['window-close', 0], ['window-title', 1], ['window-title-inactive', 237]] as const) {
    const png = PNG.sync.read(readFileSync(new URL(`../public/assets/${name}.png`, import.meta.url)));
    expect([png.width, png.height]).toEqual([16,16]);
    expect(Uint8Array.from(png.data)).toEqual(Uint8Array.from(decodePlanar(tiles.subarray(tile * 128, (tile+1) * 128),16,16,palette).rgba));
  }
});
