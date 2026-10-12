import { validateCalendar, type FarmCalendar } from '../simulation/calendar';
import type { TownEventState, TownEventDialog } from '../simulation/town-events';
import type { TownEventMode } from './town-event-graphics';

/** Native exact continuation includes fields omitted from original SSM and the
 * uploaded bank, which can differ from mode after insufficient rodeo funds. */
export interface TownEventContinuation {
  phase: 'weekly-water' | 'weekly-rollover' | 'debug';
  before: FarmCalendar;
  resumeRunning: boolean;
}
export interface TownEventCheckpoint extends TownEventState {
  artworkMode: TownEventMode;
  continuation: TownEventContinuation | null;
}
function decodeContinuation(value: unknown): TownEventContinuation | null {
  if (value === null) return null;
  const o = object(value), c = object(o.before);
  if ((o.phase !== 'weekly-water' && o.phase !== 'weekly-rollover' && o.phase !== 'debug') || typeof o.resumeRunning !== 'boolean') fail();
  const before = { day: number(c.day, 6), week: number(c.week, 3), month: number(c.month, 11),
    year: number(c.year, 65535), season: number(c.season, 3) };
  validateCalendar(before);
  if (o.phase !== 'debug' && before.day !== 6) fail();
  return { phase: o.phase, before, resumeRunning: o.resumeRunning };
}
function fail(): never { throw new Error('Invalid native save: town event'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
function number(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) fail();
  return value;
}
function species(value: unknown): number {
  const n = number(value, 255);
  if (n > 3 && n !== 255) fail();
  return n;
}
/** Mandatory fields; never replay entry, RNG draws, debits or prize credits. */
export function decodeTownEventCheckpoint(value: unknown): TownEventCheckpoint {
  const o = object(value);
  const mode = number(o.mode, 2) as TownEventMode;
  let pending: TownEventDialog | null = null;
  if (o.pending !== null) {
    const p = object(o.pending);
    if (p.kind === 'fair-announcement' || p.kind === 'fair-entry' || p.kind === 'rodeo-entry') pending = { kind: p.kind };
    else if (p.kind === 'fair-result' || p.kind === 'rodeo-result') {
      if (typeof p.won !== 'boolean') fail();
      pending = { kind: p.kind, won: p.won, animalType: species(p.animalType) };
    } else fail();
  }
  const result: TownEventCheckpoint = {
    mode, artworkMode: number(o.artworkMode, 2) as TownEventMode,
    rodeoFrame: number(o.rodeoFrame, 3), lastTick: number(o.lastTick, 65535),
    rodeoX: number(o.rodeoX, 1), rodeoY: number(o.rodeoY, 1),
    animalType: species(o.animalType), participation: number(o.participation, 65535),
    weeksRemaining: number(o.weeksRemaining, 255), pending, continuation: decodeContinuation(o.continuation),
  };
  if (pending) {
    if (mode !== (pending.kind.startsWith('fair-') ? 2 : 1)) fail();
    if (pending.kind === 'fair-announcement' && result.animalType !== 255) fail();
    if (pending.kind === 'fair-entry' && result.animalType === 255) fail();
    if (pending.kind === 'fair-result' || pending.kind === 'rodeo-result') {
      if (result.weeksRemaining !== 0 || result.participation === 0 || pending.animalType !== result.animalType) fail();
      if (pending.kind === 'fair-result' && pending.animalType === 255) fail();
    }
  }
  return result;
}
export function encodeTownEventCheckpoint(state: TownEventCheckpoint): TownEventCheckpoint {
  return decodeTownEventCheckpoint(state);
}
