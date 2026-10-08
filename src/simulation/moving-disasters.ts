import type { FinancialState } from '../formats/finance';
import type { Scenario } from '../formats/scenario';
import { damageDisasterCell, type DisasterDamageResult } from './disaster-damage';
import type { FarmRandom } from './random';

export type MovingDisasterKind = 'tornado' | 'swarm';
export interface MovingDisaster {
  frame: number; lastTick: number; x: number; y: number;
  dx: number; dy: number; startedTick: number;
}
/** Known DS6994..69b4 globals only. Other disaster branches are not implemented
 * here. Flags remain shared with those branches; no renderer/window is required. */
export interface MovingDisasterState {
  enabled: boolean; flags: number; frameDelay: number; lastStartTick: number; windReferenceTick: number;
  tornado: MovingDisaster;
  swarm: MovingDisaster & { fieldSlot: number };
}
const masks = { tornado: 1, swarm: 32 } as const;
const elapsed = (tick: number, previous: number) => (tick - previous) & 65535;
const word = (n: number) => Number.isInteger(n) && n >= 0 && n <= 65535;
const between = (n: number, low: number, high: number) => Number.isInteger(n) && n >= low && n <= high;

/** Fresh-process initialized bytes, file0x8b084..0x8b0a4. Not an SSM offset. */
export function createMovingDisasters(): MovingDisasterState {
  const effect = (): MovingDisaster => ({ frame: 0, lastTick: 0, x: 0, y: 0, dx: 1, dy: 1, startedTick: 0 });
  return { enabled: true, flags: 0, frameDelay: 4, lastStartTick: 0, windReferenceTick: 0,
    tornado: effect(), swarm: { ...effect(), fieldSlot: 0 } };
}

export function validateMovingDisasters(state: MovingDisasterState): void {
  if (typeof state.enabled !== 'boolean' || !between(state.flags, 0, 65535) || (state.flags & 33) === 33 ||
    !word(state.frameDelay) || !word(state.windReferenceTick) || !word(state.lastStartTick)) throw new Error('Invalid moving disaster state');
  for (const kind of ['tornado', 'swarm'] as const) {
    const e = state[kind], limit = kind === 'swarm' ? 100 : 95; // Retained origin95+5 for narrow edge fields.
    if (!between(e.frame, 0, 3) || !word(e.lastTick) || !word(e.startedTick) ||
      !between(e.x, 0, limit) || !between(e.y, 0, limit) || !between(e.dx, -1, 1) || !between(e.dy, -1, 1))
      throw new Error('Invalid moving disaster effect');
  }
  if (!between(state.swarm.fieldSlot, 0, 97) || ((state.flags & 32) && !state.swarm.fieldSlot))
    throw new Error('Invalid swarm field');
}

export type MovingDisasterStart = { ok: true; kind: MovingDisasterKind; cancelledSwarm: boolean }
  | { ok: false; reason: 'disabled' | 'already-active' | 'tornado-active' | 'no-fields' };

/** Start branches0x36874/0x36bac, called by the general disaster entry0x36574.
 * The caller owns the general price callback (no-op for modes1/4), notifications/audio and other modes.
 * Source retains frames and the tornado's last frame clock across restarts. */
export function beginMovingDisaster(world: Scenario, state: MovingDisasterState, kind: MovingDisasterKind,
  tick: number, random: FarmRandom): MovingDisasterStart {
  validateMovingDisasters(state);
  if (!word(tick)) throw new Error('Invalid disaster tick');
  if (!state.enabled) return { ok: false, reason: 'disabled' };
  if (state.flags & masks[kind]) return { ok: false, reason: 'already-active' };
  if (kind === 'swarm' && (state.flags & 1)) return { ok: false, reason: 'tornado-active' };
  const e = state[kind], cancelledSwarm = kind === 'tornado' && Boolean(state.flags & 32);
  if (kind === 'swarm') {
    const fields = world.fields.filter(f => f.slot > 0 && f.active);
    if (!fields.length) return { ok: false, reason: 'no-fields' };
    // 0x1b802: zero becomes ordinal1; the final field is never selected when
    // count>1. Preserve the original bias (SF-126), with bounded traversal.
    const field = fields[Math.max(1, random.below(fields.length)) - 1];
    state.swarm.fieldSlot = field.slot; e.x = field.x; e.y = field.y; e.lastTick = tick;
  } else {
    state.flags &= ~32;
    e.x = (random.nextVisual() & 63) + 16; e.y = (random.nextVisual() & 63) + 16;
    chooseTornadoDirection(e, random);
  }
  state.flags |= masks[kind]; e.startedTick = tick; state.lastStartTick = tick;
  return { ok: true, kind, cancelledSwarm };
}

/** Stop branches0x36d9c/0x3706c. Tornado expiration is caller-driven, not
 * automatic at age1920: the source stop request refuses earlier requests. */
export function stopMovingDisaster(state: MovingDisasterState, kind: MovingDisasterKind, tick: number): boolean {
  validateMovingDisasters(state);
  if (!word(tick)) throw new Error('Invalid disaster tick');
  if (!(state.flags & masks[kind]) || (kind === 'tornado' && elapsed(tick, state.tornado.startedTick) < 1920)) return false;
  state.flags &= ~masks[kind]; return true;
}

function chooseTornadoDirection(e: MovingDisaster, random: FarmRandom): void {
  e.dx = random.nextVisual() & 1; e.dy = random.nextVisual() & 1;
  if (random.nextVisual() & 1) e.dx = -e.dx;
  if (random.nextVisual() & 1) e.dy = -e.dy;
  // The signed DOS byte has one representation of zero.
  if (!e.dx) e.dx = 0;
  if (!e.dy) e.dy = 0;
}

export interface MovingDisasterStep {
  advanced: MovingDisasterKind[];
  hits: { x: number; y: number; result: DisasterDamageResult }[];
  swarmEnded: boolean;
}

/** Moving branches0x3716b..0x37677. One iteration per dispatcher call, with
 * unsigned wrapping clocks and a strict >delay gate. No viewport or host RNG. */
export function advanceMovingDisasters(world: Scenario, finances: FinancialState, state: MovingDisasterState,
  tick: number, soilMoisture: number, random: FarmRandom): MovingDisasterStep {
  validateMovingDisasters(state);
  if (!word(tick)) throw new Error('Invalid disaster tick');
  const out: MovingDisasterStep = { advanced: [], hits: [], swarmEnded: false };
  const hit = (x: number, y: number) => out.hits.push({ x, y, result: damageDisasterCell(world, finances, x, y, soilMoisture) });
  // Disabling new disasters does not terminate one already running.
  if ((state.flags & 32) && elapsed(tick, state.swarm.lastTick) > state.frameDelay) {
    const e = state.swarm, field = world.fields[e.fieldSlot];
    if (!field) throw new Error('Invalid swarm field');
    out.advanced.push('swarm'); e.frame++;
    if (e.frame > 3) {
      e.frame = 0;
      hit(e.x + 1, e.y + 2); hit(e.x + 2, e.y + 2); hit(e.x + 1, e.y + 1); hit(e.x, e.y + 1);
      e.dx = random.nextVisual() & 1 ? 1 : -1; e.dy = random.nextVisual() & 1 ? 1 : -1;
      // Source reads the retained record coordinates even after field removal.
      e.x = Math.max(field.x, Math.min(field.x + 5, e.x + e.dx));
      e.y = Math.max(field.y, Math.min(field.y + 5, e.y + e.dy));
    }
    e.lastTick = tick;
    if (elapsed(tick, e.startedTick) > 512) out.swarmEnded = stopMovingDisaster(state, 'swarm', tick);
  }
  if ((state.flags & 1) && elapsed(tick, state.tornado.lastTick) > state.frameDelay) {
    const e = state.tornado;
    out.advanced.push('tornado'); e.frame++;
    if (e.frame > 3) {
      e.frame = 0;
      e.x = Math.max(0, Math.min(95, e.x + e.dx)); e.y = Math.max(0, Math.min(95, e.y + e.dy));
      hit(e.x + 1, e.y + 2); // SF-125: origin clamp does not bound this offset.
      if (e.y > 86) e.dy = -1; else if (e.y < 10) e.dy = 1;
      // Random changes occur AFTER the edge correction and may override it.
      if ((random.nextVisual() & 15) === 6) chooseTornadoDirection(e, random);
    }
    e.lastTick = tick;
  }
  return out;
}
