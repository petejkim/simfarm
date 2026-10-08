import { Binary } from './binary';
import type { MarketState } from '../simulation/market';

/** Original cold data overlay29. Decode bytes, never execute the image.
 * History4d9f:fa00, mood DSbc66, raw DSbc72. See docs/market.md. */
export function readMarketDefaults(executable: Uint8Array): MarketState {
  const b = new Binary(executable);
  if (executable.length !== 0x917b9 || b.u16(0) !== 0x5a4d) throw new Error('Unsupported market executable');
  return {
    history: Array.from({ length: 16 }, (_, slot) => Array.from({ length: 30 }, (_, i) => b.u16(0x801e0 + slot * 60 + i * 2))),
    mood: b.slice(0x90356, 1)[0], rawBC72: b.slice(0x90362, 1)[0],
  };
}
