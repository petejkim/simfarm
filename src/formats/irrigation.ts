import { Binary } from './binary';

export interface IrrigationPacket { x: number; y: number; strength: number }
export interface IrrigationState {
  /** Original 2d9f:f954, including inactive bytes. Native saves retain all64 entries. */
  sources: Uint8Array;
  sourceCount: number;
  /** FIFO equivalent of 2d9f:f7d4; native occupancy removes the ring's full/empty alias. */
  flow: IrrigationPacket[];
  phase: 0 | 1;
  active: boolean;
  delay: number;
  lastTick: number;
}
export const IRRIGATION_SOURCE_OFFSET = 0x210d2;
// At most one new visit per world cell, plus64 explicitly seeded source packets.
export const MAX_IRRIGATION_FLOW = 96 * 96 + 64;

/** Loader 0x459b7..0x45a35 uses overlapping stride TWO, not runtime stride three.
 * SF-087: records43..63 are not transferred. Reject an active missing tail;
 * native cold imports zero only the inactive, untransferred runtime bytes.
 * Warm transfers preserve bytes129..191 and the running FIFO/phase/clock;
 * caller/menu pacing changes are separate from the SSM decoder. */
export function readIrrigation(bytes: Uint8Array, retained?: IrrigationState): IrrigationState {
  if (retained) validateIrrigation(retained);
  const b = new Binary(bytes), sourceCount = b.slice(IRRIGATION_SOURCE_OFFSET, 1)[0];
  const raw = b.slice(IRRIGATION_SOURCE_OFFSET + 1, 192), sources = retained ? Uint8Array.from(retained.sources) : new Uint8Array(192);
  if (!retained && sourceCount > 43) throw new Error('Original irrigation source tail is not saved');
  for (let i = 0; i < 64; i++) sources.set(raw.subarray(i * 3, i * 3 + 3), i * 2);
  const state: IrrigationState = { ...(retained ? copyIrrigation(retained) : { flow: [], phase: 0, active: false, lastTick: 0 }),
    sources, sourceCount, delay: b.u16(0x21720) };
  validateIrrigation(state); return state;
}
export function copyIrrigation(s: IrrigationState): IrrigationState {
  return { ...s, sources: Uint8Array.from(s.sources), flow: s.flow.map(p => ({ ...p })) };
}
export function validateIrrigation(s: IrrigationState): void {
  const integer = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n <= max;
  if (!(s.sources instanceof Uint8Array) || s.sources.length !== 192 || !integer(s.sourceCount, 64) ||
    !Array.isArray(s.flow) || s.flow.length > MAX_IRRIGATION_FLOW || (s.phase !== 0 && s.phase !== 1) ||
    typeof s.active !== 'boolean' || !integer(s.delay, 65535) || !integer(s.lastTick, 65535) ||
    (!s.active && s.flow.length > 0)) throw new Error('Invalid irrigation state');
  for (let i = 0; i < s.sourceCount; i++) if (s.sources[i * 3] >= 96 || s.sources[i * 3 + 1] >= 96)
    throw new Error('Invalid irrigation source coordinate');
  for (const p of s.flow) if (!p || !integer(p.x, 95) || !integer(p.y, 95) || !integer(p.strength, 255))
    throw new Error('Invalid irrigation flow packet');
}

/** Registry operations 0x179da / 0x17944. Retain inactive members; SF-089
 * correction shifts only live successors and never reads slot64. */
export function addIrrigationSource(s: IrrigationState, x: number, y: number, strength: number): boolean {
  validateIrrigation(s);
  if (![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96) || !Number.isInteger(strength) || strength < 0 || strength > 255)
    throw new Error('Invalid irrigation source');
  if (s.sourceCount === 64) return false;
  s.sources.set([x, y, strength], s.sourceCount++ * 3); return true;
}
export function removeIrrigationSource(s: IrrigationState, x: number, y: number): boolean {
  validateIrrigation(s);
  for (let i = 0; i < s.sourceCount; i++) if (s.sources[i * 3] === x && s.sources[i * 3 + 1] === y) {
    s.sources.copyWithin(i * 3, (i + 1) * 3, s.sourceCount * 3); s.sourceCount--; return true;
  }
  return false;
}
