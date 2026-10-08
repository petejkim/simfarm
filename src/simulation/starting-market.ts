import type { FarmRandom } from './random';

type MarketRandom = Pick<FarmRandom, 'nextSimulation'>;

function validatePrice(price: number): void {
  if (!Number.isInteger(price) || price < 0 || price > 0xffff) throw new Error('Invalid starting crop price');
}

function validateMood(mood: number): void {
  if (!Number.isInteger(mood) || mood < 0 || mood > 255) throw new Error('Invalid starting market mood');
}

/** Original startup history0x4adfc: thirty words, before each random adjustment.
 * Unlike the later market update, this uses a fixed unsigned quarter-price step,
 * no price bounds, and an asymmetric mode2. See docs/new-farm.md and SF-144. */
export function initializeCropPriceHistory(initialPrice: number, mood: number, random: MarketRandom): number[] {
  validatePrice(initialPrice); validateMood(mood);
  const history: number[] = [], step = initialPrice >>> 2;
  let price = initialPrice;
  for (let i = 0; i < 30; i++) {
    history.push(price);
    const choice = random.nextSimulation() & 7;
    if (mood > 2 || (mood === 2 && choice <= 5)) continue;
    const decreasing = mood === 0 ? choice <= 3 : mood === 1 ? choice <= 1 : false;
    if ((random.nextSimulation() & 1) === 0) continue;
    const bit = random.nextSimulation() & 1;
    price = (price + step * (decreasing ? bit - 1 : bit + 1)) & 0xffff;
  }
  return history;
}

/** Main0x24a2..0x24b9 calls the history initializer in slot order0..15.
 * Validate all input before consuming RNG; leave the definition prices intact. */
export function initializeStartingMarket(prices: readonly number[], mood: number, random: MarketRandom): number[][] {
  if (prices.length !== 16) throw new Error('Invalid starting market crop count');
  prices.forEach(validatePrice); validateMood(mood);
  return prices.map(price => initializeCropPriceHistory(price, mood, random));
}
