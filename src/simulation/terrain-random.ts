import type { FarmRandom } from './random';

export type TerrainRandomHistory = [number, number, number, number, number];

/** DS1b7b..1b83 plus startup0x2314..0x2339. The fifth word is shifted but not summed. */
export function initialTerrainHistory(simulationSeed: number): TerrainRandomHistory {
  if (!Number.isInteger(simulationSeed) || simulationSeed < 0 || simulationSeed > 65535) throw new Error('Invalid terrain seed');
  const mix = simulationSeed & 7;
  return [1018 + mix, 4521 + mix, 202 + mix, 419, 3];
}

/** Setup RNG0x81ee: additive history, a visual-stream perturbation, inclusive scaling.
 * Separate from the bounded LFSR; keep this instance across setup rerolls. */
export class TerrainRandom {
  private history: TerrainRandomHistory;
  constructor(private readonly random: Pick<FarmRandom, 'nextVisual'>, history: TerrainRandomHistory) {
    if (history.length !== 5 || history.some(n => !Number.isInteger(n) || n < 0 || n > 65535)) throw new Error('Invalid terrain random history');
    this.history = [...history];
  }
  snapshot(): TerrainRandomHistory { return [...this.history]; }
  inclusive(maximum: number): number {
    if (!Number.isInteger(maximum) || maximum < 0 || maximum > 32766) throw new Error('Invalid terrain random bound');
    const sum = this.history.slice(0, 4).reduce((a, b) => a + b, 0) & 65535;
    this.history = [(sum + (this.random.nextVisual() & 31)) & 65535, ...this.history.slice(0, 4)] as TerrainRandomHistory;
    return Math.min(maximum, Math.floor((sum & 32767) / Math.floor(32767 / (maximum + 1))));
  }
}
