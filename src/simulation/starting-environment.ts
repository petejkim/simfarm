import type { ClimateTables } from '../formats/weather';
import type { FinancialState } from '../formats/finance';
import type { Scenario } from '../formats/scenario';
import type { TownLayouts } from '../formats/town';
import { validateCalendar, type FarmCalendar } from './calendar';
import { constructTownDistrict, type TownConstructionResult } from './town-construction';
import type { SetupRuntime } from './new-farm-runtime';
import type { TownSite } from './town';

/** First-launch0x234f..0x238d, distinct from the fixed restart calendar.
 * Inject the year/weekday from the caller so simulation never reads host time.
 * Original DOS date helper0x5dba returns weekday0=Sunday through6=Saturday. */
export function createStartupCalendar(date: { year: number; dayOfWeek: number }): FarmCalendar {
  const calendar = { year: date.year, day: date.dayOfWeek, month: 3, week: 0, season: 1 };
  validateCalendar(calendar);
  return calendar;
}

/** Setup0x3fab0..0x3faec: construct one type0 district with owner2, then
 * assign the active site. Overlapping source word stores also zero4d9f:fedd.
 * Property and climate selection precede this phase; startup date/crops follow. */
export function initializeStartingTown(world: Pick<Scenario, 'cells' | 'regionalConditions'>, runtime: SetupRuntime,
  layouts: TownLayouts, site: TownSite): TownConstructionResult {
  if (world.cells.length !== 9216 || world.regionalConditions.length !== 1008) throw new Error('Invalid starting town map');
  const result = constructTownDistrict({ ...world, farm: runtime.farm }, runtime.finances.town, layouts, site, 0);
  if (!result.ok) return result;
  runtime.finances.town.activeSite = { ...site };
  runtime.raw.s4d9fFedd = 0;
  return result;
}

/** Geographic chooser return2 still passes through0x41032 climate loading,
 *0x3f91b cash assignment and0x3fab0 town construction. This is not a native
 *checkpoint restore or the in-game SSM file-load path. */
export function finalizeRegionFarm(world: Scenario, finances: FinancialState, layouts: TownLayouts, climate: ClimateTables): void {
  if (world.origin !== 'original' || world.cells.length !== 9216 || world.regionalConditions.length !== 1008)
    throw new Error('Invalid region farm');
  for (const channel of ['wind', 'precipitation', 'temperature'] as const) {
    if (!Array.isArray(climate[channel]) || climate[channel].length !== 240 ||
      climate[channel].some(n => !Number.isInteger(n) || n < -128 || n > (channel === 'precipitation' ? 7 : 127)))
      throw new Error('Invalid region climate');
  }
  const site = { regionX: world.farm.townRegionX, regionY: world.farm.townRegionY };
  const result = constructTownDistrict(world, finances.town, layouts, site, 0);
  if (!result.ok) throw new Error('Invalid region town');
  world.climate = structuredClone(climate);
  world.farm.cash = 40000;
  finances.town.activeSite = site;
}
