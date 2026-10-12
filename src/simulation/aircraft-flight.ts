import { Binary } from '../formats/binary';
import type { FinancialState } from '../formats/finance';
import { worldIndex, type Scenario } from '../formats/scenario';
import { aircraftChemical, aircraftFuel, aircraftPayload, checkAircraftService, createAircraftServiceState } from './aircraft';
import { clearAircraftHome, validAircraftHome } from './aircraft-home';
import { changeFieldCondition } from './field-conditions';

export const FLIGHT_CONTROLS = ['left', 'right', 'climb', 'descend', 'spray-toggle', 'spray-on', 'spray-off', 'end'] as const;
export type FlightControl = typeof FLIGHT_CONTROLS[number];
export const MAX_FLIGHT_INPUTS = 32; // Native input bound; not a claim about BIOS buffer capacity.
export interface AircraftFlight {
  slot: number; columns: number; rows: number; cameraX: number; cameraY: number; offsetX: number; offsetY: number;
  heading: number; altitude: number; spraying: boolean; sprayFrame: number;
  lastFrameTick: number; lastWearTick: number; lastFuelTick: number; lastSprayTick: number;
  turbulence: boolean; turbulenceTick: number; spin: number;
  inputs: FlightControl[]; active: boolean; resumePaused: boolean;
  /** Native: speed multiplier to restore after flight (flight itself runs at FLIGHT_SPEED). */
  resumeSpeed: number;
}
/** Native flying pace (user request): the speed multiplier while airborne. */
export const FLIGHT_SPEED = 0.5;
export type FlightEnd = { kind: 'landed' | 'crashed'; slot: number; x: number; y: number; cause: 'pilot' | 'fuel' | 'wear' | 'tornado' };
export type FlightStartResult = { ok: true; flight: AircraftFlight } | { ok: false; reason: 'not-parked' | 'invalid-aircraft' | 'invalid-viewport' };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const word = (n: number) => n & 65535;
export function flightPosition(f: AircraftFlight): { x: number; y: number } {
  return { x: f.cameraX + (f.columns >> 1) + f.offsetX, y: f.cameraY + (f.rows >> 1) + f.offsetY };
}

/** Shared takeoff/checkpoint invariants; airborne terrain no longer has parked sprites. */
export function validFlightAircraft(world: Scenario, slot: number): boolean {
  const e = world.equipment[slot], definition = world.equipmentDefinitions[8];
  if (!Number.isInteger(slot) || slot < 1 || slot > 126 || !e?.active || e.type !== 8 || (e.flags & 15) ||
    !validAircraftHome(e) || e.x !== e.bytes[50] || e.y !== e.bytes[51] || e.parent || e.attachment ||
    !definition.ownedCount || definition.type !== 8 || definition.width !== 2 || definition.height !== 2 ||
    aircraftFuel(e) > 255 || aircraftPayload(e) > 255) return false;
  const pad = (e.x & 7) === 3 ? 32 : (e.x & 7) === 5 ? 64 : 0;
  const region = world.regionalConditions[((e.x >> 3) * 12 + (e.y >> 3)) * 7];
  return Boolean(pad && (e.y & 7) === 6 && (region & 15) === 5 && (region & pad)) &&
    !world.equipment.some(other => other.active && other.slot !== slot &&
      (other.attachment === slot || (other.type !== 7 && other.parent === slot)));
}

/** 0x30f70 + centering0x22578. Native canvas has no DOS client-border offsets.
 * Preserve captured viewport dimensions across browser resizes and checkpoints. */
export function beginFlight(world: Scenario, finances: FinancialState, slot: number, columns: number, rows: number,
  soilMoisture: number, resumePaused: boolean, resumeSpeed = 1): FlightStartResult {
  if (![columns, rows].every(n => Number.isInteger(n) && n >= 8 && n <= 80)) return { ok: false, reason: 'invalid-viewport' };
  const check = checkAircraftService(world, finances, createAircraftServiceState(), slot, { kind: 'repair' });
  if (!check.ok && check.reason !== 'insufficient-cash') return { ok: false, reason: 'not-parked' };
  const e = world.equipment[slot];
  if (!validFlightAircraft(world, slot) ||
    !Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127)
    return { ok: false, reason: 'invalid-aircraft' };
  const tick = world.farm.animationTicks;
  const flight: AircraftFlight = { slot, columns, rows, cameraX: clamp(e.x - (columns >> 1), 0, 96 - columns),
    cameraY: clamp(e.y - (rows >> 1), 0, 96 - rows), offsetX: 0, offsetY: 0, heading: 6, altitude: 10,
    spraying: false, sprayFrame: 0, lastFrameTick: tick, lastWearTick: tick, lastFuelTick: tick,
    lastSprayTick: tick, // SF-110: initialize the otherwise undefined first spraying timestamp at takeoff.
    turbulence: false, turbulenceTick: tick, spin: 0, inputs: [], active: true, resumePaused, resumeSpeed };
  // Generic map erase0x1d0e8: type8 replaces the complete footprint with soil grass.
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
    const c = world.cells[worldIndex(e.x + dx, e.y + dy)];
    c.terrain = ((c.terrain & 0xf800) | (15 + soilMoisture + (c.attribute >>> 2))) & 65535;
  }
  return { ok: true, flight };
}

/** Original viewport/offset movement0x31292..0x314c2. Heading changes at
 * an edge retain source asymmetries. SF-111 fixes only the NW wrong-axis clamp. */
export function moveFlight(f: AircraftFlight): void {
  const limitX = (f.columns >> 1) - 3, limitY = (f.rows >> 1) - 3;
  const north = (turn: number) => {
    if (f.offsetY > 0) f.offsetY--;
    else if (--f.cameraY < 0) {
      f.cameraY = 0;
      if (--f.offsetY < -limitY) { f.offsetY = -limitY; f.heading = turn; }
    }
  };
  const south = (turn: number) => {
    if (f.offsetY < 0) f.offsetY++;
    else if (++f.cameraY > 95 - f.rows) {
      f.cameraY = 95 - f.rows;
      if (++f.offsetY > limitY) { f.offsetY = limitY; f.heading = turn; }
    }
  };
  const east = () => {
    if (f.offsetX < 0) f.offsetX++;
    else if (++f.cameraX > 96 - f.columns) {
      f.cameraX = 96 - f.columns;
      if (++f.offsetX > limitX) { f.offsetX = limitX; f.heading = 4; }
    }
  };
  const west = () => {
    if (f.offsetX > 0) f.offsetX--;
    else if (--f.cameraX < 0) {
      f.cameraX = 0;
      if (--f.offsetX < -limitX) { f.offsetX = -limitX; f.heading = 0; }
    }
  };
  switch (f.heading) {
    case 0: north(1); break;
    case 1: north(2); east(); break;
    case 2: east(); break;
    case 3: south(4); east(); break;
    case 4: south(6); break;
    case 5: south(6); west(); break;
    case 6: west(); break;
    case 7: north(2); west(); break;
  }
}

function finishFlight(world: Scenario, finances: FinancialState, f: AircraftFlight, cause: FlightEnd['cause']): FlightEnd {
  const e = world.equipment[f.slot], p = flightPosition(f), region = ((p.x >> 3) * 12 + (p.y >> 3)) * 7;
  const landed = (world.regionalConditions[region] & 15) === 5;
  if (landed) {
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++)
      world.cells[worldIndex(e.bytes[50] + dx, e.bytes[51] + dy)].terrain = [[71, 111], [72, 112]][dx][dy];
    const homeRegion = ((e.bytes[50] >> 3) * 12 + (e.bytes[51] >> 3)) * 7;
    if ((e.bytes[50] & 7) === 3) world.regionalConditions[homeRegion] |= 32;
    else if ((e.bytes[50] & 7) === 5) world.regionalConditions[homeRegion] |= 64;
  } else {
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++)
      world.cells[worldIndex(p.x + dx, p.y + dy)].terrain = [[73, 113], [74, 114]][dx][dy];
    // Generic removal0x3a040/0xf888, no sale income or cash refund.
    if (!(e.flags & 64)) {
      world.equipmentDefinitions[8].ownedCount--;
      finances.accounts.assets.equipmentBookValue = (finances.accounts.assets.equipmentBookValue - world.equipmentDefinitions[8].price) >>> 0;
    }
    clearAircraftHome(world, e); e.flags &= ~32;
  }
  f.active = false;
  return { kind: landed ? 'landed' : 'crashed', slot: f.slot, ...p, cause };
}

/** Source frame order: wear, fuel, spray consumption, one BIOS input, movement,
 * draw/spray application, tornado distance, then end-of-flight on the next loop.
 * Input is queued so controls never bypass the source timing/order. */
export function advanceFlight(world: Scenario, finances: FinancialState, crops: readonly (readonly number[])[], f: AircraftFlight,
  tick: number, tornado: { x: number; y: number } | null = null): { advanced: boolean; end?: FlightEnd } {
  if (!f.active || word(tick - f.lastFrameTick) < 2) return { advanced: false };
  f.lastFrameTick = tick;
  const e = world.equipment[f.slot], v = new Binary(e.bytes).view;
  let cause: FlightEnd['cause'] | null = null;
  if (word(tick - f.lastWearTick) > 32) {
    e.bytes[17]++; if (e.condition > 250) cause = 'wear'; f.lastWearTick = tick;
  }
  if (word(tick - f.lastFuelTick) > 32) {
    const next = word(aircraftFuel(e) - 1);
    v.setUint16(20, (next << 16 >> 16) <= 0 ? 0 : next, true);
    if ((next << 16 >> 16) <= 0) cause = 'fuel'; f.lastFuelTick = tick;
  }
  if (f.spraying && word(tick - f.lastSprayTick) > 8) {
    const payload = aircraftPayload(e);
    if (payload) v.setUint16(32, payload - 1, true); else f.spraying = false;
    f.lastSprayTick = tick;
  }
  switch (f.inputs.shift()) {
    case 'left': f.heading = (f.heading - 1) & 7; break;
    case 'right': f.heading = (f.heading + 1) & 7; break;
    case 'climb': f.altitude = Math.min(100, f.altitude + 1); break;
    case 'descend': if (--f.altitude < 1) { f.altitude = 0; cause = 'pilot'; } break;
    case 'spray-toggle': f.spraying = !f.spraying && aircraftPayload(e) > 0; break;
    case 'spray-on': if (aircraftPayload(e)) f.spraying = true; break;
    case 'spray-off': f.spraying = false; break;
    case 'end': cause = 'pilot'; break;
  }
  moveFlight(f);
  if (f.turbulence && word(tick - f.turbulenceTick) < 128) f.spin = word(f.spin + 1);
  else { f.spin = 0; f.turbulence = false; }
  if (f.spraying) {
    f.sprayFrame = (f.sprayFrame + 1) & 3;
    if (f.sprayFrame === 0) {
      const { x, y } = flightPosition(f), field = world.fields.find(field => field.contains(x, y));
      const chemical = aircraftChemical(e), mode = chemical === 221 ? 8 : chemical === 222 ? 10 : chemical === 223 ? 6 : 0;
      if (field && mode) {
        const offset = chemical === 221 ? 20 : chemical === 222 ? 21 : 22;
        changeFieldCondition(field, crops[field.cropSlot], world.regionalConditions, 3, 2);
        changeFieldCondition(field, crops[field.cropSlot], world.regionalConditions, mode, field.bytes[offset]);
        field.bytes[chemical === 221 ? 60 : chemical === 222 ? 61 : 62] >>>= 1;
      }
    }
  }
  if (tornado) {
    // Original tests camera centre, not the plane's edge offset. Distance is squared0xfb54.
    const dx = f.cameraX + (f.columns >> 1) - tornado.x, dy = f.cameraY + (f.rows >> 1) - tornado.y;
    const distance = dx * dx + dy * dy;
    if (distance < 50) { if (distance < 5) { f.altitude = 0; cause = 'tornado'; } f.turbulence = true; f.turbulenceTick = tick; }
  }
  return cause ? { advanced: true, end: finishFlight(world, finances, f, cause) } : { advanced: true };
}
