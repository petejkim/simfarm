import type { FinancialState } from '../formats/finance';
import { worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding } from './building-storage';
import { demolishBuilding } from './building-demolition';
import { removeField } from './field-removal';

export interface RemovalTarget {
  kind: 'building' | 'field';
  slot: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export type ManualRemovalResult = ({ ok: true; price: 25 } & RemovalTarget)
  | { ok: false; reason: 'outside-map' | 'town-owned' | 'insufficient-cash' | 'no-target' | 'field-busy' | 'target-changed' };

/** Manual map handler233c:035c / file0x2591c, building before field.
 * This entry point covers the two confirmed whole-object branches. Loose
 * goods, trees, fences, roads and ditches have separate pending branches. */
export function checkManualRemoval(world: Scenario, x: number, y: number): ManualRemovalResult {
  if (![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96)) return { ok: false, reason: 'outside-map' };
  if (world.cells[worldIndex(x, y)].overlay & 0x4000) return { ok: false, reason: 'town-owned' };
  // Source tests town ownership, not player ownership: pumps can be off-farm.
  if (!Number.isInteger(world.farm.cash) || world.farm.cash < 0 || world.farm.cash > 0xffffffff) throw new Error('Invalid removal cash');
  if (world.farm.cash < 25) return { ok: false, reason: 'insufficient-cash' };
  const b = findBuilding(world, x, y);
  if (b) {
    const d = world.buildingDefinitions[b.type - 64];
    return { ok: true, kind: 'building', slot: b.slot, x: b.x, y: b.y, width: d.width, height: d.height, price: 25 };
  }
  const f = world.fields.find(f => f.slot > 0 && f.contains(x, y));
  if (!f) return { ok: false, reason: 'no-target' };
  if (f.state !== 0 && f.state !== 4) return { ok: false, reason: 'field-busy' };
  return { ok: true, kind: 'field', slot: f.slot, x: f.x, y: f.y, width: f.width, height: f.height, price: 25 };
}

/** The user confirms the displayed object. Recheck the click and identity
 * against canonical state before applying source cleanup and category−1 debit.
 * Invalid references throw during existing cleanup preflight, before payment. */
export function removeManualTarget(world: Scenario, finances: FinancialState, x: number, y: number,
  expected: Pick<RemovalTarget, 'kind' | 'slot'>, soilMoisture: number): ManualRemovalResult {
  const result = checkManualRemoval(world, x, y);
  if (!result.ok) return result;
  if (result.kind !== expected.kind || result.slot !== expected.slot) return { ok: false, reason: 'target-changed' };
  const expenses = finances.annual.otherExpenses;
  if (!Number.isInteger(expenses) || expenses < 0 || expenses > 0xffffffff) throw new Error('Invalid removal account');
  if (result.kind === 'building') demolishBuilding(world, finances.accounts, result.slot, finances.clearing, soilMoisture);
  else removeField(world, result.slot, finances.clearing, soilMoisture);
  world.farm.cash -= 25;
  finances.annual.otherExpenses = (expenses + 25) >>> 0;
  return result;
}
