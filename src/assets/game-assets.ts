import {readAboutCredits} from '../formats/about';
import {registerInvertedTiles} from './inverted-tiles';
import {registerWeatherTiles} from './weather-tiles';
import {readEditStatus} from '../formats/edit-status';
import { readExamineDataJson, type ExamineData } from '../formats/examine';
import { EXPERT_CARD_IDS, readExpertDeck, type ExpertDeck } from '../formats/expert-cards';
import { readMapMiniature, type MapMiniature } from '../formats/map-window';
import { readBuyCatalogData, type BuyCatalog } from '../formats/buy-window';
import { allCropFiles } from '../formats/crop-slots';
import { readRegionArtwork, type RegionArtwork } from '../formats/region-artwork';
import { miniTileAtlas, readPalette, type Raster } from '../formats/graphics';
import type { NewFarmAssets } from '../simulation/create-farm';
import type { DisasterSprites } from '../render/disaster-renderer';
import type { FlightSprites } from '../render/aircraft-renderer';
import type { CropDefinition } from '../formats/crop';
import { readScenario, type Scenario } from '../formats/scenario';
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
export interface WindowArtwork { title: HTMLImageElement; inactive: HTMLImageElement; close: HTMLImageElement; end: HTMLImageElement; endInactive: HTMLImageElement; frame: HTMLImageElement }
export interface WeatherArtwork {frame:HTMLImageElement;sky:HTMLImageElement;ground:HTMLImageElement;vane:HTMLImageElement}
export interface AboutAssets {frame:HTMLImageElement;logo:HTMLImageElement;credits:string[][]}
export interface GameAssets { editCursors:{pick:HTMLImageElement;drop:HTMLImageElement;view:HTMLImageElement;bulldoze:HTMLImageElement;spray:HTMLImageElement;buy:HTMLImageElement}; about:AboutAssets; townEventTiles: HTMLImageElement[]; townChoiceArtwork:HTMLImageElement; balanceArtwork:HTMLImageElement; weatherArtwork:WeatherArtwork; expertPortrait:HTMLImageElement; expertLauncher:HTMLImageElement; timeToggle:HTMLImageElement; expertDeck:ExpertDeck; aircraftArtwork:HTMLImageElement; messageArtwork:HTMLImageElement; eventText:Uint8Array; editStatusText:Uint8Array; examineData: ExamineData; scheduleArtwork: HTMLImageElement; fieldGauges: HTMLImageElement; mapArtwork: HTMLImageElement; miniature: MapMiniature; catalog: Catalog; mainMenus: MainMenus; controlBar: HTMLImageElement; editPalette: HTMLImageElement; sellArtwork: HTMLImageElement; sellCondition: HTMLImageElement; buyArtwork: HTMLImageElement; buyCards: HTMLImageElement; buyCatalog: BuyCatalog; itemText: Uint8Array; windowArtwork: WindowArtwork; maskedTiles: HTMLImageElement; townLayouts: TownLayouts; flightSprites: FlightSprites; disasterSprites: DisasterSprites }
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
  const expert=await Promise.all([
    Promise.all(EXPERT_CARD_IDS.map(id=>response(`raw/card${id}.hc`,signal).then(r=>r.arrayBuffer()).then(b=>new Uint8Array(b))))
      .then(cards=>readExpertDeck(id=>cards[EXPERT_CARD_IDS.indexOf(id)])),
    image('expert-portrait.png',signal),
    image('expert-launcher.png',signal),
    image('time-toggle.png',signal),
  ]);
  if(expert[1].naturalWidth!==112||expert[1].naturalHeight!==64||expert[2].naturalWidth!==26||expert[2].naturalHeight!==26)throw new Error('Invalid Expert artwork');
  if(expert[3].naturalWidth!==52||expert[3].naturalHeight!==26)throw new Error('Invalid pause/resume artwork');
  const [movePick,moveDrop,viewCursor,bulldozeCursor,sprayCursor,buyCursor,aboutFrame,aboutLogo,aboutCredits,townEventTiles,townChoiceArtwork,balanceArtwork,weatherFrame,weatherSky,weatherGround,weatherVane,aircraftArtwork,messageArtwork,eventText,editStatusText,examineData, scheduleArtwork, fieldGauges, catalog, maskedTiles, townLayouts, airplane, shadow, dust, tornado, swarm, mainMenus, controlBar, editPalette, buyArtwork, buyCards, buyCatalog, itemText, mapArtwork, miniatureBytes, sellArtwork, sellCondition, windowFrame, windowTitle, windowInactive, windowClose, windowEnd, windowEndInactive] = await Promise.all([
    image('move-pick.png',signal),image('move-drop.png',signal),image('edit-view.png',signal),image('edit-bulldoze.png',signal),image('edit-spray.png',signal),image('edit-buy.png',signal),image('about-window.png',signal),image('about-logo.png',signal),response('raw/creditz.txt',signal).then(r=>r.arrayBuffer()).then(b=>readAboutCredits(new Uint8Array(b))),
    loadTownEventTiles(signal), image('town-choice.png',signal),image('balance-window.png',signal),image('weather-window.png',signal),image('weather-sky.png',signal),image('weather-ground.png',signal),image('weather-vane.png',signal),
    image('aircraft-window.png',signal),image('popup.bmp.png',signal),response('raw/events.dat',signal).then(r=>r.arrayBuffer()).then(b=>new Uint8Array(b)),response('raw/qmessage.dat',signal).then(r=>r.arrayBuffer()).then(b=>new Uint8Array(b)),
    response('examine.json', signal).then(r=>r.json()).then(readExamineDataJson),
    image('schedule-window.png', signal), image('field-gauges.png', signal),
    response('catalog.json', signal).then(r => r.json()) as Promise<Catalog>, loadMaskedTiles(signal),
    response('raw/townly0.cmp', signal).then(r => r.arrayBuffer()).then(b => new TownLayouts(new Uint8Array(b))),
    image('airplane.sprites.png', signal), image('apshadow.sprites.png', signal), image('cropdust.sprites.png', signal), image('tornado.sprites.png', signal), image('swarm.sprites.png', signal),
    response('main-menus.json', signal).then(r => r.json()).then(readMainMenusData),
    image('control-bar.png', signal), image('edit-palette.png', signal), image('buy-window.png', signal), image('buy-cards.png', signal),
    response('buy-catalog.json', signal).then(r => r.json()).then(readBuyCatalogData),
    response('raw/itemtext.dat', signal).then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    image('map-window.png', signal),
    response('raw/far_mapc.mbm', signal).then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    image('sell-window.png', signal), image('sell-condition.png', signal), image('window-frame.png', signal), image('window-title.png', signal), image('window-title-inactive.png', signal), image('window-close.png', signal), image('window-title-end.png', signal), image('window-title-end-inactive.png', signal),
  ]);
  if([movePick,moveDrop,viewCursor,bulldozeCursor,sprayCursor,buyCursor].some(i=>i.naturalWidth!==16||i.naturalHeight!==16))throw new Error('Invalid Edit cursor');
  if(aboutFrame.naturalWidth!==400||aboutFrame.naturalHeight!==224||aboutLogo.naturalWidth!==104||aboutLogo.naturalHeight!==112)throw new Error('Invalid About artwork');
  if(weatherFrame.naturalWidth!==336||weatherFrame.naturalHeight!==192||[weatherSky,weatherGround].some(i=>i.naturalWidth!==448||i.naturalHeight!==32)||weatherVane.naturalWidth!==64||weatherVane.naturalHeight!==32)throw new Error('Invalid Weather artwork');
  if(catalog.crops.some(c=>typeof c.expertDescription!=='string'||!c.expertDescription))throw new Error('Invalid Expert crop text. Run ./tools/bun run import first.');
  if(aircraftArtwork.naturalWidth!==256||aircraftArtwork.naturalHeight!==176)throw new Error('Invalid Aircraft artwork');
  if(messageArtwork.naturalWidth!==256||messageArtwork.naturalHeight!==192||eventText.length!==16282)throw new Error('Invalid message artwork or text');
  if (controlBar.naturalWidth !== 640 || controlBar.naturalHeight !== 32) throw new Error('Invalid control-bar artwork');
  readEditStatus(editStatusText,75);
  if (editPalette.naturalWidth !== 48 || editPalette.naturalHeight !== 208) throw new Error('Invalid edit-palette artwork');

  if (buyArtwork.naturalWidth !== 256 || buyArtwork.naturalHeight !== 224 || buyCards.naturalWidth !== 896 || buyCards.naturalHeight !== 640 || itemText.length !== 18929) throw new Error('Invalid Buy artwork or text');
  if ([windowTitle, windowInactive, windowClose, windowEnd, windowEndInactive].some(img => img.naturalWidth !== 16 || img.naturalHeight !== 16)) throw new Error('Invalid window title artwork');
  if (windowFrame.naturalWidth !== 24 || windowFrame.naturalHeight !== 16) throw new Error('Invalid window frame artwork');
  if (sellArtwork.naturalWidth !== 192 || sellArtwork.naturalHeight !== 256 || sellCondition.naturalWidth !== 32 || sellCondition.naturalHeight !== 32) throw new Error('Invalid Sell artwork');
  if (mapArtwork.naturalWidth !== 288 || mapArtwork.naturalHeight !== 240) throw new Error('Invalid Map artwork');
  if (scheduleArtwork.naturalWidth !== 336 || scheduleArtwork.naturalHeight !== 224 || fieldGauges.naturalWidth !== 960 || fieldGauges.naturalHeight !== 24) throw new Error('Invalid Schedule artwork');
  if(balanceArtwork.naturalWidth!==400||balanceArtwork.naturalHeight!==224)throw new Error('Invalid Balance Sheet artwork');
  if(townChoiceArtwork.naturalWidth!==368||townChoiceArtwork.naturalHeight!==224)throw new Error('Invalid town choice artwork');
  return { editCursors:{pick:movePick,drop:moveDrop,view:viewCursor,bulldoze:bulldozeCursor,spray:sprayCursor,buy:buyCursor},about:{frame:aboutFrame,logo:aboutLogo,credits:aboutCredits},townEventTiles,townChoiceArtwork,balanceArtwork,weatherArtwork:{frame:weatherFrame,sky:weatherSky,ground:weatherGround,vane:weatherVane},expertPortrait:expert[1],expertLauncher:expert[2],timeToggle:expert[3],expertDeck:expert[0],aircraftArtwork,messageArtwork,eventText,editStatusText,examineData, scheduleArtwork, fieldGauges, mapArtwork, miniature: readMapMiniature(miniatureBytes, catalog.palette), sellArtwork, sellCondition, catalog, mainMenus, controlBar, editPalette, buyArtwork, buyCards, buyCatalog, itemText, windowArtwork: { title: windowTitle, inactive: windowInactive, close: windowClose, end: windowEnd, endInactive: windowEndInactive, frame: windowFrame }, maskedTiles, townLayouts, flightSprites: { airplane, shadow, dust }, disasterSprites: { tornado, swarm } };
}
export async function loadScenarioAssets(id: number, signal: AbortSignal) {
  const [buffer, tiles] = await Promise.all([
    response(`raw/SCEN${id}.SSM`, signal).then(r => r.arrayBuffer()), image(`scenario${id}.tiles.png`, signal),
  ]);
  const scenario = readScenario(new Uint8Array(buffer));
  return { scenario, tiles: await loadGeneratedTiles(scenario.cropFiles, signal) };
}
export async function loadMusic(id: string, signal: AbortSignal): Promise<ArrayBuffer> {
  return (await response(`${id}.mid`, signal)).arrayBuffer();
}
export async function loadSound(id: GameSound, signal: AbortSignal) {
  return decodeVoc(new Uint8Array(await (await response(`raw/${id}.voc`, signal)).arrayBuffer()));
}

/** The terrain sheets for a farm's crops. They hold all twenty-four shipped crops at fixed places, so every farm
 * shares the same imported files; the renderer maps the farm's slots to them (fixedCropTiles). */
export async function loadGeneratedTiles(cropFiles: readonly string[], signal: AbortSignal): Promise<HTMLImageElement> {
  cropFiles = allCropFiles(cropFiles);
  if (cropFiles.length !== 24 || cropFiles.some(n => !/^[a-z0-9_]{1,8}\.crp$/.test(n))) throw new Error('Invalid crop filenames');
  if (!terrainSheets) {
    // Shared by every farm, so loaded once; one caller's abort must not cancel it for the others.
    terrainSheets = weatherAtlas('terrain-tiles', new AbortController().signal).then(tiles => {
      // 1392 tiles: the 880 original tiles and the eight native crop slots (crop-slots.ts), 32 per row.
      if (tiles.naturalWidth !== 512 || tiles.naturalHeight !== 704) throw new Error('Invalid terrain tiles. Run ./tools/bun run import first.');
      return tiles;
    });
    terrainSheets.catch(() => { terrainSheets = null; });
  }
  return abortable(terrainSheets, signal);
}
let terrainSheets: Promise<HTMLImageElement> | null = null;
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
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


/** Imported sprite sheets (tools/import.ts): each atlas PNG with its .inverted outline variant, and the rain and
 * frost palette variants for terrain and town events. Every sprite and canvas draw shares these files. */
async function atlasFile(name: string, signal: AbortSignal): Promise<HTMLImageElement> {
  const [normal, inverse] = await Promise.all([image(`${name}.png`, signal), image(`${name}.inverted.png`, signal)]);
  return registerInvertedTiles(normal, inverse);
}
async function weatherAtlas(name: string, signal: AbortSignal): Promise<HTMLImageElement> {
  const [normal, rain, frost] = await Promise.all(['', '.rain', '.frost'].map(suffix => atlasFile(name + suffix, signal)));
  return registerWeatherTiles(normal, rain, frost);
}
/** Original recreation banks share the global terrain palette; retain all three
 * weather variants without modifying a farm's crop-expanded atlas. */
function loadTownEventTiles(signal: AbortSignal): Promise<HTMLImageElement[]> {
  return Promise.all([0, 1, 2].map(mode => weatherAtlas(`town-event-tiles-${mode}`, signal)));
}
function loadMaskedTiles(signal: AbortSignal): Promise<HTMLImageElement> {
  return atlasFile('masked-tiles', signal);
}
