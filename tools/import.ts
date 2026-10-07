import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { readArchive } from '../src/formats/archive';
import { readPalette, readBitmap, tileAtlas, decodePlanar, type Raster } from '../src/formats/graphics';
import { readCrop, type CropDefinition } from '../src/formats/crop';

const source = resolve(process.argv[2] ?? '../simfarm-dos');
const output = resolve('public/assets');
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const read = (name: string) => readFile(join(source, name));
const json = (name: string, value: unknown) => writeFile(join(output, name), JSON.stringify(value, null, 2));
async function png(name: string, raster: Raster) {
  const image = new PNG({ width: raster.width, height: raster.height });
  image.data = Buffer.from(raster.rgba);
  await writeFile(join(output, name), PNG.sync.write(image));
}
await mkdir(join(output, 'raw'), { recursive: true });
const [index, data, exe] = await Promise.all([read('MEGADATA.IDX'), read('MEGADATA.EEA'), read('SIMFARM.EXE')]);
const entries = readArchive(index, data);
const assets = new Map(entries.map(e => [e.name, e.bytes]));
function asset(name: string) { const bytes = assets.get(name); if (!bytes) throw new Error(`Missing ${name}`); return bytes; }
const palette = readPalette(asset('simfarm.pal'));
for (const e of entries) {
  await writeFile(join(output, 'raw', e.name), e.bytes);
  if (e.name.endsWith('.bmp')) await png(`${e.name}.png`, readBitmap(e.bytes, palette));
}
await png('tiles.png', tileAtlas(asset('ega16til.til'), palette));
for (const name of ['sftitle', 'scenario', 'prsnt480']) await png(`${name}.png`, decodePlanar(asset(`${name}.int`), 640, 480, readPalette(asset(`${name}.pal`))));
const crops: CropDefinition[] = [];
const inputs = [
  { name: 'SIMFARM.EXE', size: exe.length, sha256: sha256(exe) },
  { name: 'MEGADATA.IDX', size: index.length, sha256: sha256(index) },
  { name: 'MEGADATA.EEA', size: data.length, sha256: sha256(data) },
];
for (const name of (await readdir(join(source, 'CROPS'))).filter(n => /\.crp$/i.test(n)).sort()) {
  const bytes = await read(`CROPS/${name}`), id = name.toLowerCase().replace('.crp', '');
  crops.push(readCrop(id, bytes));
  inputs.push({ name: `CROPS/${name}`, size: bytes.length, sha256: sha256(bytes) });
  await png(`${id}.png`, tileAtlas(bytes.subarray(0, 0x400), palette, 8));
  await png(`${id}.card.png`, decodePlanar(bytes.subarray(0x400, 0x1200), 112, 64, palette));
}
for (let i = 0; i < 8; i++) {
  const name = `SCEN${i}.SSM`, bytes = await read(name);
  inputs.push({ name, size: bytes.length, sha256: sha256(bytes) });
  await writeFile(join(output, 'raw', name), bytes);
}
await json('catalog.json', { crops, tileCount: asset('ega16til.til').length / 128, palette });
await json('manifest.json', { inputs, entries: entries.map(({ name, offset, bytes }) => ({ name, offset, size: bytes.length, sha256: sha256(bytes) })) });
console.log(`Imported ${entries.length} resources, ${crops.length} crops, ${asset('ega16til.til').length / 128} tiles. Source files unchanged.`);
