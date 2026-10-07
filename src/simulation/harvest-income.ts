import { Binary } from '../formats/binary';
import type { FieldRecord } from '../formats/field';
import type { Scenario } from '../formats/scenario';
import { fieldHarvestValue } from './harvest-value';

/** Harvest credit: 0x1ca28/category 168 and the caller's 6190:3e44 addition. */
export function creditHarvest(world: Scenario, amount: number): void {
  if (!Number.isInteger(amount) || amount < 0 || amount > 0xffffffff) throw new Error('Invalid harvest income');
  const farm = world.farm;
  farm.cash = Math.min(9_999_999, (farm.cash + amount) >>> 0);
  farm.cropIncome = (farm.cropIncome + amount) >>> 0;
  farm.salesAccumulator = (farm.salesAccumulator + amount) >>> 0;
}

/** Contract settlement 0x15b03..0x15bae and worker equivalent 0x164c9..0x16563. */
export function settleHarvestContract(world: Scenario, field: FieldRecord, crop: readonly number[]): number {
  const f = new Binary(field.bytes), price = world.cropDefinitions[field.cropSlot].price;
  if (!f.u16(48)) throw new Error('Harvest field has no contract');
  const contracted = fieldHarvestValue(field, crop, price);
  world.cropDefinitions[field.cropSlot].count--;
  f.view.setUint16(48, 0, true);
  const market = fieldHarvestValue(field, crop, price);
  if (market > contracted) world.farm.contractLosses = (world.farm.contractLosses + market - contracted) >>> 0;
  else world.farm.contractGains = (world.farm.contractGains + contracted - market) >>> 0;
  creditHarvest(world, contracted);
  return contracted;
}
