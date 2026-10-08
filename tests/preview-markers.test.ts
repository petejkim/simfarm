import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readPreviewMarkers } from '../src/formats/preview-markers';
import { miniTileAtlas, readPalette } from '../src/formats/graphics';
import { renderLocatedTerrainPreview, renderTerrainPreview } from '../src/render/terrain-preview';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const exe = source('SIMFARM.EXE'), archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const asset = (name: string) => archive.find(a => a.name === name)!.bytes;

test('original preview uses loaded font H/T masks, source positions and clamped climate bar widths/colors', () => {
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0x491d7, '68c00b689f2d6824941e6873b7');
  assert.equal(exe.subarray(0x846f0 + 0xb773, 0x846f0 + 0xb773 + 12).toString('ascii'), 'egafont.fnt\0');
  exact(0x33d6e, '6a006800a0689f2d6824946a34'); exact(0x33dae, '6a006800a0689f2d6824946a28');
  exact(0x33d83, 'c1e004054800'); exact(0x33d92, 'c1e004050801');
  exact(0x6d20, 'b808008946fe'); exact(0x6d54, '8b760c8b460ad1e0d1e0d1e0d1e0d1e003f0');
  exact(0x33dd8, '6a0a6a036a00b01bf62eb667506a506a6968a000');
  exact(0xa15e, '8b460a39460c7e0389460c');
  const font = asset('egafont.fnt'); assert.equal(font.length, 3840);
  assert.equal(createHash('sha256').update(font).digest('hex'), '3172a72ca4fd137d36b3b0eb834899d6d5ed3e7cdfae1ae4f630987a80d7e2cc');
  const markers = readPreviewMarkers(font), masks = { home: [0x66, 0x66, 0x66, 0x7e, 0x66, 0x66, 0x66, 0], town: [0x7e, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0] };
  for (const name of ['home', 'town'] as const) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    assert.deepEqual(Array.from(markers[name].rgba.slice((y * 8 + x) * 4, (y * 8 + x + 1) * 4)), [0, 0, 0, masks[name][y] & (128 >> x) ? 255 : 0]);
  }
  assert.deepEqual(readPreviewMarkers(font.subarray(0, 3008)), markers);
  assert.throws(() => readPreviewMarkers(font.subarray(0, 3007)), /Truncated/);
  const bad = Uint8Array.from(font); bad[40 * 32 + 8] ^= 1; assert.throws(() => readPreviewMarkers(bad), /mask/);
  const padded = new Uint8Array(3850); padded.set(font, 5); assert.deepEqual(readPreviewMarkers(padded.subarray(5, 3845)), markers);
  const palette = readPalette(asset('scenario.pal'));
  assert.deepEqual([palette[0], palette[3], palette[1], palette[8]], [[0, 0, 0], [194, 4, 4], [255, 243, 4], [0, 170, 4]]);
});

test('preview marks source region coordinates with eight-pixel glyphs and preserves every other miniature pixel', () => {
  const world = { cells: Array.from({ length: 9216 }, (_, i) => ({ terrain: i % 960, overlay: 0, attribute: 0 })) };
  const atlas = miniTileAtlas(asset('far_mapc.mbm'), readPalette(asset('scenario.pal'))), markers = readPreviewMarkers(asset('egafont.fnt'));
  const sites = { town: { regionX: 11, regionY: 0 }, player: { regionX: 0, regionY: 9 } };
  const original = renderTerrainPreview(world, atlas), expected = Uint8Array.from(original.rgba);
  for (const [name, site] of [['town', sites.town], ['home', sites.player]] as const) {
    for (let i = 0; i < 64; i++) if (markers[name].rgba[i * 4 + 3]) {
      const offset = ((site.regionY * 16 + (i >> 3)) * 192 + site.regionX * 16 + i % 8) * 4;
      expected.set([0, 0, 0, 255], offset);
    }
  }
  assert.deepEqual(renderLocatedTerrainPreview(world, atlas, markers, sites).rgba, expected);
  assert.deepEqual(renderTerrainPreview(world, atlas), original);
  assert.throws(() => renderLocatedTerrainPreview(world, atlas, markers, { ...sites, town: { regionX: 12, regionY: 0 } }), /marker/);
});
