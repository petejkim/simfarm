import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding, findStorageSpace, toggleBuildingInterior } from './building-storage';
import { findEquipmentAt } from './manual-equipment-move';

export type SupplyMoveKind = 'chemical' | 'seed' | 'harvest' | 'trough' | 'feed';
export interface SupplyMoveTarget { kind: SupplyMoveKind; type: number; slot: number; x: number; y: number; buildingSlot: number | null }
type Failure = { ok: false; reason: 'outside-map' | 'equipment-here' | 'no-supply' | 'inconsistent-supply'
  | 'target-changed' | 'not-owned' | 'blocked-terrain' | 'incompatible-storage' | 'no-storage-space' | 'storage-slot-overflow' };
export type SupplyPickupResult = ({ ok: true } & SupplyMoveTarget) | Failure;
export type SupplyMoveResult = { ok: true; kind: SupplyMoveKind; slot: number; x: number; y: number; buildingSlot: number | null; deleted: boolean } | Failure;
const inMap = (x: number, y: number) => [x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96);

function definition(world: Scenario, finances: FinancialState, t: SupplyMoveTarget) {
  return t.kind === 'chemical' ? world.chemicalDefinitions[t.type - 220]
    : t.kind === 'seed' ? world.seedDefinitions[t.type - 192]
    : t.kind === 'harvest' ? world.harvestDefinitions[t.type - 168]
    : finances.accounts.otherDefinitions[t.type - 288];
}
/** Initialized tile table0x4ec60+DS085e: chemicals74..77, seeds87..102,
 * harvest109..124, trough79 and feed81. Only source-decoded single-cell goods. */
const graphic = (t: SupplyMoveTarget) => t.kind === 'chemical' ? 915 - (t.type - 220)
  : t.kind === 'seed' ? 832 + t.type - 192 : t.kind === 'harvest' ? 816 + t.type - 168 : t.kind === 'trough' ? 175 : 1020;

/** Non-equipment pickup branches0x13774..0x13bce. Chemicals are found by
 * record coordinates; other categories first require their original map graphic.
 * SF-116: selection is read-only, including troughs inside storage. */
export function checkSupplyPickup(world: Scenario, finances: FinancialState, x: number, y: number): SupplyPickupResult {
  if (!inMap(x, y)) return { ok: false, reason: 'outside-map' };
  if (findEquipmentAt(world, x, y)) return { ok: false, reason: 'equipment-here' };
  const chemical = world.chemicals.find(c => c.slot > 0 && c.active && c.x === x && c.y === y);
  const cell = world.cells[worldIndex(x, y)], tile = terrainTile(cell), overlay = cell.overlay & 0x7ff;
  const kind: SupplyMoveKind | undefined = chemical ? 'chemical' : tile >= 832 && tile <= 847 ? 'seed'
    : tile >= 816 && tile <= 831 ? 'harvest' : tile === 175 || tile === 176 ? 'trough'
    : overlay >= 1020 && overlay <= 1024 ? 'feed' : undefined;
  if (!kind) return { ok: false, reason: 'no-supply' };
  const item = chemical ?? world.inventory.find(i => i.slot > 0 && i.active && i.x === x && i.y === y);
  if (!item) return { ok: false, reason: 'inconsistent-supply' };
  const type = item.type;
  if (!(kind === 'chemical' ? type >= 220 && type <= 223 : kind === 'seed' ? type >= 192 && type <= 207
    : kind === 'harvest' ? type >= 168 && type <= 183 : type === (kind === 'trough' ? 299 : 300)))
    return { ok: false, reason: 'inconsistent-supply' };
  const b = findBuilding(world, x, y), target: SupplyMoveTarget = { kind, type, slot: item.slot, x, y, buildingSlot: b?.slot ?? null };
  const d = definition(world, finances, target), expectedGraphic = kind === 'chemical' ? 74 + type - 220
    : kind === 'seed' ? 87 + type - 192 : kind === 'harvest' ? 109 + type - 168 : kind === 'trough' ? 79 : 81;
  if (!d || d.type !== type || d.graphic !== expectedGraphic || d.width !== 1 || d.height !== 1)
    return { ok: false, reason: 'inconsistent-supply' };
  if (b) {
    const content = b.content((x - b.x) * 3 + y - b.y);
    if (content.type !== type || content.slot !== item.slot) return { ok: false, reason: 'inconsistent-supply' };
  }
  return { ok: true, ...target };
}

type Prepared = Failure | { ok: true; result: Extract<SupplyMoveResult, { ok: true }>; apply: () => void };
function prepare(world: Scenario, finances: FinancialState, selected: SupplyMoveTarget, x: number, y: number, soilMoisture: number): Prepared {
  if (!inMap(x, y)) return { ok: false, reason: 'outside-map' };
  const destination = world.cells[worldIndex(x, y)];
  if (!(destination.overlay & 0x800)) return { ok: false, reason: 'not-owned' }; // Shared drop0x13c19.
  const picked = checkSupplyPickup(world, finances, selected.x, selected.y);
  if (!picked.ok) return picked;
  if (picked.kind !== selected.kind || picked.type !== selected.type || picked.slot !== selected.slot || picked.buildingSlot !== selected.buildingSlot)
    return { ok: false, reason: 'target-changed' };
  if (!Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid supply movement soil state');
  const { kind, type, slot } = picked, d = definition(world, finances, picked);
  const item = kind === 'chemical' ? world.chemicals[slot] : world.inventory[slot];
  const sourceBuilding = picked.buildingSlot === null ? undefined : world.buildings[picked.buildingSlot];
  const found = findBuilding(world, x, y);
  const storage = kind === 'trough' || kind === 'feed' ? undefined : found;
  if (found && kind === 'feed') return { ok: false, reason: 'incompatible-storage' };
  let storageIndex: number | null = null, dx = x, dy = y;
  if (storage) {
    // Source grouping0x1a5ca..0x1a72c: seeds bypass the64/65 gate;
    // the general66..69 branch also accepts harvests (SF-117/118).
    const accepts = kind === 'seed' || (kind === 'harvest' && [64, 65].includes(storage.type)) || (storage.type >= 66 && storage.type <= 69);
    if (!accepts) return { ok: false, reason: 'incompatible-storage' };
    if (slot > 255) return { ok: false, reason: 'storage-slot-overflow' }; // SF-021: reference is a byte.
    // Original checks BEFORE releasing the source, even within the same building.
    const space = findStorageSpace(storage, 1, 1, world);
    if (!space) return { ok: false, reason: 'no-storage-space' };
    storageIndex = space.x * 3 + space.y; dx = storage.x + space.x; dy = storage.y + space.y;
  } else {
    const tile = terrainTile(destination);
    // Native occupied-trough guard corrects SF-116; the other branches already test0800.
    if (tile < 15 || tile > 31 || (destination.terrain & 0x800)) return { ok: false, reason: 'blocked-terrain' };
  }
  const deleted = kind === 'feed' && world.inventory[slot].quantity === 0;
  if (deleted && !d.count) return { ok: false, reason: 'inconsistent-supply' };
  const result: Extract<SupplyMoveResult, { ok: true }> = { ok: true, kind, slot, x: dx, y: dy, buildingSlot: storage?.slot ?? null, deleted };
  return { ok: true, result, apply: () => {
    const refresh = (b: NonNullable<typeof sourceBuilding>) => { toggleBuildingInterior(b, world); toggleBuildingInterior(b, world); };
    // Insert first, using the preflight's space, matching the source transfer order.
    if (storage) {
      if (kind === 'chemical') { item.bytes[5] = dx; item.bytes[6] = dy; item.bytes[2] |= 4; }
      else { item.bytes[8] = dx; item.bytes[9] = dy; } // SF-118 also updates harvest coordinates in66..69.
      storage.setContent(storageIndex!, graphic(picked), type, slot); refresh(storage);
    }
    const source = world.cells[worldIndex(picked.x, picked.y)];
    const restore = (word: number, attribute: number) => ((word & 0xf800) | (15 + soilMoisture + (attribute >>> 2))) & 65535;
    if (sourceBuilding) {
      sourceBuilding.clearContent((picked.x - sourceBuilding.x) * 3 + picked.y - sourceBuilding.y); refresh(sourceBuilding);
      // SF-116: stored feed also releases its reference; troughs retain the refreshed floor.
    } else if (kind === 'feed') {
      source.terrain &= ~0x800; source.overlay = (source.overlay & 0xf800) | (15 + (source.attribute & 15));
    } else {
      source.terrain = restore(source.terrain, source.attribute);
      if (kind === 'chemical') { source.terrain &= ~0x800; source.overlay = restore(source.overlay, source.attribute); }
    }
    if (storage) { refresh(storage); return; }
    if (kind === 'chemical') {
      item.bytes[5] = x; item.bytes[6] = y;
      destination.overlay = (destination.overlay & 0xf800) | graphic(picked); destination.terrain |= 0x800;
      // Ground branch does not clear retained chemical flag4 in the source.
    } else {
      item.bytes[8] = x; item.bytes[9] = y;
      if (kind === 'feed') {
        const quantity = world.inventory[slot].quantity;
        if (deleted) {
          const grass = 15 + (destination.attribute & 15);
          destination.terrain = (destination.terrain & 0xf000) | grass;
          destination.overlay = (destination.overlay & 0xf800) | grass;
          item.bytes[10] &= ~32; d.count--;
        } else {
          const tile = quantity < 102 ? 1024 : quantity < 206 ? 1023 : quantity < 308 ? 1022 : quantity < 410 ? 1021 : 1020;
          destination.overlay = (destination.overlay & 0xf800) | tile; destination.terrain |= 0x800;
        }
      } else destination.terrain = (destination.terrain & 0xf800) | (kind === 'trough' ? 175 + Number(world.inventory[slot].quantity !== 0) : graphic(picked));
    }
  } };
}

export function checkSupplyMove(world: Scenario, finances: FinancialState, selected: SupplyMoveTarget, x: number, y: number, soilMoisture: number): SupplyMoveResult {
  const prepared = prepare(world, finances, selected, x, y, soilMoisture);
  return prepared.ok ? prepared.result : prepared;
}
export function moveManualSupply(world: Scenario, finances: FinancialState, selected: SupplyMoveTarget, x: number, y: number, soilMoisture: number): SupplyMoveResult {
  const prepared = prepare(world, finances, selected, x, y, soilMoisture);
  if (!prepared.ok) return prepared;
  prepared.apply(); return prepared.result;
}
