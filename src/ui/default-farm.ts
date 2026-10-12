import { loadGeneratedTiles, loadNewFarmAssets, loadRegionAssets, type GameAssets, type RegionAssets } from '../assets/game-assets';
import { GameSimulation } from '../simulation/game';
import type { NewFarmOptions } from '../simulation/new-farm-state';
import type { LoadedFarm } from './SaveControls';
import { applyPreferredOptions } from './preferences';

/** Native default location (user request): label "Region 9, 14", zero-based grid cell 8,13.
 * The original chooser's initial cursor (DS 66c0/66c2, decoded as `initialLocation`) stays as evidence. */
export const DEFAULT_REGION = { x: 8, y: 13 } as const;

/** Developer/test override: localStorage value 'scenario-1' restores the former Scenario 1 first start. */
export const STARTUP_OVERRIDE_KEY = 'simfarm.startup.v1';
export function startsWithScenario1(): boolean {
  try { return localStorage.getItem(STARTUP_OVERRIDE_KEY) === 'scenario-1'; } catch { return false; }
}

/** Browser setup defaults are independent of the simulation's saved RNG streams. */
export function randomSetupSeeds(): NewFarmOptions['seeds'] {
  const value = new Uint16Array(1);
  do { crypto.getRandomValues(value); } while (value[0] === 0);
  return { visual: value[0], simulation: value[0], bounded: value[0] };
}

/** New Game defaults: current year/weekday, river, no lake, fresh random seed, climate of `location`. */
export function defaultFarmOptions(location?: { precipitation: number; temperature: number; wind: number }): NewFarmOptions {
  const date = new Date();
  return { climate: location ? { precipitation: location.precipitation, temperature: location.temperature, wind: location.wind } : { precipitation: 2, temperature: 2, wind: 1 },
    river: true, lake: false, date: { year: date.getFullYear(), dayOfWeek: date.getDay() }, seeds: randomSetupSeeds() };
}

export function defaultRegionIndex(map: Pick<RegionAssets, 'locations'>): number {
  const index = DEFAULT_REGION.y * 18 + DEFAULT_REGION.x;
  if (!map.locations[index]?.selectable) throw new Error('Default region is not selectable');
  return index;
}

/** First start without a saved game: a freshly generated random farm in the default region, exactly as
 * New Game → Use This Region would create it with its default options. */
export async function createDefaultFarm(assets: GameAssets, signal: AbortSignal): Promise<LoadedFarm> {
  const map = await loadRegionAssets(signal), options = defaultFarmOptions(map.locations[defaultRegionIndex(map)]);
  const setup = await loadNewFarmAssets(assets, signal);
  const tiles = await loadGeneratedTiles(setup.records.cropFiles, signal);
  signal.throwIfAborted();
  const simulation = GameSimulation.createGeographic(options, setup, 'selected-climate');
  applyPreferredOptions(simulation);
  return { scenarioId: null, simulation, tiles };
}
