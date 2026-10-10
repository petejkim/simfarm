import type { Scenario } from '../formats/scenario';
import type { FarmRandom } from './random';

export interface MarketState {
  /** Null denotes an unrecorded sample in a migrated native checkpoint. */
  history: (number | null)[][];
  mood: number;
  /** DSbc72: tested/reset by the updater, but no increment is verified. */
  rawBC72: number;
}
type MarketRandom = Pick<FarmRandom, 'nextSimulation' | 'below'>;
type TradeTables = Pick<Scenario, 'cropDefinitions' | 'harvestDefinitions' | 'seedDefinitions'>;
// Source cold bytes at801e0..8059f,90356,90362; tested against readMarketDefaults.
export function createColdMarket(): MarketState {
  return { history: Array.from({ length: 16 }, () => Array(30).fill(0)), mood: 0, rawBC72: 0 };
}
const signedWord = (n: number) => n << 16 >> 16;
const signedByte = (n: number) => n << 24 >> 24;
const isInteger = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n <= max;

export function validateMarketState(market: MarketState): void {
  if (!isInteger(market.mood, 255) || !isInteger(market.rawBC72, 255)) throw new Error('Invalid market byte');
  if (!Array.isArray(market.history) || ![16, 24].includes(market.history.length) || market.history.some(row =>
    !Array.isArray(row) || row.length !== 30 || row.some((price, i) => price === null ? i === 29 : !isInteger(price, 65535)))) throw new Error('Invalid market history');
}

function validateCrops(crops: readonly (readonly number[])[]): void {
  if (![16, 24].includes(crops.length) || crops.some(crop => crop.length !== 128 || crop.some(byte => !isInteger(byte, 255)))) {
    throw new Error('Invalid market crop definitions');
  }
}

/** Crop loader0x466d0..0x466ee writes only the newest history word. Loading
 * an SSM skips the random startup histories (main0x2393..0x239f). Retain all
 * other words/mode bytes; a cold caller supplies the original EXE data. */
export function loadMarketCropPrices(market: MarketState, crops: readonly (readonly number[])[]): void {
  validateMarketState(market); validateCrops(crops);
  crops.forEach((crop, slot) => { market.history[slot][29] = crop[34] | crop[35] << 8; });
}

/** Weekly0x4aea4, after all five aging phases and before wind0xbe55..0xbe74.
 * Trade prices synchronize here, separately from planting/disaster history.
 * Native extra slots use a forked RNG and cannot change the original shared mood. */
export function updateWeeklyMarket(world: TradeTables, crops: readonly (readonly number[])[], market: MarketState, random: MarketRandom, extraRandom: MarketRandom = random): void {
  validateMarketState(market); validateCrops(crops);
  if ([world.cropDefinitions, world.harvestDefinitions, world.seedDefinitions].some(table =>
    table.length < crops.length || Array.from({ length: crops.length }, (_, i) => table[i]).some(d => !d))) throw new Error('Invalid market trade tables');
  if ((random.nextSimulation() & 15) >= 13) market.mood = random.below(3);
  if (signedByte(market.rawBC72) > 12) {
    market.mood = (market.mood + 1) & 255;
    if (signedByte(market.mood) > 2) market.mood = 0;
    market.rawBC72 = 0;
  }
  let originalMood = market.mood;
  for (let slot = 0; slot < crops.length; slot++) {
    if (slot === 16) originalMood = market.mood;
    const rng = slot < 16 ? random : extraRandom;
    const history = market.history[slot], crop = crops[slot];
    history.copyWithin(0, 1);
    let price = history[29]!;
    const step = signedWord(price) >> 3; // Before the zero-to-one assignment.
    if (!price) price = 1;
    const choice = rng.nextSimulation() & 7;
    if (market.mood <= 2) {
      const threshold = market.mood === 0 ? 3 : market.mood === 1 ? 1 : 5;
      const adjustment = (rng.nextSimulation() & 3) * step;
      price = (price + (choice <= threshold ? adjustment : -adjustment)) & 65535;
    }
    const base = crop[34] | crop[35] << 8;
    price = Math.min(price, (base << 1) & 65535);
    price = Math.max(price, base >>> 1);
    if (signedWord(price) < 10) { price = 10; market.mood = 1; }
    history[29] = price;
    world.cropDefinitions[slot].price = world.harvestDefinitions[slot].price = price;
    world.seedDefinitions[slot].price = Math.max(5, (signedWord(price) >> 2) & 65535);
  }
  if (crops.length === 24) market.mood = originalMood;
}

/** Plant callback0x4b066: changes history only, with a signed quarter step. */
export function adjustMarketForPlanting(market: MarketState, slot: number): void {
  validateMarketState(market);
  if (!isInteger(slot, market.history.length - 1)) throw new Error('Invalid market crop slot');
  const price = market.history[slot][29]!;
  market.history[slot][29] = (price - (signedWord(price) >> 2)) & 65535;
}

/** General disaster callback0x4b090: changes history before eligibility gates.
 * Modes1/4/7/8 do nothing. Native callers retain their own enabled gate. */
export function adjustMarketForDisaster(market: MarketState, crops: readonly (readonly number[])[], mode: number): void {
  validateMarketState(market); validateCrops(crops);
  if (![2, 3, 5, 6].includes(mode)) return;
  const sensitivity = mode === 2 ? 71 : mode === 3 ? 70 : 72;
  for (let slot = 0; slot < crops.length; slot++) {
    const crop = crops[slot];
    if (!crop[sensitivity]) continue;
    const shift = crop[sensitivity] & 31, price = market.history[slot][29]!;
    market.history[slot][29] = Math.min((price + (shift >= 16 ? 0 : price >>> shift)) & 65535,
      ((crop[34] | crop[35] << 8) << 2) & 65535);
  }
}
