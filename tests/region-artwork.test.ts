import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readPalette } from '../src/formats/graphics';
import { readRegionArtwork } from '../src/formats/region-artwork';
import { readScenarioChooser, readSetupMap } from '../src/formats/new-farm';
import { renderRegionChooser, renderRegionMaps } from '../src/render/region-chooser';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const exe = source('SIMFARM.EXE'), archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const asset = (name: string) => archive.find(a => a.name === name)!.bytes;
const raw = asset('scenario.int'), palette = readPalette(asset('scenario.pal'));
const artwork = readRegionArtwork(raw, palette), { farms } = readScenarioChooser(exe);
const locations = readSetupMap(asset('scenario.odt')).locations;
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

test('chooser source pins marker color, XOR helpers, endpoint masks, bar geometry and button branches', () => {
  assert.equal(digest(exe), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0x31dc5, '6a01'); exact(0x31df0, '9a32056308'); exact(0x31e24, '9aa0046308');
  exact(0xad1b, '9a9f051604'); exact(0xad45, '9a11041604'); // XOR horizontal/vertical
  exact(0x696d, 'b80318'); exact(0x67d7, 'b80318'); // VGA XOR mode
  exact(0x67ef, '8bcb2bce41'); // inclusive vertical length
  exact(0x3fb97, '8a46ee'); exact(0x3fbbb, 'c746ee00ff'); // right masks start00,80,c0...
  exact(0x3fba3, 'd06eded17eee');
  exact(0x3fcbe, '2688877a0f'); exact(0x3fcca, '268887f80c'); // same masks in480-line mode
  exact(0x3fccf, 'd06eded17eee'); exact(0x3fcee, 'c746ee00ff');
  exact(0x31f53, '6a0a6a066a0ca0ab6698506a606a656a78');
  exact(0x31f77, '6a606895006a78'); exact(0x31f91, '6a6068c5006a78');
  exact(0x3229c, '6a0168ff0068ec0068e8006a60');
  exact(0x321de, '6a0168180168ed006800016a60');
  exact(0x32401, '6a0168300168ec006818016a60');
  exact(0x324df, '6a0168480168ec006831016a60');
  exact(0x3245a, '9a3012e6249a2612e624'); // Load differs from a checkpoint restore.
  exact(0x32525, '9ac2040000'); // original process exit; browser adaptation documented.
  exact(0x775d, 'd1e9d1e9d1e9d1ebd1ebd1eb'); // fill truncates both X edges to bytes
});

test('every selectable region preserves source pixels, exact marker endpoints, palette XOR and all climate levels', () => {
  const originalHash = digest(artwork.indices);
  // Independent direct bit lookup: no use of the production INT decoder here.
  const sourcePixel = (x: number, y: number) => [0, 1, 2, 3].reduce((color, plane) =>
    color | ((raw[y * 320 + plane * 80 + (x >> 3)] >> (7 - (x & 7))) & 1) << plane, 0);
  for (const p of locations.filter(p => p.selectable)) {
    const actual = renderRegionChooser(artwork, farms, p);
    assert.equal(actual.width, 472); assert.equal(actual.height, 328);
    for (let y = 16; y < 344; y++) for (let x = 80; x < 552; x++) {
      let color = sourcePixel(x, y);
      for (const f of farms) {
        const dx = x - (248 + 16 * f.x), dy = y - (40 + 16 * f.y);
        if (((dy === 0 || dy === 16) && dx >= 0 && dx < 16) || ((dx === 0 || dx === 16) && dy >= 0 && dy <= 16)) color = 1;
      }
      const dx = x - (248 + 16 * p.x), dy = y - (40 + 16 * p.y);
      if ((dy === 0 || dy === 16) && dx >= 0 && dx < 16) color ^= 15;
      if ((dx === 0 || dx === 16) && dy >= 0 && dy <= 16) color ^= 15;
      if (x >= 120 && x < 216) for (const [bar, level] of [p.precipitation, p.temperature, p.wind].entries())
        if (y >= 101 + bar * 48 && y < 111 + bar * 48) color = x - 120 < level * 32 ? 6 : 12;
      const offset = ((y - 16) * 472 + x - 80) * 4;
      for (let channel = 0; channel < 3; channel++) assert.equal(actual.rgba[offset + channel], palette[color][channel]);
      assert.equal(actual.rgba[offset + 3], 255);
    }
  }
  assert.equal(digest(artwork.indices), originalHash);
});

test('indexed region artwork respects typed-array boundaries and rejects invalid frames, coordinates and climate', () => {
  const padded = new Uint8Array(raw.length + 11); padded.set(raw, 11);
  assert.deepEqual(readRegionArtwork(padded.subarray(11), palette), artwork);
  for (const size of [0, 153599, 153601]) assert.throws(() => readRegionArtwork(new Uint8Array(size), palette), /screen size/);
  const p = locations[8 * 18 + 2];
  for (const invalid of [{ ...p, x: 18 }, { ...p, y: -1 }, { ...p, selectable: false }, { ...p, wind: 4 }, { ...p, temperature: 1.5 }])
    assert.throws(() => renderRegionChooser(artwork, farms, invalid), /Invalid/);
  const badIndices = artwork.indices.slice(); badIndices[0] = 16;
  for (const bad of [{ ...artwork, indices: badIndices }, { ...artwork, indices: artwork.indices.subarray(1) },
    { ...artwork, palette: palette.slice(1) }, { ...artwork, palette: palette.map(() => [256, 0, 0]) }])
    assert.throws(() => renderRegionChooser(bad, farms, p), /Invalid/);
  assert.throws(() => renderRegionChooser(artwork, farms.slice(1), p), /Invalid/);
  assert.throws(() => renderRegionChooser(artwork, farms.map(f => ({ ...f, x: 0.5 })), p), /Invalid/);
});

test('the map sprite plus four strips of the XORed map reproduce every source selection outline exactly', () => {
  const { map, inverted } = renderRegionMaps(artwork, farms);
  assert.equal(map.width, 289); assert.equal(inverted.height, 289);
  for (const p of locations.filter(p => p.selectable)) {
    const expected = renderRegionChooser(artwork, farms, p), composed = map.rgba.slice();
    // The UI's strips (RegionMap): top/bottom x+1..x+15, left x at y+1..y+15, right x+16 at y..y+16.
    for (const [dx, dy, w, h] of [[1, 0, 15, 1], [1, 16, 15, 1], [0, 1, 1, 15], [16, 0, 1, 17]])
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = ((p.y * 16 + dy + y) * 289 + p.x * 16 + dx + x) * 4; composed.set(inverted.rgba.subarray(i, i + 4), i);
      }
    for (let y = 0; y < 289; y++) for (let x = 0; x < 289; x++) {
      const i = (y * 289 + x) * 4, j = ((24 + y) * 472 + 168 + x) * 4;
      if (composed[i] !== expected.rgba[j] || composed[i + 1] !== expected.rgba[j + 1] || composed[i + 2] !== expected.rgba[j + 2])
        assert.fail(`region ${p.x},${p.y} differs at ${x},${y}`);
    }
  }
});
