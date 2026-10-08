import { validateTraffic, type TrafficState } from '../formats/traffic';
import type { FarmRandom } from './random';
import type { TownSite } from './town';

/**0xd2be: clear the count and every flag byte, retaining the other seven bytes
 * and clocks. This does not erase already painted traffic from a live map. */
export function resetTrafficRecords(state: TrafficState): void {
  validateTraffic(state);
  for (const record of state.records) record.bytes[0] = 0;
  state.activeCount = 0;
}

/**0xd2ea: first free slot including0, flags|3, word coordinates, heading byte,
 * one visual draw for sprite variant. A null result means full, not slot0.
 * Native validates counts/coordinates before mutation (SF-145). */
export function allocateTraffic(state: TrafficState, x: number, y: number, heading: number,
  random: Pick<FarmRandom, 'nextVisual'>): number | null {
  validateTraffic(state);
  if (![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96) ||
    !Number.isInteger(heading) || heading < 0 || heading > 7) throw new Error('Invalid traffic placement');
  if (state.activeCount === 16) return null;
  const record = state.records.find(r => !r.active)!;
  const data = new DataView(record.bytes.buffer, record.bytes.byteOffset, record.bytes.byteLength);
  record.bytes[0] |= 3;
  data.setUint16(2, x, true); data.setUint16(4, y, true);
  record.bytes[6] = heading; record.bytes[7] = random.nextVisual() & 3;
  state.activeCount++;
  return record.slot;
}

/** Main0x2560..0x258e, after startup weather: eight allocations at the town
 * origin with heading4. Full-table calls consume no RNG; no map painting yet. */
export function initializeStartingTraffic(state: TrafficState, town: TownSite,
  random: Pick<FarmRandom, 'nextVisual'>): number[] {
  validateTraffic(state);
  if (![town.regionX, town.regionY].every(n => Number.isInteger(n) && n >= 0 && n < 12)) throw new Error('Invalid traffic town');
  const slots: number[] = [];
  for (let i = 0; i < 8; i++) {
    const slot = allocateTraffic(state, town.regionX * 8, town.regionY * 8, 4, random);
    if (slot !== null) slots.push(slot);
  }
  return slots;
}
