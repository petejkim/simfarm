import { readMapMiniature, type MapMiniature } from '../formats/map-window';
import { readBuyCatalogData, type BuyCatalog } from '../formats/buy-window';
import { allCropFiles } from '../formats/crop-slots';
import { readRegionArtwork, type RegionArtwork } from '../formats/region-artwork';
import { rasterImage } from '../render/raster-image';
import { tileAtlas, miniTileAtlas, readPalette, type Raster } from '../formats/graphics';
import { patchCropGraphics } from '../formats/crop-graphics';
import type { NewFarmAssets } from '../simulation/create-farm';
import type { DisasterSprites } from '../render/disaster-renderer';
import type { FlightSprites } from '../render/aircraft-renderer';
import type { CropDefinition } from '../formats/crop';
import { readScenario, type Scenario } from '../formats/scenario';
import type { MidiSequence } from '../formats/xmidi';
import { TownLayouts } from '../formats/town';
import { decodeVoc } from '../formats/voc';
import type { GameSound } from '../simulation/events';
import { readSetupMap, readScenarioChooserData, type ScenarioChooser, type SetupLocation } from '../formats/new-farm';
import { readMainMenusData, type MainMenus } from '../formats/main-menus';

export interface RegionAssets extends ScenarioChooser { locations: SetupLocation[]; artwork: RegionArtwork }
export interface TerrainPreviewAssets { screen: HTMLImageElement; miniature: Raster }
export async function loadTerrainPreviewAssets(signal: AbortSignal): Promise<TerrainPreviewAssets> {
  const binary = (path: string) => response(path, signal).then(r => r.arrayBuffer()).then(b => new Uint8Array(b));
  const [screen, miniature, palette] = await Promise.all([image('defworld.png', signal),
    binary('raw/far_mapc.mbm'), binary('raw/scenario.pal')]);
  if (screen.naturalWidth !== 640 || screen.naturalHeight !== 480) throw new Error('Invalid terrain design artwork');
  return { screen, miniature: miniTileAtlas(miniature, readPalette(palette)) };
}
export async function loadRegionAssets(signal: AbortSignal): Promise<RegionAssets> {
  const [map, metadata, screen, palette] = await Promise.all([
    response('raw/scenario.odt', signal).then(r => r.arrayBuffer()).then(b => readSetupMap(new Uint8Array(b))),
    response('new-farm-setup.json', signal).then(r => r.json()).then(readScenarioChooserData),
    response('raw/scenario.int', signal).then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    response('raw/scenario.pal', signal).then(r => r.arrayBuffer()).then(b => readPalette(new Uint8Array(b))),
  ]);
  if ([...metadata.farms, metadata.initialLocation].some(p => !map.locations[p.y * 18 + p.x].selectable))
    throw new Error('Invalid region map assets');
  return { ...metadata, locations: map.locations, artwork: readRegionArtwork(screen, palette) };
}

export interface Catalog {
  crops: CropDefinition[];
  music: { id: string; duration: number }[];
  tileCount: number;
  palette: number[][];
}
export interface WindowArtwork { title: HTMLImageElement; inactive: HTMLImageElement; close: HTMLImageElement }
export interface GameAssets { scheduleArtwork: HTMLImageElement; fieldGauges: HTMLImageElement; mapArtwork: HTMLImageElement; miniature: MapMiniature; catalog: Catalog; mainMenus: MainMenus; controlBar: HTMLImageElement; editPalette: HTMLImageElement; bankArtwork: HTMLImageElement; sellArtwork: HTMLImageElement; sellConditions: HTMLImageElement; buyArtwork: HTMLImageElement; buyCards: HTMLImageElement; buyCatalog: BuyCatalog; itemText: Uint8Array; windowArtwork: WindowArtwork; maskedTiles: HTMLImageElement; townLayouts: TownLayouts; flightSprites: FlightSprites; disasterSprites: DisasterSprites }
export const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}assets/${path}`;

async function response(path: string, signal?: AbortSignal): Promise<Response> {
  const result = await fetch(assetUrl(path), { signal });
  if (!result.ok || result.headers.get('Content-Type')?.includes('text/html')) {
    throw new Error(`Missing game asset: ${path}. Run ./tools/bun run import first.`);
  }
  return result;
}
function image(path: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const img = new Image();
    const cleanup = () => { img.onload = null; img.onerror = null; signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); img.src = ''; reject(signal.reason); };
    img.onload = () => { cleanup(); resolve(img); };
    img.onerror = () => { cleanup(); reject(new Error(`Cannot load ${path}. Run ./tools/bun run import first.`)); };
    signal.addEventListener('abort', abort, { once: true });
    img.src = assetUrl(path);
  });
}
export async function loadGameAssets(signal: AbortSignal): Promise<GameAssets> {
  const [scheduleArtwork, fieldGauges, catalog, maskedTiles, townLayouts, airplane, shadow, dust, tornado, swarm, mainMenus, controlBar, editPalette, bankArtwork, buyArtwork, buyCards, buyCatalog, itemText, mapArtwork, miniatureBytes, sellArtwork, sellConditions, windowTitle, windowInactive, windowClose] = await Promise.all([
    image('schedule-window.png', signal), image('field-gauges.png', signal),
    response('catalog.json', signal).then(r => r.json()) as Promise<Catalog>, image('masked-tiles.png', signal),
    response('raw/townly0.cmp', signal).then(r => r.arrayBuffer()).then(b => new TownLayouts(new Uint8Array(b))),
    image('airplane.sprites.png', signal), image('apshadow.sprites.png', signal), image('cropdust.sprites.png', signal), image('tornado.sprites.png', signal), image('swarm.sprites.png', signal),
    response('main-menus.json', signal).then(r => r.json()).then(readMainMenusData),
    image('control-bar.png', signal), image('edit-palette.png', signal), image('bank-terminal.png', signal), image('buy-window.png', signal), image('buy-cards.png', signal),
    response('buy-catalog.json', signal).then(r => r.json()).then(readBuyCatalogData),
    response('raw/itemtext.dat', signal).then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    image('map-window.png', signal),
    response('raw/far_mapc.mbm', signal).then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    image('sell-window.png', signal), image('sell-conditions.png', signal), image('window-title.png', signal), image('window-title-inactive.png', signal), image('window-close.png', signal),
  ]);
  if (controlBar.naturalWidth !== 640 || controlBar.naturalHeight !== 32) throw new Error('Invalid control-bar artwork');
  if (editPalette.naturalWidth !== 48 || editPalette.naturalHeight !== 208) throw new Error('Invalid edit-palette artwork');
  if (bankArtwork.naturalWidth !== 288 || bankArtwork.naturalHeight !== 224) throw new Error('Invalid Bank artwork');
  if (buyArtwork.naturalWidth !== 256 || buyArtwork.naturalHeight !== 224 || buyCards.naturalWidth !== 896 || buyCards.naturalHeight !== 640 || itemText.length !== 18929) throw new Error('Invalid Buy artwork or text');
  if ([windowTitle, windowInactive, windowClose].some(img => img.naturalWidth !== 16 || img.naturalHeight !== 16)) throw new Error('Invalid window title artwork');
  if (sellArtwork.naturalWidth !== 192 || sellArtwork.naturalHeight !== 256 || sellConditions.naturalWidth !== 128 || sellConditions.naturalHeight !== 32) throw new Error('Invalid Sell artwork');
  if (mapArtwork.naturalWidth !== 288 || mapArtwork.naturalHeight !== 240) throw new Error('Invalid Map artwork');
  if (scheduleArtwork.naturalWidth !== 336 || scheduleArtwork.naturalHeight !== 224 || fieldGauges.naturalWidth !== 960 || fieldGauges.naturalHeight !== 24) throw new Error('Invalid Schedule artwork');
  return { scheduleArtwork, fieldGauges, mapArtwork, miniature: readMapMiniature(miniatureBytes, catalog.palette), sellArtwork, sellConditions, catalog, mainMenus, controlBar, editPalette, bankArtwork, buyArtwork, buyCards, buyCatalog, itemText, windowArtwork: { title: windowTitle, inactive: windowInactive, close: windowClose }, maskedTiles, townLayouts, flightSprites: { airplane, shadow, dust }, disasterSprites: { tornado, swarm } };
}
export async function loadScenarioAssets(id: number, signal: AbortSignal) {
  const [buffer, tiles] = await Promise.all([
    response(`raw/SCEN${id}.SSM`, signal).then(r => r.arrayBuffer()), image(`scenario${id}.tiles.png`, signal),
  ]);
  const scenario = readScenario(new Uint8Array(buffer));
  return { scenario, tiles: await loadGeneratedTiles(scenario.cropFiles, signal) };
}
export async function loadMusic(id: string, signal: AbortSignal): Promise<MidiSequence> {
  return (await response(`${id}.music.json`, signal)).json();
}
export async function loadSound(id: GameSound, signal: AbortSignal) {
  return decodeVoc(new Uint8Array(await (await response(`raw/${id}.voc`, signal)).arrayBuffer()));
}

/** Assemble all supplied crop slots from original resources, without a SCEN file. */
export async function loadGeneratedTiles(cropFiles: readonly string[], signal: AbortSignal): Promise<HTMLImageElement> {
  cropFiles = allCropFiles(cropFiles);
  if (cropFiles.length !== 24 || cropFiles.some(n => !/^[a-z0-9_]{1,8}\.crp$/.test(n))) throw new Error('Invalid crop filenames');
  const binary = (path: string) => response(path, signal).then(r => r.arrayBuffer()).then(b => new Uint8Array(b));
  const [tiles, palette, ...crops] = await Promise.all([binary('raw/ega16til.til'), binary('raw/simfarm.pal'), ...cropFiles.map(file => binary(`raw/crops/${file}`))]);
  return rasterImage(tileAtlas(patchCropGraphics(tiles, crops), readPalette(palette)), signal);
}
/** Native checkpoints may require either bundled or recomposed original tiles. */
export async function loadSavedFarmTiles(world: Scenario, scenarioId: number | null, signal: AbortSignal): Promise<HTMLImageElement> {
  if (scenarioId === null) return loadGeneratedTiles(world.cropFiles, signal);
  const original = await loadScenarioAssets(scenarioId, signal);
  if (!world.sourceBytes || world.sourceBytes.some((byte, i) => byte !== original.scenario.sourceBytes[i]))
    throw new Error('This farm needs different original scenario assets.');
  return world.cropFiles.length === 24 ? loadGeneratedTiles(world.cropFiles, signal) : original.tiles;
}
export async function loadNewFarmAssets(assets: GameAssets, signal: AbortSignal): Promise<NewFarmAssets> {
  const [records, runtime, traffic, setup] = await Promise.all(['new-farm-records.json', 'new-farm-runtime.json', 'traffic-defaults.json', 'new-farm-setup.json']
    .map(file => response(file, signal).then(r => r.json())));
  return { records, runtime, traffic, climate: setup.climate, crops: assets.catalog.crops, townLayouts: assets.townLayouts };
}
