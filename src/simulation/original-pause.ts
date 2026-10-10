import type { SimulationState } from './save-state';
import { setEquipmentPacingByte } from '../formats/scenario-state';

/** DS0187 and the low flag bytes of Ultra/Fast/Normal/Slow/Pause.
 * These are independent of the browser's paused boolean and equipment byte.
 * Null preserves missing historical knowledge; checks are raw bytes, not bools. */
export interface OriginalPauseState {
  depth: number | null;
  speedChecks: [number | null, number | null, number | null, number | null, number | null];
}
export function initialOriginalPause(): OriginalPauseState {
  return { depth: 0, speedChecks: [0, 0, 1, 0, 0] };
}
export function unknownOriginalPause(): OriginalPauseState {
  return { depth: null, speedChecks: [null, null, null, null, null] };
}
/** 40777/4084e..40866 reset checks, but do not write0187. */
export function resetOriginalSpeedChecks(state: OriginalPauseState): void {
  state.speedChecks = [0, 0, 1, 0, 0];
}
/** 3f49d increments with byte wrap. On255->0 it skips all check writes. */
export function enterOriginalPause(state: OriginalPauseState): void {
  if (state.depth === null) {
    // Unknown depth might wrap and retain old checks, or replace them. Keep
    // only bytes that are identical in both possible branches.
    const paused = [0, 0, 0, 0, 1];
    state.speedChecks = state.speedChecks.map((value, i) => value === paused[i] ? value : null) as OriginalPauseState['speedChecks'];
    return;
  }
  state.depth = (state.depth + 1) & 255;
  if (state.depth !== 0) state.speedChecks = [0, 0, 0, 0, 1];
}
/** Successful load return43284 calls3f4e8 after the saved depth replaces0187.
 * Only1->0 reaches the Normal pacing/check stores. Audio/window effects remain
 * separate; this function never changes the browser pause or multiplier. */
export function leaveOriginalPause(state: Pick<SimulationState, 'originalPause' | 'scenario' | 'disasters' | 'traffic'>): void {
  const pause = state.originalPause;
  if (pause.depth === null) throw new Error('Original pause depth is unknown');
  if (pause.depth === 0) return;
  if (--pause.depth !== 0) return;
  setEquipmentPacingByte(state.scenario.farm, 2);
  state.disasters.frameDelay = 4;
  state.scenario.farm.dayDelayTicks = 256; state.scenario.farm.speed = 1;
  state.traffic.delay = 16; state.scenario.irrigation.delay = 2;
  resetOriginalSpeedChecks(pause);
}
