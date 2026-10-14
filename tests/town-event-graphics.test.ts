import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { tileAtlas, readPalette, type Palette } from '../src/formats/graphics';
import { patchTownEventGraphics, townEventTileBank, townEventSpriteSheet, type TownEventMode } from '../src/formats/town-event-graphics';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const exe = source('SIMFARM.EXE');
const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const asset = (name: string) => archive.find(a => a.name === name)!.bytes;
const raw = asset('twnevent.til'), base = asset('ega16til.til');
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

test('town event banks pin source seek/read, destination/count and complete resource fingerprint', () => {
  assert.equal(hash(exe), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const pin = (address: number, hex: string) => assert.equal(exe.subarray(address, address + hex.length / 2).toString('hex'), hex);
  pin(0xdb55, '69c08011'); pin(0xdb77, '688011');
  pin(0xdbb0, 'c1e107'); pin(0xdbd0, '052300');
  pin(0x846f0 + 0xc682, 'e72b'); pin(0x4f5e4, 'e301');
  assert.equal(raw.length, 20480);
  assert.equal(hash(raw), '533e3c7f544bfcd1b18752f3eff0f222771ca9bb2d21cd46e4b401844647aac2');
});

test('all three banks preserve every planar pixel and replace only their original atlas range', () => {
  const before = hash(raw), baseBefore = hash(base), palette = readPalette(asset('simfarm.pal'));
  for (const mode of [0, 1, 2] as const) {
    const bank = townEventTileBank(raw, mode), raster = tileAtlas(bank, palette, 7);
    assert.equal(bank.length, 35 * 128);
    assert.equal(raster.width, 112); assert.equal(raster.height, 80);
    for (let tile = 0; tile < 35; tile++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let color = 0;
      for (let plane = 0; plane < 4; plane++) color |=
        ((raw[mode * 4480 + tile * 128 + plane * 32 + y * 2 + (x >> 3)] >> (7 - (x & 7))) & 1) << plane;
      const i = ((Math.floor(tile / 7) * 16 + y) * 112 + tile % 7 * 16 + x) * 4;
      assert.deepEqual(Array.from(raster.rgba.subarray(i, i + 4)), [...palette[color], 255]);
    }
    for (const atlas of [base, new Uint8Array(1392 * 128).fill(0x5a)]) {
      const patched = patchTownEventGraphics(atlas, raw, mode);
      assert.deepEqual(patched.subarray(0, 483 * 128), Uint8Array.from(atlas.subarray(0, 483 * 128)));
      assert.deepEqual(patched.subarray(483 * 128, 518 * 128), bank);
      assert.deepEqual(patched.subarray(518 * 128), Uint8Array.from(atlas.subarray(518 * 128)));
      patched.fill(0); // Neither the input resource nor atlas is aliased.
    }
    bank.fill(0);
  }
  assert.equal(hash(raw), before); assert.equal(hash(base), baseBefore);
});

test('town event decoder rejects malformed lengths/modes and preserves inputs on failure', () => {
  const before = hash(base);
  for (const size of [0, 4480, 13440, 20479, 20481])
    assert.throws(() => patchTownEventGraphics(base, new Uint8Array(size), 1));
  for (const mode of [-1, 3, 4, 1.5, NaN, Infinity])
    assert.throws(() => townEventTileBank(raw, mode as TownEventMode));
  for (const size of [0, 517 * 128, 880 * 128 - 1])
    assert.throws(() => patchTownEventGraphics(new Uint8Array(size), raw, 0));
  assert.equal(hash(base), before);
});

test('the single imported sheet retains every source pixel across all banks and palettes, with no obsolete exports',()=>{
  const palettes=['simfarm.pal','rainpal.pal','frostpal.pal'].map(name=>readPalette(asset(name))) as [Palette,Palette,Palette];
  const before=hash(raw),sheet=townEventSpriteSheet(raw,palettes),imported=PNG.sync.read(readFileSync('public/assets/town-event-tiles.png'));
  assert.equal(sheet.width,336);assert.equal(sheet.height,240);
  assert.equal(imported.width,336);assert.equal(imported.height,240);
  assert.deepEqual(Uint8Array.from(imported.data),sheet.rgba);
  for(let row=0;row<3;row++)for(let mode=0;mode<3;mode++)for(let tile=0;tile<35;tile++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    let color=0;
    for(let plane=0;plane<4;plane++)color|=((raw[mode*4480+tile*128+plane*32+y*2+(x>>3)]>>(7-(x&7)))&1)<<plane;
    const at=((row*80+Math.floor(tile/7)*16+y)*336+mode*112+tile%7*16+x)*4;
    assert.deepEqual(Array.from(sheet.rgba.subarray(at,at+4)),[...palettes[row][color],255]);
  }
  assert.equal(hash(raw),before);
  assert.deepEqual(readdirSync('public/assets').filter(name=>/^town-event-.*\.png$/.test(name)),['town-event-tiles.png']);
  for(const size of [13440,20479,20481])assert.throws(()=>townEventSpriteSheet(new Uint8Array(size),palettes),/resource/);
  for(const count of [0,2,4])assert.throws(()=>townEventSpriteSheet(raw,Array(count).fill(palettes[0]) as [Palette,Palette,Palette]),/palettes/);
});
