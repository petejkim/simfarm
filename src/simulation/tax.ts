import type { Scenario } from '../formats/scenario';
import { quoteLand } from './land';

export interface TaxAssessment {
  salesDivisor: 10 | 5 | 3;
  salesTax: number;
  landValue: number;
  landTax: number;
  arrears: number;
  total: number;
}

/** Overlay 15:2008 / file 0x3cba8. Only ownership 1 contributes;
 * each plot is valued by 0x3c766, whose DX is explicitly zeroed. */
export function ownedLandValue(world: Scenario, soilMoisture: number): number {
  let value = 0;
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) {
    if (world.regionalConditions[(x * 12 + y) * 7 + 1] === 1) {
      value = (value + quoteLand(world, x, y, soilMoisture)!.price) >>> 0;
    }
  }
  return value;
}

/** Resident 1a66:0cc0 / file 0x1d520..0x1d5c2.
 * The bracket depends on cash, not sales or profit. Runtime 0084:33f8
 * divides signed dwords, truncating toward zero; additions retain 32 bits.
 * Arrears are an explicit input until the payment/town state is integrated.
 * This quotation neither debits cash nor resets the sales accumulator. */
export function assessAnnualTax(world: Scenario, soilMoisture: number, arrears: number): TaxAssessment {
  for (const value of [world.farm.cash, world.farm.salesAccumulator, arrears]) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error('Invalid tax accounting value');
  }
  if (!Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid soil moisture');
  const salesDivisor = world.farm.cash < 150000 ? 10 : world.farm.cash < 500000 ? 5 : 3;
  const salesTax = Math.trunc((world.farm.salesAccumulator | 0) / salesDivisor) | 0;
  const landValue = ownedLandValue(world, soilMoisture), landTax = Math.trunc((landValue | 0) / 99);
  return { salesDivisor, salesTax, landValue, landTax, arrears, total: (salesTax + arrears + landTax) >>> 0 };
}
