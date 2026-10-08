import type { Scenario } from '../formats/scenario';
import { worldIndex } from '../formats/scenario';
import type { FieldRecord } from '../formats/field';
import type { WeatherState } from './weather';
import type { FarmRandom } from './random';
import { selectDisasterField, validateMovingDisasters, type MovingDisasterState } from './moving-disasters';
import { adjustMarketForDisaster, type MarketState } from './market';

export type StationaryDisasterKind = 'frost' | 'crop-circles' | 'toxic-land';
export type StationaryDisasterStart = { ok: true; kind: StationaryDisasterKind; fields: number[]; cancelledSwarm: boolean }
  | { ok: false; reason: 'disabled' | 'already-active' | 'no-fields' | 'ineligible-crop' };
const masks = { frost: 16, 'crop-circles': 64, 'toxic-land': 128 } as const;
const byte = (n: number) => n << 24 >> 24;

/** Saturating word18 helper0x1b7c6, not a field-state change. */
function addLoss(field: FieldRecord, amount: number): void {
  const view = new DataView(field.bytes.buffer, field.bytes.byteOffset, field.bytes.byteLength);
  view.setUint16(18, Math.min(65535, view.getUint16(18, true) + amount), true);
}

/** Start branches0x365a0/0x3672c/0x36836. No guessed natural triggers or
 * periodic damage. Audio, event dialogs and menu state belong to the caller. */
export function beginStationaryDisaster(world: Scenario, crops: readonly (readonly number[])[], market: MarketState,
  weather: WeatherState, shared: MovingDisasterState, kind: StationaryDisasterKind, tick: number,
  random: FarmRandom): StationaryDisasterStart {
  validateMovingDisasters(shared);
  if (!Number.isInteger(tick) || tick < 0 || tick > 65535) throw new Error('Invalid disaster tick');
  if (!shared.enabled) return { ok: false, reason: 'disabled' };
  if (kind === 'frost') adjustMarketForDisaster(market, crops, 5); // Before already-active check.
  if (shared.flags & masks[kind]) return { ok: false, reason: 'already-active' };
  const affected: number[] = [];
  let cancelledSwarm = false;
  if (kind === 'frost') {
    cancelledSwarm = Boolean(shared.flags & 32); shared.flags &= ~32;
    if (weather.temperature > 28) weather.temperatureAnomaly = byte(weather.temperature - 28);
    for (const field of world.fields) if (field.slot && field.active && crops[field.cropSlot][72]) {
      addLoss(field, 255); affected.push(field.slot);
    }
  } else if (kind === 'crop-circles') {
    const field = selectDisasterField(world, random);
    if (!field) return { ok: false, reason: 'no-fields' };
    if (!(crops[field.cropSlot][62] & 2)) return { ok: false, reason: 'ineligible-crop' };
    addLoss(field, 10); affected.push(field.slot);
    const paint = (dx: number, dy: number, tile: number) => {
      const x = field.x + dx, y = field.y + dy;
      // SF-136: source fixed offsets ignore field/map bounds. Retain writes
      // beyond small field rectangles, but never alias or leave the native map.
      if (x < 0 || y < 0 || x >= 96 || y >= 96) return;
      const cell = world.cells[worldIndex(x, y)]; cell.terrain = (cell.terrain & 0xf800) | tile;
    };
    for (let dx = 2; dx < 7; dx++) paint(dx, 4, 209 + dx);
    paint(4, 3, 210); paint(4, 5, 216);
  }
  // Toxic-land mode only sets a persistent warning bit in this source branch.
  shared.flags |= masks[kind]; shared.lastStartTick = tick;
  return { ok: true, kind, fields: affected, cancelledSwarm };
}

/** Daily0xd1ae, before odd-day field work: subtract the full remaining signed
 * anomaly from32-bit temperature, then reduce it by2. SF-137 retains this
 * cumulative drop. The else branch clears frost even for negative anomalies. */
export function advanceFrostDay(weather: WeatherState, shared: MovingDisasterState): boolean {
  if (weather.temperatureAnomaly >= 2) {
    weather.temperature = (weather.temperature - weather.temperatureAnomaly) | 0;
    weather.temperatureAnomaly -= 2; return false;
  }
  weather.temperatureAnomaly = 0;
  const ended = Boolean(shared.flags & 16); shared.flags &= ~16; return ended;
}

/** Dispatcher0x370c8..0x370f1 runs before wind/moving/flood effects.
 * Circle graphics remain after the active bit clears on the next call. */
export function advanceStationaryDisasters(weather: WeatherState, shared: MovingDisasterState): StationaryDisasterKind[] {
  const ended: StationaryDisasterKind[] = [];
  if ((shared.flags & 16) && weather.temperatureAnomaly === 0) { shared.flags &= ~16; ended.push('frost'); }
  if (shared.flags & 64) { shared.flags &= ~64; ended.push('crop-circles'); }
  return ended;
}
