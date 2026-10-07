import type { Scenario } from '../formats/scenario';
import { validateAnnualStatistics, type AnnualStatistics } from '../formats/annual-statistics';
import { summarizeFieldStatus } from './field-report';
import { ownedLandValue } from './tax';

/** 0x3d980..0x3da07: signed assignment division, then wrapped subtraction,
 * then a signed-negative clamp. Distinct from unsigned loanCreditLimit. */
export function annualAssetValue(land: number, equipment: number, buildings: number,
  ds3e58: number, ds3e5c: number, principal: number): number {
  if (![land, equipment, buildings, ds3e58, ds3e5c, principal].every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff)) {
    throw new Error('Invalid annual asset value');
  }
  const sum = (land + equipment + buildings + ds3e58 + ds3e5c) | 0;
  const result = (Math.trunc(sum / 3) - principal) | 0;
  return result < 0 ? 0 : result;
}

/** 0x3cc20..0x3cd08. SF-078: above the final bound, AX is still the
 * original low value word. Preserve it without treating it as an array index. */
export function annualAssetRating(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error('Invalid annual asset rating');
  const signed = value | 0;
  const rank = [4000, 15000, 50000, 100000, 200000, 300000, 500000, 1000000].findIndex(limit => signed < limit);
  return rank < 0 ? value & 65535 : rank;
}

/** 0x1f020, also called weekly at 0xbe8b before the field-water/status pass. */
export function updateReportedFieldStatus(world: Pick<Scenario, 'fields' | 'farm'>, state: AnnualStatistics): 'dfarm' | 'ffarm' | null {
  validateAnnualStatistics(state);
  const report = summarizeFieldStatus(world.fields, world.farm.cash);
  state.fieldPresence = report.presence;
  state.distinctFieldStatuses = report.distinctStatuses;
  state.nutrientDeficientFields = report.nutrientDeficientFields;
  state.chemicallyStressedFields = report.chemicallyStressedFields;
  return report.musicRequest;
}

/** 0x1f4d2 then 0x1f574, after annual tax/choice/reset/projection. */
export function updateAnnualStatistics(world: Scenario, state: AnnualStatistics, equipment: number, buildings: number,
  principal: number, soilMoisture: number): 'dfarm' | 'ffarm' | null {
  validateAnnualStatistics(state);
  if (world.regionalConditions.length !== 144 * 7) throw new Error('Invalid annual region table');
  if (!Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid soil moisture');
  // Validate/derive every fallible input before mutating report state.
  const value = annualAssetValue(ownedLandValue(world, soilMoisture), equipment, buildings, state.ds3e58, state.ds3e5c, principal);
  const report = summarizeFieldStatus(world.fields, world.farm.cash);
  const regions = [state.regions[2], state.regions[3], 0, 0];
  for (let i = 0; i < 144; i++) {
    const owner = world.regionalConditions[i * 7 + 1];
    if (owner === 1) regions[3]++;
    else if (owner === 2) regions[2]++;
  }
  const w = [...state.words], signedByte = (n: number) => n << 24 >> 24;
  w[11] = w[10]; w[10] = signedByte(regions[3]) & 65535;
  w[13] = w[12]; w[12] = signedByte(regions[2]) & 65535;
  w[1] = w[0]; w[0] = (w[10] - w[0]) & 65535;
  w[3] = w[2]; w[2] = (w[12] - w[2]) & 65535;
  w[5] = w[4]; w[4] = (annualAssetRating(value) - w[4]) & 65535;
  w[7] = w[6]; w[6] = report.nutrientDeficientFields;
  w[9] = w[8]; w[8] = report.chemicallyStressedFields;
  Object.assign(state, { regions, words: w, fieldPresence: report.presence, distinctFieldStatuses: report.distinctStatuses,
    nutrientDeficientFields: report.nutrientDeficientFields, chemicallyStressedFields: report.chemicallyStressedFields });
  return report.musicRequest;
}
