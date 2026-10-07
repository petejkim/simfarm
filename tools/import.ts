import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { patchCropGraphics } from '../src/formats/crop-graphics';
import { readScenario } from '../src/formats/scenario';
import { readArchive } from '../src/formats/archive';
import { readPalette, readBitmap, tileAtlas, decodePlanar, type Raster } from '../src/formats/graphics';
import { decodeXmidi, encodeMidi } from '../src/formats/xmidi';
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
await png('masked-tiles.png', tileAtlas(asset('mskdtile.til'), palette, 32, 7));
for (const name of ['sftitle', 'scenario', 'prsnt480']) await png(`${name}.png`, decodePlanar(asset(`${name}.int`), 640, 480, readPalette(asset(`${name}.pal`))));
const crops: CropDefinition[] = [];
const cropBytes = new Map<string, Uint8Array>();
const inputs = [
  { name: 'SIMFARM.EXE', size: exe.length, sha256: sha256(exe) },
  { name: 'MEGADATA.IDX', size: index.length, sha256: sha256(index) },
  { name: 'MEGADATA.EEA', size: data.length, sha256: sha256(data) },
];
for (const name of (await readdir(join(source, 'CROPS'))).filter(n => /\.crp$/i.test(n)).sort()) {
  const bytes = await read(`CROPS/${name}`), id = name.toLowerCase().replace('.crp', '');
  crops.push(readCrop(id, bytes));
  cropBytes.set(name.toLowerCase(), bytes);
  inputs.push({ name: `CROPS/${name}`, size: bytes.length, sha256: sha256(bytes) });
  await png(`${id}.png`, tileAtlas(bytes.subarray(0, 0x400), palette, 8));
  await png(`${id}.card.png`, decodePlanar(bytes.subarray(0x400, 0x1200), 112, 64, palette));
}
for (let i = 0; i < 8; i++) {
  const name = `SCEN${i}.SSM`, bytes = await read(name);
  inputs.push({ name, size: bytes.length, sha256: sha256(bytes) });
  await writeFile(join(output, 'raw', name), bytes);
  const scenario = readScenario(bytes);
  const loadedCrops = scenario.cropFiles.map(file => {
    const crop = cropBytes.get(file); if (!crop) throw new Error(`Missing scenario crop ${file}`); return crop;
  });
  await png(`scenario${i}.tiles.png`, tileAtlas(patchCropGraphics(asset('ega16til.til'), loadedCrops), palette));
}
const music = [];
for (const entry of entries.filter(e => e.name.endsWith('.xmi'))) {
  const id = entry.name.slice(0, -4), sequence = decodeXmidi(entry.bytes);
  await writeFile(join(output, `${id}.mid`), encodeMidi(sequence));
  await json(`${id}.music.json`, sequence);
  music.push({ id, duration: sequence.endTick / 120 });
}
await json('catalog.json', { crops, music, tileCount: asset('ega16til.til').length / 128, palette });
await json('manifest.json', { inputs, entries: entries.map(({ name, offset, bytes }) => ({ name, offset, size: bytes.length, sha256: sha256(bytes) })) });
console.log(`Imported ${entries.length} resources, ${crops.length} crops, ${asset('ega16til.til').length / 128} tiles. Source files unchanged.`);
