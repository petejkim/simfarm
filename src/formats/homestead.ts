import { Binary } from './binary';

export interface HomesteadState {
  /** 2d9f:000c/000e, independent of protected region words 0010/0012. */
  x: number;
  y: number;
  /** 6190:462e; 255 suppresses first-assignment feedback. */
  rank: number;
}
export function validateHomestead(s: HomesteadState): void {
  if (![s.x, s.y].every(n => Number.isInteger(n) && n >= 0 && n <= 92) ||
    !(s.rank === 255 || Number.isInteger(s.rank) && s.rank >= 0 && s.rank <= 5)) throw new Error('Invalid homestead state');
}
/** Loader 0x4604e..0x4607b. Rank has no established SSM transfer;
 * cold import uses initialized DS 255 without repainting imported terrain. */
export function readHomestead(bytes: Uint8Array): HomesteadState {
  const b = new Binary(bytes), state = { x: b.u16(0x21707), y: b.u16(0x21709), rank: 255 };
  validateHomestead(state);
  return state;
}
