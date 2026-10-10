import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding } from './building-storage';
import { demolishBuilding } from './building-demolition';
import { removeField } from './field-removal';
import { queueClearingEffect, validateClearingEffects } from './clearing-effects';
import { clearManualTerrain, removableTerrain } from './terrain-removal';
import type { FarmRandom } from './random';

export interface RemovalTarget {
  kind: 'building' | 'field' | 'inventory' | 'chemical' | 'terrain';
  slot: number;
  tile?: number; // Terrain targets use the map index as slot and verify the displayed graphic.
  x: number;
  y: number;
  width: number;
  height: number;
}
export type ManualRemovalResult = ({ ok: true; price: 25 } & RemovalTarget)
  | { ok: false; reason: 'outside-map' | 'town-owned' | 'insufficient-cash' | 'no-target' | 'field-busy' | 'target-changed' };

/** Manual map handler233c:035c / file0x2591c, building before field.
 * Then loose inventory/chemicals, followed by the original terrain chain. */
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
  if (f) {
    if (f.state !== 0 && f.state !== 4) return { ok: false, reason: 'field-busy' };
    return { ok: true, kind: 'field', slot: f.slot, x: f.x, y: f.y, width: f.width, height: f.height, price: 25 };
  }
  const cell = world.cells[worldIndex(x, y)], tile = terrainTile(cell), overlay = cell.overlay & 0x7ff;
  // These lookups are first-active point queries, bounded natively (SF-017).
  if ((tile >= 175 && tile <= 176) || (overlay >= 1020 && overlay <= 1024)) {
    const item = world.inventory.find(i => i.slot > 0 && i.active && i.x === x && i.y === y);
    if (item) return { ok: true, kind: 'inventory', slot: item.slot, x, y, width: 1, height: 1, price: 25 };
    // Source missing-inventory branch skips chemical lookup and tries terrain.
  } else {
    const chemical = world.chemicals.find(c => c.slot > 0 && c.active && c.x === x && c.y === y);
    if (chemical) return { ok: true, kind: 'chemical', slot: chemical.slot, x, y, width: 1, height: 1, price: 25 };
  }
  return removableTerrain(tile) ? { ok: true, kind: 'terrain', slot: worldIndex(x, y), tile, x, y, width: 1, height: 1, price: 25 }
    : { ok: false, reason: 'no-target' };
}

/** The user confirms the displayed object. Recheck the click and identity
 * against canonical state before applying source cleanup and category−1 debit.
 * Invalid references throw during existing cleanup preflight, before payment. */
export function removeManualTarget(world: Scenario, finances: FinancialState, x: number, y: number,
  expected: Pick<RemovalTarget, 'kind' | 'slot' | 'tile'>, soilMoisture: number, random?: FarmRandom): ManualRemovalResult {
  const result = checkManualRemoval(world, x, y);
  if (!result.ok) return result;
  if (result.kind !== expected.kind || result.slot !== expected.slot || (result.kind === 'terrain' && result.tile !== expected.tile))
    return { ok: false, reason: 'target-changed' };
  const expenses = finances.annual.otherExpenses;
  if (!Number.isInteger(expenses) || expenses < 0 || expenses > 0xffffffff) throw new Error('Invalid removal account');
  validateClearingEffects(finances.clearing, soilMoisture);
  if (result.kind === 'building') demolishBuilding(world, finances.accounts, result.slot, finances.clearing, soilMoisture);
  else if (result.kind === 'field') removeField(world, result.slot, finances.clearing, soilMoisture);
  else if (result.kind === 'terrain') clearManualTerrain(world, x, y, soilMoisture, random);
  else {
    const item = result.kind === 'inventory' ? world.inventory[result.slot] : world.chemicals[result.slot], type = item.type;
    const definition = result.kind === 'chemical' ? world.chemicalDefinitions[type - 220]
      : type >= 168 && type < 168 + world.cropFiles.length ? world.harvestDefinitions[type - 168]
      : type >= 192 && type < 192 + world.cropFiles.length ? world.seedDefinitions[type - 192]
      : type === 299 || type === 300 ? finances.accounts.otherDefinitions[type - 288] : undefined;
    if (!definition || definition.type !== type || !definition.count) throw new Error('Invalid loose-item removal definition');
    const cell = world.cells[worldIndex(x, y)], masked = result.kind === 'chemical' || ![175, 176].includes(terrainTile(cell));
    definition.count--; item.bytes[result.kind === 'chemical' ? 2 : 10] &= ~0x20;
    queueClearingEffect(world, finances.clearing, x, y, soilMoisture);
    if (masked) {
      cell.terrain &= ~0x800;
      cell.overlay = (cell.overlay & 0xf800) | (15 + (cell.attribute & 15));
    }
  }
  world.farm.cash -= 25;
  finances.annual.otherExpenses = (expenses + 25) >>> 0;
  return result;
}
