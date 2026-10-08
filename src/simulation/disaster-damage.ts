import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding } from './building-storage';
import { prepareDisasterBuilding } from './disaster-building';
import { queueClearingEffect, validateClearingEffects } from './clearing-effects';
import { repairTerrainNeighbors } from './terrain-removal';

const between = (n: number, low: number, high: number) => n >= low && n <= high;

/** Post-object terrain chain0x267b1..0x26a72. Aircraft crash tiles and193
 * accepted by the manual bulldozer are absent from this disaster helper. */
export function disasterRemovesTerrain(tile: number): boolean {
  return between(tile, 150, 171) || between(tile, 87, 108) || between(tile, 177, 191)
    || between(tile, 131, 146) || between(tile, 175, 176) || between(tile, 122, 125)
    || between(tile, 172, 173) || between(tile, 535, 538);
}

export type DisasterDamageResult = { ok: false; reason: 'outside-map' | 'insufficient-cash' } | {
  ok: true; buildingSlot: number | null; fieldSlot: number | null; inventorySlot: number | null;
  terrainCleared: boolean; cost: 0 | 25;
};

/** Destructive map helper233c:0fd8/file0x26598..0x26c62.
 * This is a damage primitive, not a user bulldozer command or disaster scheduler.
 * No ownership, field-work, confirmation or general demolition-fee gate applies. */
export function damageDisasterCell(world: Scenario, finances: FinancialState, x: number, y: number, soilMoisture: number): DisasterDamageResult {
  if (![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96)) return { ok: false, reason: 'outside-map' };
  validateClearingEffects(finances.clearing, soilMoisture);
  const cell = world.cells[worldIndex(x, y)], building = findBuilding(world, x, y);
  const result: Extract<DisasterDamageResult, { ok: true }> = {
    ok: true, buildingSlot: null, fieldSlot: null, inventorySlot: null, terrainCleared: false, cost: 0,
  };
  let applyObject: (() => void) | undefined;
  if (building) {
    // Original0x26657 removes a recognized pump/windmill source before cleanup.
    // Existing demolition also handles this by record type (SF-093).
    applyObject = prepareDisasterBuilding(world, finances, building.slot, soilMoisture);
    result.buildingSlot = building.slot;
  } else {
    const field = world.fields.find(f => f.slot > 0 && f.contains(x, y));
    if (field) {
      if (between(terrainTile(cell), 680, 839)) {
        const view = new DataView(field.bytes.buffer, field.bytes.byteOffset, field.bytes.byteLength);
        const loss = Math.min(65535, view.getUint16(18, true) + 256); // Saturating helper0x1b7c6.
        applyObject = () => { cell.terrain = (cell.terrain & 0xf824) | 0x24; view.setUint16(18, loss, true); };
        result.fieldSlot = field.slot;
      }
    } else {
      const tile = terrainTile(cell), overlay = cell.overlay & 0x7ff;
      if (between(tile, 175, 176) || between(overlay, 1020, 1024)) {
        const item = world.inventory.find(i => i.slot > 0 && i.active && i.x === x && i.y === y);
        if (item) {
          const masked = !between(tile, 175, 176);
          applyObject = () => {
            // Calls raw deletion0x152b0, not generic definition-accounted deletion.
            // Definition counts deliberately survive (SF-122); active total is derived natively.
            item.bytes[10] &= ~32;
            queueClearingEffect(world, finances.clearing, x, y, soilMoisture);
            if (masked) cell.terrain &= ~0x800; // Original retains the secondary graphic.
          };
          result.inventorySlot = item.slot;
        }
      }
    }
  }
  // No object branch that mutates the tile above leaves a paid tree behind.
  // Preflight the debit before any mutation; malformed native ledgers also fail atomically.
  const paidTree = !applyObject && between(terrainTile(cell), 535, 538);
  if (paidTree) {
    if (![world.farm.cash, world.farm.workerExpenses].every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff))
      throw new Error('Invalid disaster clearing accounts');
    if (world.farm.cash < 25) return { ok: false, reason: 'insufficient-cash' };
  }
  applyObject?.();
  // Source reads the tile again AFTER cleanup: clearing images do not enter this branch.
  const tile = terrainTile(cell);
  if (!disasterRemovesTerrain(tile)) return result;
  if (between(tile, 535, 538)) {
    world.farm.cash -= 25; world.farm.workerExpenses = (world.farm.workerExpenses + 25) >>> 0;
    result.cost = 25; // Original0x26aaa..0x26ab1, debit category500.
  }
  cell.terrain = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 65535;
  if (between(tile, 150, 171)) repairTerrainNeighbors(world, x, y, 'road');
  else if (between(tile, 177, 187)) repairTerrainNeighbors(world, x, y, 'fence');
  else if (between(tile, 87, 108)) repairTerrainNeighbors(world, x, y, 'irrigation');
  // Gates/valves/crossings are removed without neighbor repair. Neither shore
  // reconstruction nor the manual crossing's2000 clear occurs (SF-124).
  result.terrainCleared = true;
  return result;
}
