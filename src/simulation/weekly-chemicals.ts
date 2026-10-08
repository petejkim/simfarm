import { Binary } from '../formats/binary';
import type { Scenario } from '../formats/scenario';

/** 0xc110..0xc13d, after buildings and before animals. Byte9 supplies the
 * condition band in0x1454e; ordinary consumption does not scale by this byte.
 * Retain source wrapping and every other byte (SF-104). */
export function ageChemicals(world: Scenario): void {
  const chemicals = world.chemicals.filter(c => c.slot > 0 && c.active);
  if (chemicals.some(c => c.slot >= 127 || c.type < 220 || c.type > 223 || c.x >= 96 || c.y >= 96))
    throw new Error('Invalid weekly chemical');
  for (const c of chemicals) {
    const b = new Binary(c.bytes);
    b.view.setUint16(10, (b.u16(10) + 1) & 65535, true);
    c.bytes[9] = (c.bytes[9] + 1) & 255;
  }
}
