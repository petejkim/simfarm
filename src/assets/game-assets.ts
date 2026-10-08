import type { DisasterSprites } from '../render/disaster-renderer';
import type { FlightSprites } from '../render/aircraft-renderer';
import type { CropDefinition } from '../formats/crop';
import { readScenario } from '../formats/scenario';
import type { MidiSequence } from '../formats/xmidi';
import { TownLayouts } from '../formats/town';
import { decodeVoc } from '../formats/voc';
import type { GameSound } from '../simulation/events';

export interface Catalog {
  crops: CropDefinition[];
  music: { id: string; duration: number }[];
  tileCount: number;
}
export interface GameAssets { catalog: Catalog; maskedTiles: HTMLImageElement; townLayouts: TownLayouts; flightSprites: FlightSprites; disasterSprites: DisasterSprites }
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
  const [catalog, maskedTiles, townLayouts, airplane, shadow, dust, tornado, swarm] = await Promise.all([
    response('catalog.json', signal).then(r => r.json()) as Promise<Catalog>, image('masked-tiles.png', signal),
    response('raw/townly0.cmp', signal).then(r => r.arrayBuffer()).then(b => new TownLayouts(new Uint8Array(b))),
    image('airplane.sprites.png', signal), image('apshadow.sprites.png', signal), image('cropdust.sprites.png', signal), image('tornado.sprites.png', signal), image('swarm.sprites.png', signal),
  ]);
  return { catalog, maskedTiles, townLayouts, flightSprites: { airplane, shadow, dust }, disasterSprites: { tornado, swarm } };
}
export async function loadScenarioAssets(id: number, signal: AbortSignal) {
  const [buffer, tiles] = await Promise.all([
    response(`raw/SCEN${id}.SSM`, signal).then(r => r.arrayBuffer()), image(`scenario${id}.tiles.png`, signal),
  ]);
  return { scenario: readScenario(new Uint8Array(buffer)), tiles };
}
export async function loadMusic(id: string, signal: AbortSignal): Promise<MidiSequence> {
  return (await response(`${id}.music.json`, signal)).json();
}
export async function loadSound(id: GameSound, signal: AbortSignal) {
  return decodeVoc(new Uint8Array(await (await response(`raw/${id}.voc`, signal)).arrayBuffer()));
}
