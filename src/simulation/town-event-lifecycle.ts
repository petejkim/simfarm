import { readTownEvent } from '../formats/town-event';
import { decodeTownEventCheckpoint, type TownEventCheckpoint } from '../formats/town-event-save';

/** Initialized EXE DS1ed0..1ed9 is zero; normal atlas bank matchesega16til. */
export function coldTownEvent(): TownEventCheckpoint {
  return { participation: 0, mode: 0, artworkMode: 0, weeksRemaining: 0, lastTick: 0,
    rodeoFrame: 0, rodeoX: 0, rodeoY: 0, animalType: 0, pending: null, continuation: null };
}
/** Known SSM transfers45be6..45c75. Original position bits and uploaded artwork
 * have no transfer in this block. Native world replacement dismisses old dialogs. */
export function importTownEvent(bytes: Uint8Array, prior = coldTownEvent()): TownEventCheckpoint {
  return decodeTownEventCheckpoint({ ...prior, ...readTownEvent(bytes), pending: null, continuation: null });
}
/** Explicit restart stores40679/406a9/406b1/407b1/40908.
 * Countdown and position bits are not cleared by these stores. No bank upload. */
export function resetTownEvent(prior: TownEventCheckpoint): TownEventCheckpoint {
  return decodeTownEventCheckpoint({ ...prior, mode: 0, participation: 0, lastTick: 0,
    rodeoFrame: 0, animalType: 0, pending: null, continuation: null });
}
