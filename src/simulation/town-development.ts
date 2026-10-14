import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import type { TownConstructionState, TownLayouts } from '../formats/town';
import type { FarmRandom } from './random';
import { connectTownRoad } from './town-construction';
import type { TownSite } from './town';

export interface TownDevelopmentState extends TownConstructionState {
  activeSite: TownSite;
  /** Raw signed-dword bits, 6190:758a. */
  townRevenue: number;
  /** Wrapping word 6190:7514; incremented only by successful growth. */
  developmentSpent: number;
}
const validSite = (s: TownSite) => [s.regionX, s.regionY].every(n => Number.isInteger(n) && n >= 0 && n < 12);
const regionIndex = (s: TownSite) => (s.regionX * 12 + s.regionY) * 7;
const road = (tile: number) => tile >= 161 && tile <= 172;
const building = (tile: number) => (tile >= 252 && tile <= 280) || (tile >= 292 && tile <= 320);
const anchor = (tile: number) => tile >= 252 && tile <= 280 && !(tile & 1);

/** 0x3b4ce..0x3be2a, including both source jump tables. No ownership, overlay,
 * attribute or level mutation. Road reshaping may affect adjacent regions. */
export function repaintTownDistrict(world: Scenario, layouts: TownLayouts, site: TownSite, random: FarmRandom): void {
  if (!validSite(site)) throw new Error('Invalid town site');
  const value = world.regionalConditions[regionIndex(site)], type = value & 15, level = value >>> 4;
  if (type === 15) throw new Error('Invalid town type'); // SF-049.
  const x = site.regionX * 8, y = site.regionY * 8;
  // Reject malformed layouts before writes or RNG consumption (SF-053).
  if (type !== 0 && type !== 4 && type !== 5 && level >= 1 && level <= 7) {
    for (let dx = 0; dx < 8; dx++) for (let dy = 0; dy < 8; dy++) {
      if (anchor(layouts.tile(type, dx, dy)) && (dx === 7 || dy === 7)) throw new Error('Town building crosses district boundary');
    }
  }
  const pave = (dx: number, dy: number, base: 150 | 161) => {
    world.cells[worldIndex(x + dx, y + dy)].terrain &= 0xcfff;
    connectTownRoad(world, x + dx, y + dy, base);
  };
  const each = (action: (dx: number, dy: number, tile: number) => void) => {
    for (let dx = 0; dx < 8; dx++) for (let dy = 0; dy < 8; dy++) action(dx, dy, layouts.tile(type, dx, dy));
  };
  if (type === 0 || type === 4 || type === 5) {
    each((dx, dy, tile) => {
      const cell = world.cells[worldIndex(x + dx, y + dy)];
      if (type !== 0 && [71, 72, 111, 112].includes(terrainTile(cell))) return;
      if (road(tile)) pave(dx, dy, type === 0 ? 161 : 150);
      else cell.terrain = tile;
    });
    // Type zero makes a second complete road pass, after the dirt pass.
    if (type === 0) each((dx, dy, tile) => { if (road(tile)) pave(dx, dy, 150); });
    return;
  }
  if (level === 0) {
    each((dx, dy) => {
      const cell = world.cells[worldIndex(x + dx, y + dy)];
      cell.terrain = 15 + (cell.attribute & 15);
    });
  } else if (level <= 7) {
    each((dx, dy, tile) => {
      if (anchor(tile)) {
        // 5fd:007d is the visual RNG. Source offsets +0xc0/+2 are X/Y.
        const variant = ((random.nextVisual() & 3) + (level >>> 1)) * 2;
        world.cells[worldIndex(x + dx, y + dy)].terrain = 252 + variant;
        world.cells[worldIndex(x + dx + 1, y + dy)].terrain = 253 + variant;
        world.cells[worldIndex(x + dx, y + dy + 1)].terrain = 292 + variant;
        world.cells[worldIndex(x + dx + 1, y + dy + 1)].terrain = 293 + variant;
      } else if (building(tile)) return;
      else if (road(tile)) pave(dx, dy, 161);
      else world.cells[worldIndex(x + dx, y + dy)].terrain = tile;
    });
  } else if (level === 8) {
    each((dx, dy, tile) => {
      if (road(tile)) pave(dx, dy, 161);
      else world.cells[worldIndex(x + dx, y + dy)].terrain = tile;
    });
  } else if (level <= 12) {
    // Source 9: first quadrant; 10: first Y half; 11: that half plus
    // X<4/Y>=4; 12: all. It does not restore buildings on these passes.
    each((dx, dy, tile) => {
      const included = level === 9 ? dx < 4 && dy < 4 : level <= 11 ? dy < 4 : true;
      if (included && road(tile)) pave(dx, dy, 150);
    });
    if (level === 11) each((dx, dy, tile) => { if (dx < 4 && dy >= 4 && road(tile)) pave(dx, dy, 150); });
  }
  // Levels 13..15 intentionally do not paint.
}

function validateState(state: TownDevelopmentState, site: TownSite, soilMoisture: number): void {
  if (!validSite(site) || !validSite(state.activeSite)) throw new Error('Invalid town site');
  for (const [n, max] of [[state.townRevenue, 0xffffffff], [state.developmentSpent, 65535],
    [state.airportCount, 255], [state.recreationCount, 255]]) {
    if (!Number.isInteger(n) || n < 0 || n > max) throw new Error('Invalid town development state');
  }
  if (state.recreationCoordinates.length !== 16 || !Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) {
    throw new Error('Invalid town development state');
  }
}

/** 0x3c4f8: radii 1..6, exclusive positive edge, excluding both origin
 * axes. Native bounds reject coordinate 12 (SF-052). */
function nextSite(world: Scenario, from: TownSite): TownSite {
  const origin = { regionX: world.farm.townRegionX, regionY: world.farm.townRegionY };
  for (let r = 1; r < 7; r++) {
    for (let x = from.regionX - r; x < from.regionX + r; x++) for (let y = from.regionY - r; y < from.regionY + r; y++) {
      const site = { regionX: x, regionY: y };
      if (validSite(site) && x !== origin.regionX && y !== origin.regionY && world.regionalConditions[regionIndex(site) + 1] === 2) return site;
    }
  }
  return origin;
}

/** 0x3be2c: protect the origin. SF-051 removes matching recreation pairs and airport counts once. */
export function demolishTownDistrict(world: Scenario, state: TownDevelopmentState, site: TownSite, soilMoisture: number): boolean {
  validateState(state, site, soilMoisture);
  if (site.regionX === world.farm.townRegionX && site.regionY === world.farm.townRegionY) return false;
  const index = regionIndex(site);
  if (world.regionalConditions[index + 1] !== 2) return false;
  const type = world.regionalConditions[index] & 15;
  if (type === 4) {
    const coordinates = state.recreationCoordinates, count = Math.min(state.recreationCount, coordinates.length / 2);
    for (let i = 0; i < count; i++) {
      if (coordinates[i * 2] !== site.regionX * 8 || coordinates[i * 2 + 1] !== site.regionY * 8) continue;
      coordinates.copyWithin(i * 2, (i + 1) * 2, count * 2);
      coordinates.fill(0, (count - 1) * 2, count * 2);
      state.recreationCount--; break;
    }
  } else if (type === 5) state.airportCount = Math.max(0, state.airportCount - 1);
  world.regionalConditions[index + 1] = 0;
  state.activeSite = nextSite(world, state.activeSite);
  for (let x = site.regionX * 8; x < site.regionX * 8 + 8; x++) for (let y = site.regionY * 8; y < site.regionY * 8 + 8; y++) {
    const cell = world.cells[worldIndex(x, y)], tile = terrainTile(cell);
    cell.overlay &= 0xb7ff;
    if (tile < 39 || tile >= 69) cell.terrain = ((15 + soilMoisture + (cell.attribute >>> 2)) | (cell.terrain & 0xf800)) & 65535;
  }
  return true;
}

/** 0x3b3ac: source success is not equivalent to a level change. In particular,
 * raw byte 5 returns true untouched, while demolition returns false (SF-050). */
export function changeTownLevel(world: Scenario, state: TownDevelopmentState, layouts: TownLayouts,
  site: TownSite, direction: -1 | 0 | 1, soilMoisture: number, random: FarmRandom): boolean {
  validateState(state, site, soilMoisture);
  if (![-1, 0, 1].includes(direction)) throw new Error('Invalid town direction');
  const index = regionIndex(site), value = world.regionalConditions[index], type = value & 15, level = value >>> 4;
  if (type === 15) throw new Error('Invalid town type');
  if (value === 5) return true;
  if (direction === 1 && level >= 13) return false;
  if (direction === -1 && level === 0) { demolishTownDistrict(world, state, site, soilMoisture); return false; }
  world.regionalConditions[index] = ((level + direction) << 4) | type;
  try { repaintTownDistrict(world, layouts, site, random); }
  catch (error) { world.regionalConditions[index] = value; throw error; }
  return true;
}

/** Native debug helper: owned districts (flag 2) that weekly growth could still raise, x-first like
 * the region tables. Excludes level 13+ (0x3b3ac refuses), raw byte 5 (returns untouched) and type 15. */
export function growableTownSites(world: Pick<Scenario, 'regionalConditions'>): TownSite[] {
  const sites: TownSite[] = [];
  for (let regionX = 0; regionX < 12; regionX++) for (let regionY = 0; regionY < 12; regionY++) {
    const index = regionIndex({ regionX, regionY }), value = world.regionalConditions[index];
    if (world.regionalConditions[index + 1] === 2 && value !== 5 && (value & 15) !== 15 && value >>> 4 < 13) sites.push({ regionX, regionY });
  }
  return sites;
}

/** 0x3b162..0x3b218, called weekly through 24e6:0ff6 at 0xcbb3,
 * before field orders and monthly/annual financial receipts. */
export function developTown(world: Scenario, state: TownDevelopmentState, layouts: TownLayouts,
  soilMoisture: number, random: FarmRandom): void {
  validateState(state, state.activeSite, soilMoisture);
  if (world.regionalConditions[regionIndex(state.activeSite) + 1] !== 2) return;
  const revenue = state.townRevenue | 0;
  if (revenue >= 25 && changeTownLevel(world, state, layouts, state.activeSite, 1, soilMoisture, random)) {
    state.townRevenue = (state.townRevenue - 25) >>> 0;
    state.developmentSpent = (state.developmentSpent + 25) & 65535;
  } else if (revenue < 0 && changeTownLevel(world, state, layouts, state.activeSite, -1, soilMoisture, random)) {
    state.townRevenue = Math.min(0, revenue + 25) >>> 0;
  }
}
