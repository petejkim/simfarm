import type { FinancialState } from '../formats/finance';
import type { Scenario } from '../formats/scenario';

/** Price word (+6) of an 18-byte goods definition, after source lookup 1a66:0a20 (file 0x1d280). Only the ranges the
 * Edit title cost uses are represented: chemicals 220–223 (scenario table) and other goods 288–351 (account table).
 * The source also covers equipment, buildings, crops, animals and seeds; it returns 0 for unmapped types. */
export function goodsPrice(world: Pick<Scenario, 'chemicalDefinitions'>, finances: Pick<FinancialState, 'accounts'>, type: number): number {
  if (type >= 220 && type <= 223) return world.chemicalDefinitions[type - 220]?.price ?? 0;
  if (type >= 288 && type <= 351) return finances.accounts.otherDefinitions[type - 288]?.price ?? 0;
  return 0;
}
