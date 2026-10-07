import type { Scenario } from '../formats/scenario';
import { quoteLand } from './land';
import { townStatistics, type TownFunds } from './town';

/** Write-through view of canonical financial accounts. All dwords store raw bits;
 * these runtime fields do not imply a guessed DOS-save layout. */
export interface TaxAccount extends TownFunds {
  unpaidTaxes: number;
  taxExpenses: number;
  taxFailures: number;
  taxCountdown: number;
}
export interface TaxSettlement {
  assessment: TaxAssessment;
  paid: boolean;
  maintenance: number;
  offerExpansion: boolean;
}

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
 * Arrears are supplied from the canonical debt account.
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

/** Financial part of 0x1d5c4..0x1d765. A true offerExpansion result requests
 * the separate town expansion/choice operation at 0x3bf7a; it is not a claim
 * that a district has been built. No annual ledger reset occurs in this routine. */
export function settleAnnualTax(world: Scenario, soilMoisture: number, account: TaxAccount): TaxSettlement {
  for (const key of ['unpaidTaxes', 'taxExpenses', 'townRevenue', 'expansionFunds'] as const) {
    if (!Number.isInteger(account[key]) || account[key] < 0 || account[key] > 0xffffffff) throw new Error('Invalid tax account');
  }
  for (const key of ['taxFailures', 'taxCountdown'] as const) {
    if (!Number.isInteger(account[key]) || account[key] < 0 || account[key] > 255) throw new Error('Invalid tax account');
  }
  const assessment = assessAnnualTax(world, soilMoisture, account.unpaidTaxes);
  const amount = assessment.total;
  const maintenance = (townStatistics(world).residentialLevels * 200) & 65535;
  world.farm.salesAccumulator = 0;
  // The source tests the amount returned by debit; zero also enters failure.
  const paid = amount !== 0 && amount <= world.farm.cash;
  if (!paid) {
    account.unpaidTaxes = (account.unpaidTaxes + (account.unpaidTaxes >>> 2) + ((amount | 0) >> 2) + amount) >>> 0;
    account.taxFailures = (account.taxFailures + 1) & 255;
    account.townRevenue = (-amount) >>> 0;
    account.taxCountdown = 3;
    return { assessment, paid, maintenance, offerExpansion: false };
  }
  world.farm.cash -= amount;
  account.taxExpenses = (account.taxExpenses + amount) >>> 0;
  account.townRevenue = (account.townRevenue + amount) >>> 0;
  if ((account.townRevenue | 0) < maintenance) {
    const combined = (account.townRevenue + account.expansionFunds) | 0;
    if (combined < maintenance) {
      account.townRevenue = (combined - maintenance) >>> 0;
      account.expansionFunds = 0;
    } else {
      account.expansionFunds = (account.expansionFunds + account.townRevenue - maintenance) >>> 0;
      account.townRevenue = 0;
    }
    return { assessment, paid, maintenance, offerExpansion: false };
  }
  const quarter = (amount | 0) >> 2;
  account.expansionFunds = (account.expansionFunds + quarter) >>> 0;
  account.townRevenue = (account.townRevenue - quarter - maintenance) >>> 0;
  return { assessment, paid, maintenance, offerExpansion: true };
}
