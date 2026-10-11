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
  for (const [name, tile] of [['window-close', 0], ['window-title', 1], ['window-title-inactive', 237], ['window-title-end', 2], ['window-title-end-inactive', 119]] as const) {
    const png = PNG.sync.read(readFileSync(new URL(`../public/assets/${name}.png`, import.meta.url)));
    expect([png.width, png.height]).toEqual([16,16]);
    expect(Uint8Array.from(png.data)).toEqual(Uint8Array.from(decodePlanar(tiles.subarray(tile * 128, (tile+1) * 128),16,16,palette).rgba));
  }
});

test('right title artwork is an end cap inside the ordinary drag hit region', () => {
  const b=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
  for(const [a,z,hash] of [
    [0xed0f,0xed35,'b44bdc18d1c3f595f68e17679531c1ed30c887b67e5fe111fb18a4b8d0533ae4'],
    [0x2b180,0x2b1cf,'1bf0c51f137a3ec45c4b86d1e6765b3d8f26aa9edb896bf59b7c7d71f5a4bb49'],
  ] as const)expect(createHash('sha256').update(b.subarray(a,z)).digest('hex')).toBe(hash);
  expect(b.subarray(0x2b19e,0x2b1a0).toString('hex')).toBe('6a02');
  expect(b.subarray(0x2b1b0,0x2b1b2).toString('hex')).toBe('6a77');
  // Local x>16, x<descriptor.x+width, y<16 and flag20 lead to drag105a.
  // There is no width-16 exclusion for the right cap.
  expect(b.subarray(0xed0f,0xed14).toString('hex')).toBe('3d10007e66');
  expect(b.subarray(0xed14,0xed20).toString('hex')).toBe('268b5704260357083bc27d5a');
  expect(b.subarray(0xed20,0xed2b).toString('hex')).toBe('83f9107d5526f60720744f');
  expect(b.subarray(0xed2f,0xed34).toString('hex')).toBe('9a5a10e624');
});
