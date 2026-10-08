import type { Scenario } from '../formats/scenario';

/** General start callback0x4b090; called after the enabled gate but before
 * mode eligibility. Modes1/4/7/8 do nothing. SF-130 retains word wrapping. */
export function adjustDisasterPrices(world: Scenario, crops: readonly (readonly number[])[], prices: number[], mode: 2 | 3 | 5 | 6): void {
  const sensitivity = mode === 2 ? 71 : mode === 3 ? 70 : 72;
  for (let i = 0; i < 16; i++) {
    const c = crops[i], shift = c[sensitivity] & 31;
    if (!c[sensitivity]) continue;
    prices[i] = Math.min((prices[i] + (shift >= 16 ? 0 : prices[i] >>> shift)) & 65535, ((c[34] | c[35] << 8) * 4) & 65535);
    world.cropDefinitions[i].price = prices[i];
  }
}
