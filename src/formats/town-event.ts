import { Binary } from './binary';

/** SSM0x21674..0x2167b, loader45be6..45c75, saver44bc4..44c53.
 * Preserve raw values; runtime validation belongs at the simulation boundary.
 * In particular participation is a word (fair1 / rodeo1000), not a boolean. */
export interface SavedTownEvent {
  rodeoFrame: number;
  lastTick: number;
  animalType: number;
  participation: number;
  mode: number;
  weeksRemaining: number;
}
export function readTownEvent(bytes: Uint8Array): SavedTownEvent {
  const b = new Binary(bytes);
  b.slice(0x21674, 8);
  return {
    rodeoFrame: bytes[0x21674], lastTick: b.u16(0x21675), animalType: bytes[0x21677],
    participation: b.u16(0x21678), mode: bytes[0x2167a], weeksRemaining: bytes[0x2167b],
  };
}

/** Calendarcb45 loads events.dat record61 before the rodeo decision.
 * Source fixed-record reader exposes254 text bytes; last two remain untouched. */
export function readRodeoInvitation(bytes: Uint8Array): string {
  const record = new Binary(bytes).slice(61 * 256, 256);
  return new TextDecoder('ascii').decode(record.subarray(0, 254)).split('\0')[0]
    .replace(/@/g, ' ').replace(/\s+/g, ' ').trim();
}
