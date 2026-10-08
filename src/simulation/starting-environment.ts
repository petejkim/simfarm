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
