import { Binary } from '../formats/binary';
import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { MAX_EQUIPMENT_SLOT, type EquipmentRecord } from '../formats/equipment';
import { createEquipment } from './equipment-rental';
import { validAircraftHome } from './aircraft-home';

export const AIRCRAFT_CHEMICALS = [221, 222, 223] as const;
/** Original shared DS65fa/65fc selector; initialized221, independent of loaded word+34. */
export interface AircraftServiceState { selectedChemical: number }
export const createAircraftServiceState = (): AircraftServiceState => ({ selectedChemical: 221 });
export type AircraftPurchaseResult = { ok: true; slot: number; price: number; x: number; y: number }
  | { ok: false; reason: 'no-airport' | 'no-parking' | 'no-equipment-slots' | 'insufficient-cash' | 'parking-conflict' };
export type AircraftServiceAction = { kind: 'fuel' | 'repair' | 'load' } | { kind: 'chemical'; chemicalType: number };
export type AircraftServiceResult = { ok: true; slot: number; price: number; refund: number; changed: boolean }
  | { ok: false; reason: 'not-aircraft' | 'not-parked' | 'invalid-service' | 'invalid-supplies' | 'insufficient-cash' };
const u32 = (n: number) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
const view = (e: EquipmentRecord) => new Binary(e.bytes).view;
export const aircraftFuel = (e: EquipmentRecord): number => view(e).getUint16(20, true);
export const aircraftPayload = (e: EquipmentRecord): number => view(e).getUint16(32, true);
export const aircraftChemical = (e: EquipmentRecord): number => view(e).getUint16(34, true);
const parkedTiles = [[71, 111], [72, 112]];

/** Purchase0x30dc6: no ground-shop ownership, signed-price or strict-cash gate. */
export function checkAircraftPurchase(world: Scenario, finances: FinancialState): AircraftPurchaseResult {
  if (!Number.isInteger(finances.town.airportCount) || finances.town.airportCount < 0 || finances.town.airportCount > 255 ||
    !u32(world.farm.cash)) throw new Error('Invalid aircraft purchase state');
  if (!finances.town.airportCount) return { ok: false, reason: 'no-airport' };
  const d = world.equipmentDefinitions[8];
  if (d.type !== 8 || d.width !== 2 || d.height !== 2 || d.graphic !== 82) throw new Error('Invalid aircraft definition');
  if (world.farm.cash < d.price) return { ok: false, reason: 'insufficient-cash' };
  const slot = world.equipment.find(e => e.slot > 0 && e.slot <= MAX_EQUIPMENT_SLOT && !e.active)?.slot;
  if (!slot) return { ok: false, reason: 'no-equipment-slots' };
  for (let rx = 0; rx < 12; rx++) for (let ry = 0; ry < 12; ry++) {
    const region = world.regionalConditions[(rx * 12 + ry) * 7];
    if ((region & 15) !== 5) continue;
    const offset = !(region & 0x20) ? 3 : !(region & 0x40) ? 5 : -1;
    if (offset < 0) continue;
    const x = rx * 8 + offset, y = ry * 8 + 6;
    // Preserve source parking order, but do not overwrite a live plane if its regional bit is inconsistent.
    if (world.equipment.some(e => e.active && e.type === 8 && e.bytes[50] === x && e.bytes[51] === y))
      return { ok: false, reason: 'parking-conflict' };
    return { ok: true, slot, price: d.price, x, y };
  }
  return { ok: false, reason: 'no-parking' };
}

export function purchaseAircraft(world: Scenario, finances: FinancialState): AircraftPurchaseResult {
  const result = checkAircraftPurchase(world, finances);
  if (!result.ok) return result;
  if (![finances.accounts.equipmentExpenses, finances.accounts.assets.equipmentBookValue].every(u32))
    throw new Error('Invalid aircraft purchase accounts');
  createEquipment(world, 8, result.x, result.y, world.farm.timerTicks);
  world.equipmentDefinitions[8].ownedCount++;
  world.farm.cash -= result.price;
  finances.accounts.equipmentExpenses = (finances.accounts.equipmentExpenses + result.price) >>> 0;
  finances.accounts.assets.equipmentBookValue = (finances.accounts.assets.equipmentBookValue + result.price) >>> 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++)
    world.cells[worldIndex(result.x + dx, result.y + dy)].terrain = parkedTiles[dx][dy];
  world.regionalConditions[((result.x >>> 3) * 12 + (result.y >>> 3)) * 7] |= (result.x & 7) === 3 ? 0x20 : 0x40;
  return result;
}

/** Source dialog is entered through parked images0x257b0. Native rejects
 * incoherent records before a transaction; future flight must leave this state. */
export function checkAircraftService(world: Scenario, finances: FinancialState, state: AircraftServiceState,
  slot: number, action: AircraftServiceAction): AircraftServiceResult {
  const e = world.equipment[slot];
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_EQUIPMENT_SLOT || !e?.active || e.type !== 8) return { ok: false, reason: 'not-aircraft' };
  if (!validAircraftHome(e) || e.x !== e.bytes[50] || e.y !== e.bytes[51] || (e.flags & 15) ||
    parkedTiles.some((column, dx) => column.some((tile, dy) => terrainTile(world.cells[worldIndex(e.x + dx, e.y + dy)]) !== tile)))
    return { ok: false, reason: 'not-parked' };
  if (!AIRCRAFT_CHEMICALS.some(t => t === state.selectedChemical)) throw new Error('Invalid aircraft chemical selection');
  if (!u32(world.farm.cash) || !u32(finances.annual.otherExpenses)) throw new Error('Invalid aircraft service accounts');
  const fuel = aircraftFuel(e), payload = aircraftPayload(e);
  if (fuel > 255 || payload > 255) return { ok: false, reason: 'invalid-supplies' };
  const unitPrice = Math.floor(world.chemicalDefinitions[state.selectedChemical - 220].price / 10);
  let price = 0, refund = 0, changed = false;
  if (action.kind === 'fuel') { price = ((255 - fuel) * 1) & 65535; changed = price !== 0; }
  else if (action.kind === 'repair') { price = (e.condition * 10) & 65535; changed = price !== 0; }
  else if (action.kind === 'load') { price = (255 - payload) * unitPrice; changed = price !== 0; }
  else if (action.kind === 'chemical' && AIRCRAFT_CHEMICALS.some(t => t === action.chemicalType)) {
    changed = action.chemicalType !== state.selectedChemical;
    // Original uses the prior GLOBAL selection price, not this plane's word+34 (SF-109).
    if (changed) refund = (payload * unitPrice) & 65535;
  } else return { ok: false, reason: 'invalid-service' };
  if (world.farm.cash < price) return { ok: false, reason: 'insufficient-cash' };
  return { ok: true, slot, price, refund, changed };
}

/** Fuel0x309ac, selection0x30a08/0x30a7e/0x30ae4, load0x30cda, repair0x30d38.
 * Expense category-1, including refund0x1ca28; zero payment does not replenish. */
export function serviceAircraft(world: Scenario, finances: FinancialState, state: AircraftServiceState,
  slot: number, action: AircraftServiceAction): AircraftServiceResult {
  const result = checkAircraftService(world, finances, state, slot, action);
  if (!result.ok || !result.changed) return result;
  const e = world.equipment[slot], v = view(e);
  if (action.kind === 'chemical') {
    world.farm.cash = Math.min(9_999_999, (world.farm.cash + result.refund) >>> 0);
    finances.annual.otherExpenses = (finances.annual.otherExpenses - result.refund) >>> 0;
    v.setUint16(32, 0, true); state.selectedChemical = action.chemicalType;
    // Original leaves loaded type+34 until a nonzero load payment succeeds.
  } else {
    world.farm.cash -= result.price;
    finances.annual.otherExpenses = (finances.annual.otherExpenses + result.price) >>> 0;
    if (action.kind === 'fuel') v.setUint16(20, 255, true);
    else if (action.kind === 'repair') e.bytes[17] = 0;
    else { v.setUint16(32, 255, true); v.setUint16(34, state.selectedChemical, true); }
  }
  return result;
}
