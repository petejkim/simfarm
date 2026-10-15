import {readEditCursor} from '../src/formats/edit-cursors';
import {readAboutArtwork,readAboutLogo,readAboutCredits} from '../src/formats/about';
import {readTownChoiceArtwork} from '../src/formats/town-choice';
import {readBalanceArtwork} from '../src/formats/balance-window';
import { readWeatherArtwork,readWeatherScenes,readWeatherVane,readWeatherWallpaper } from '../src/formats/weather-window';
import { readExpertPortrait,expertLauncherFace } from '../src/formats/expert-cards';
import { decodeUiContent, readUiContentJson } from '../src/formats/ui-content';
import { readAircraftArtwork } from '../src/formats/aircraft-window';
import { readExamineData } from '../src/formats/examine';
import { readScheduleArtwork, readFieldGauges } from '../src/formats/schedule-window';
import { readMapArtwork } from '../src/formats/map-window';
import { readFile, writeFile, mkdir, readdir, rm, rmdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG, type PackerOptions } from 'pngjs';
import { patchCropGraphics, readCropIcons, cropSpriteSheets } from '../src/formats/crop-graphics';
import { FIXED_CROP_FILES } from '../src/formats/crop-slots';
import { renderRegionMaps } from '../src/render/region-chooser';
import { readRegionArtwork } from '../src/formats/region-artwork';
import { spriteAtlas } from '../src/formats/sprite';
import { readScenario } from '../src/formats/scenario';
import { readArchive } from '../src/formats/archive';
import { readClimatePresets, readSetupMap, readScenarioChooser } from '../src/formats/new-farm';
import { readNewFarmRecordDefaults } from '../src/formats/new-farm-records';
import { readNewFarmRuntimeDefaults } from '../src/formats/new-farm-runtime';
import { readTrafficDefaults } from '../src/formats/traffic';
import { readOriginalMainMenus } from '../src/formats/main-menus';
import { readSellArtwork, readSellCondition } from '../src/formats/sell-window';
import { readWindowFrame } from '../src/formats/window-frame';
import { readBuyArtwork, readBuyCards, readBuyCatalog } from '../src/formats/buy-window';
import { readEditPalette } from '../src/formats/edit-palette';
import { readControlBar, timeToggleFaces } from '../src/formats/control-bar';
import { readPalette, readBitmap, tileAtlas, miniTileAtlas, decodePlanar, readInterleavedScreen, type Palette, type Raster } from '../src/formats/graphics';
import { townEventSpriteSheet } from '../src/formats/town-event-graphics';
import { decodeXmidi, encodeMidi } from '../src/formats/xmidi';
import { readCrop, type CropDefinition } from '../src/formats/crop';
import { runtimeRawFiles } from './runtime-assets.ts';

const source = resolve(process.argv[2] ?? '../simfarm-dos');
const output = resolve('public/assets');
const preservation = resolve('artifacts/original-assets');
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const read = (name: string) => readFile(join(source, name));
const json = (name: string, value: unknown) => writeFile(join(output, name), JSON.stringify(value));
function appIcon(source: Raster, size: number): Raster {
  const scale = Math.floor(size * 0.875 / Math.max(source.width, source.height));
  const left = (size - source.width * scale) >> 1, top = (size - source.height * scale) >> 1, rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) rgba.set([0xc2, 0xc2, 0xc2, 255], i * 4);
  for (let y = 0; y < source.height * scale; y++) for (let x = 0; x < source.width * scale; x++) {
    const from = (Math.floor(y / scale) * source.width + Math.floor(x / scale)) * 4, alpha = source.rgba[from + 3] / 255;
    const to = ((top + y) * size + left + x) * 4;
    for (let c = 0; c < 3; c++) rgba[to + c] = Math.round(source.rgba[from + c] * alpha + rgba[to + c] * (1 - alpha));
  }
  return { width: size, height: size, rgba };
}
async function png(name: string, raster: Raster, options?: PackerOptions) {
  const image = new PNG({ width: raster.width, height: raster.height });
  image.data = Buffer.from(raster.rgba);
  await writeFile(join(output, name), PNG.sync.write(image, options));
}
await mkdir(join(output, 'raw'), { recursive: true });
await mkdir(join(preservation, 'crops'), { recursive: true });
const [index, data, exe] = await Promise.all([read('MEGADATA.IDX'), read('MEGADATA.EEA'), read('SIMFARM.EXE')]);
const entries = readArchive(index, data);
const assets = new Map(entries.map(e => [e.name, e.bytes]));
function asset(name: string) { const bytes = assets.get(name); if (!bytes) throw new Error(`Missing ${name}`); return bytes; }
for(const kind of ['pick','drop'] as const)await png(`move-${kind}.png`,readEditCursor(exe,asset('cursors.til'),kind));
for(const kind of ['view','bulldoze','spray','buy'] as const)await png(`edit-${kind}.png`,readEditCursor(exe,asset('cursors.til'),kind));
const uiContent=decodeUiContent(asset);
readUiContentJson(uiContent);
await json('ui-content.json',uiContent);
const palette = readPalette(asset('simfarm.pal'));
await png('about-window.png',readAboutArtwork(asset('about.bmp'),palette));
await png('about-logo.png',readAboutLogo(asset('lzrdlogo.bmp'),palette));
readAboutCredits(asset('creditz.txt'));
await png('town-choice.png',readTownChoiceArtwork(asset('twnchoic.bmp'),palette));
await png('balance-window.png',readBalanceArtwork(asset('cashflow.bmp'),palette));
await png('weather-window.png',readWeatherArtwork(asset('weather.bmp'),palette));
await png('weather-sky.png',readWeatherScenes(asset('wethsky.btl'),palette));
await png('weather-ground.png',readWeatherScenes(asset('wethgrnd.btl'),palette));
await png('weather-vane.png',readWeatherVane(asset('wethvane.til'),palette));
await png('weather-wallpaper.png',readWeatherWallpaper(readWeatherArtwork(asset('weather.bmp'),palette)));
await png('expert-portrait.png',readExpertPortrait(asset('alltiles.btl'),palette));
await png('expert-launcher.png',expertLauncherFace(readExpertPortrait(asset('alltiles.btl'),palette)));
const setupMap = readSetupMap(asset('scenario.odt'));
await json('new-farm-setup.json', { ...setupMap, ...readScenarioChooser(exe), trailingBytes: Array.from(setupMap.trailingBytes), climate: readClimatePresets(asset) });
await json('new-farm-records.json', readNewFarmRecordDefaults(exe));
await json('new-farm-runtime.json', readNewFarmRuntimeDefaults(exe));
await json('traffic-defaults.json', readTrafficDefaults(exe));
await json('main-menus.json', readOriginalMainMenus(exe));
for (const e of entries) {
  await writeFile(join(preservation, e.name), e.bytes);
  if (runtimeRawFiles.has(e.name)) await writeFile(join(output, 'raw', e.name), e.bytes);
  else await rm(join(output, 'raw', e.name), { force: true });
  // Only the message popup still uses a whole source bitmap; other UI images are prepared separately.
  if (e.name === 'popup.bmp') await png(`${e.name}.png`, readBitmap(e.bytes, palette));
  else if (e.name.endsWith('.bmp')) await rm(join(output, `${e.name}.png`), { force: true });
}
await json('examine.json', readExamineData(exe));
await json('buy-catalog.json', readBuyCatalog(exe));
await png('buy-cards.png', readBuyCards(asset('alltiles.btl'), palette));
await png('aircraft-window.png', readAircraftArtwork(asset('airpwndo.bmp'), palette));
await png('schedule-window.png', readScheduleArtwork(asset('fdstatus.bmp'), palette));
await png('field-gauges.png', readFieldGauges(asset('fldgrph.til'), palette));
await png('map-window.png', readMapArtwork(asset('mapwndo.bmp'), palette));
await png('sell-window.png', readSellArtwork(asset('sellwndo.bmp'), palette));
await png('window-frame.png', readWindowFrame(readBitmap(asset('sellwndo.bmp'), palette)));
await png('sell-condition.png', readSellCondition(asset('ega16til.til'), palette));
await png('buy-window.png', readBuyArtwork(asset('buywndo.bmp'), palette));
await png('time-toggle.png', timeToggleFaces(readBuyArtwork(asset('buywndo.bmp'), palette)));
await png('edit-palette.png', readEditPalette(asset('editeasy.lzs'), palette));
await png('control-bar.png', readControlBar(asset('cntlbtnh.bmp'), palette));
// Window renderer2b09a: active title1, inactive237, left close control0.
// These tiles contain artwork only; window titles stay HTML text.
for (const [name, tile] of [['window-close', 0], ['window-title', 1], ['window-title-inactive', 237], ['window-title-end', 2], ['window-title-end-inactive', 119]] as const)
  await png(`${name}.png`, decodePlanar(asset('ega16til.til').subarray(tile * 128, (tile + 1) * 128), 16, 16, palette));
for (const name of ['airplane', 'apshadow', 'cropdust', 'tornado', 'swarm']) await png(`${name}.sprites.png`, spriteAtlas(asset(`${name}.spr`), palette));
await png('masked-tiles.png', tileAtlas(asset('mskdtile.til'), palette, 32, 7));
await png('sftitle.png', readInterleavedScreen(asset('sftitle.int'), readPalette(asset('sftitle.pal'))));
// Custom setup inherits scenario.pal from the geographic chooser. The gameplay
// palette is restored only after this screen returns to3f854.
await png('defworld.png', readInterleavedScreen(asset('defworld.int'), readPalette(asset('scenario.pal'))));
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
  await writeFile(join(preservation, 'crops', name.toLowerCase()), bytes);
  await rm(join(output, 'raw/crops', name.toLowerCase()), { force: true });
  cropBytes.set(name.toLowerCase(), bytes);
  inputs.push({ name: `CROPS/${name}`, size: bytes.length, sha256: sha256(bytes) });
}
const cropSheets = cropSpriteSheets(cropBytes, palette);
// CRP tiles/photos are opaque; lossless RGB avoids storing an unused alpha channel.
await png('crop-cards.png', cropSheets.cards, { colorType: 2 });
// Exact obsolete generated crop exports only; keep raw CRPs and other illustrations.
for (const file of FIXED_CROP_FILES) {
  const id = file.slice(0, -4);
  await rm(join(output, `${id}.png`), { force: true });
  await rm(join(output, `${id}.card.png`), { force: true });
}
// Native sprite sheets (user request): every runtime tile atlas is an imported PNG file, so sprites share one file
// instead of generated data: URLs. The terrain atlas holds all twenty-four shipped crops at fixed positions
// (FIXED_CROP_FILES, slot i = SHIPPED_CROP_IDS[i]); drawing maps a farm's slots to them (fixedCropTiles). Each
// atlas has rain/frost palette variants. The requested CSS tool border needs no inverted terrain sheets.
const weatherPalettes = [['', palette], ['.rain', readPalette(asset('rainpal.pal'))], ['.frost', readPalette(asset('frostpal.pal'))]] as const;
const inverse = (colors: Palette): Palette => colors.map((_, index) => colors[index ^ 15]);
const fixedTiles = patchCropGraphics(asset('ega16til.til'), FIXED_CROP_FILES.map(file => {
  const crop = cropBytes.get(file); if (!crop) throw new Error(`Missing shipped crop ${file}`); return crop;
}));
for (const [suffix, colors] of weatherPalettes) {
  await png(`terrain-tiles${suffix}.png`, tileAtlas(fixedTiles, colors));
  // Remove only obsolete generated highlight sheets when updating an older import.
  await rm(join(output,`terrain-tiles${suffix}.inverted.png`),{force:true});
}
await png('town-event-tiles.png', townEventSpriteSheet(asset('twnevent.til'), [weatherPalettes[0][1], weatherPalettes[1][1], weatherPalettes[2][1]]));
// Remove only the superseded generated banks (including older highlight exports).
for (const mode of [0, 1, 2]) {
  await rm(join(output, `town-event-${mode}.png`), { force: true });
  for (const suffix of ['', '.rain', '.frost']) for (const inverseSuffix of ['', '.inverted'])
    await rm(join(output, `town-event-tiles-${mode}${suffix}${inverseSuffix}.png`), { force: true });
}
// Map window miniature (overlay 8, 2×2 pixels per tile) in the gameplay palette.
await png('map-tiles.png', miniTileAtlas(asset('far_mapc.mbm'), palette));
await png('map-tiles.inverted.png', miniTileAtlas(asset('far_mapc.mbm'), inverse(palette)));
await rm(join(output,'masked-tiles.inverted.png'),{force:true});
{
  const maps = renderRegionMaps(readRegionArtwork(asset('scenario.int'), readPalette(asset('scenario.pal'))), readScenarioChooser(exe).farms);
  await png('region-map.png', maps.map); await png('region-map.inverted.png', maps.inverted);
}
// Favicons: the Apples crop's 16×16 plant icon and 32×32 badge, decoded from the crop file.
const appleIcons = readCropIcons(cropBytes.get('apples.crp')!, palette);
await png('favicon-16.png', appleIcons.plant);
await png('favicon-32.png', appleIcons.badge);
// Home-screen icons (native, for the installed web app): the same badge enlarged by whole pixels and centred on
// the control-bar grey, because launchers draw transparency as black.
for (const [name, size] of [['apple-touch-icon.png', 180], ['app-icon-192.png', 192], ['app-icon-512.png', 512]] as const)
  await png(name, appIcon(appleIcons.badge, size));
for (let i = 0; i < 8; i++) {
  const name = `SCEN${i}.SSM`, bytes = await read(name);
  inputs.push({ name, size: bytes.length, sha256: sha256(bytes) });
  await writeFile(join(output, 'raw', name), bytes);
  await writeFile(join(preservation, name), bytes);
  const scenario = readScenario(bytes);
  for (const file of scenario.cropFiles) if (!cropBytes.has(file)) throw new Error(`Missing scenario crop ${file}`);
  // Exact legacy exports only: every farm now uses the shared fixed-crop terrain sheets.
  await rm(join(output, `scenario${i}.tiles.png`), { force: true });
}
const music = [];
for (const entry of entries.filter(e => e.name.endsWith('.xmi'))) {
  const id = entry.name.slice(0, -4), sequence = decodeXmidi(entry.bytes);
  await writeFile(join(output, `${id}.mid`), encodeMidi(sequence));
  // Retire oscillator sequence metadata and the abandoned MP3 experiment for these known tracks only.
  for (const suffix of ['music.json', 'audio.json', 'mp3']) await rm(join(output, `${id}.${suffix}`), { force: true });
  music.push({ id, duration: sequence.endTick / 120 });
}
await json('catalog.json', { crops, music, tileCount: asset('ega16til.til').length / 128, palette });
await writeFile(join(preservation, 'manifest.json'), JSON.stringify({ inputs, entries: entries.map(({ name, offset, bytes }) => ({ name, offset, size: bytes.length, sha256: sha256(bytes) })) }));
await rm(join(output, 'manifest.json'), { force: true });
// Remove the old generated crop directory only when empty; leave unrelated local files alone.
try { await rmdir(join(output, 'raw/crops')); }
catch (error) { if (!['ENOENT', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error; }
// Obsolete derived exports only. Preserve raw originals and their decoders/tests as reconstruction evidence.
for (const name of ['bank-terminal', 'evaluation-window', 'market-window', 'examine-window', 'message-button',
  'town-choice-pressed', 'crop-tiles', 'mini-tiles', 'scenario', 'prsnt480', 'tiles', 'edit-help', 'sell-conditions'])
  await rm(join(output, `${name}.png`), { force: true });
console.log(`Imported ${entries.length} resources, ${crops.length} crops, ${asset('ega16til.til').length / 128} tiles. Source files unchanged.`);
